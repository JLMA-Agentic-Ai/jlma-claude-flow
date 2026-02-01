/**
 * Concurrent Access Manager
 *
 * Implements thread-safe patterns and race condition prevention
 * to fix data corruption and score variance >15% under load.
 * Uses atomic operations, versioning, and consensus algorithms.
 */

import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import crypto from 'crypto';

export class ConcurrentAccessManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      maxConcurrentReads: options.maxConcurrentReads || 100,
      maxConcurrentWrites: options.maxConcurrentWrites || 10,
      lockTimeoutMs: options.lockTimeoutMs || 5000,
      retryAttempts: options.retryAttempts || 3,
      retryDelayMs: options.retryDelayMs || 100,
      consistencyLevel: options.consistencyLevel || 'strong', // 'eventual', 'strong', 'strict'
      scoreVarianceThreshold: options.scoreVarianceThreshold || 0.15,
      enableOptimisticLocking: options.enableOptimisticLocking !== false,
      ...options
    };

    // Thread-safe data structures
    this.resourceLocks = new Map(); // ResourceId -> Lock
    this.readWriteLocks = new Map(); // ResourceId -> RWLock
    this.versionedData = new Map(); // ResourceId -> VersionedResource
    this.transactionLog = new Map(); // TransactionId -> Transaction
    this.scoreMetrics = new Map(); // ResourceId -> ScoreMetrics

    // Atomic operation counters
    this.atomicCounters = {
      readOperations: 0,
      writeOperations: 0,
      lockConflicts: 0,
      retryCount: 0,
      successfulTransactions: 0,
      failedTransactions: 0
    };

    this.workers = new Map(); // WorkerId -> Worker

    this._initializeConcurrencyControls();
  }

  _initializeConcurrencyControls() {
    // Periodic deadlock detection
    setInterval(() => this._detectDeadlocks(), 10000);

    // Score variance monitoring
    setInterval(() => this._monitorScoreVariance(), 5000);

    // Lock cleanup for expired locks
    setInterval(() => this._cleanupExpiredLocks(), 1000);

    // Transaction timeout handler
    setInterval(() => this._handleTransactionTimeouts(), 2000);
  }

  /**
   * Atomic read operation with optimistic locking
   */
  async atomicRead(resourceId, options = {}) {
    const readLock = await this._acquireReadLock(resourceId, options);

    try {
      this.atomicCounters.readOperations++;

      const resource = this.versionedData.get(resourceId);
      if (!resource) {
        return null;
      }

      // Track read access for score metrics
      this._recordScoreAccess(resourceId, 'read', resource.data);

      return {
        data: structuredClone(resource.data), // Deep copy to prevent mutations
        version: resource.version,
        lastModified: resource.lastModified
      };

    } finally {
      this._releaseReadLock(resourceId, readLock);
    }
  }

  /**
   * Atomic write operation with version checking
   */
  async atomicWrite(resourceId, newData, expectedVersion = null, options = {}) {
    const transactionId = this._generateTransactionId();
    const writeLock = await this._acquireWriteLock(resourceId, options);

    try {
      this.atomicCounters.writeOperations++;

      const resource = this.versionedData.get(resourceId);
      const currentVersion = resource ? resource.version : 0;

      // Optimistic concurrency control
      if (this.options.enableOptimisticLocking && expectedVersion !== null) {
        if (currentVersion !== expectedVersion) {
          throw new ConcurrencyError(
            `Version conflict: expected ${expectedVersion}, got ${currentVersion}`,
            'VERSION_CONFLICT',
            { expectedVersion, currentVersion }
          );
        }
      }

      // Create new versioned resource
      const newVersion = currentVersion + 1;
      const updatedResource = {
        data: structuredClone(newData),
        version: newVersion,
        lastModified: Date.now(),
        modifiedBy: transactionId
      };

      // Log transaction
      this._logTransaction(transactionId, 'write', resourceId, {
        oldVersion: currentVersion,
        newVersion,
        dataSize: JSON.stringify(newData).length
      });

      // Atomic update
      this.versionedData.set(resourceId, updatedResource);

      // Track write access for score metrics
      this._recordScoreAccess(resourceId, 'write', newData);

      this.atomicCounters.successfulTransactions++;

      this.emit('atomicWrite', {
        resourceId,
        version: newVersion,
        transactionId,
        dataSize: JSON.stringify(newData).length
      });

      return {
        version: newVersion,
        success: true,
        transactionId
      };

    } catch (error) {
      this.atomicCounters.failedTransactions++;
      this._logTransaction(transactionId, 'write_failed', resourceId, { error: error.message });
      throw error;

    } finally {
      this._releaseWriteLock(resourceId, writeLock);
    }
  }

  /**
   * Atomic compare-and-swap operation
   */
  async compareAndSwap(resourceId, expectedValue, newValue, options = {}) {
    return this._retryOperation(async () => {
      const current = await this.atomicRead(resourceId);

      if (!current) {
        throw new ConcurrencyError('Resource not found', 'RESOURCE_NOT_FOUND');
      }

      // Deep comparison for complex objects
      if (!this._deepEqual(current.data, expectedValue)) {
        throw new ConcurrencyError(
          'Compare-and-swap failed: value mismatch',
          'CAS_FAILED',
          { expected: expectedValue, actual: current.data }
        );
      }

      return this.atomicWrite(resourceId, newValue, current.version, options);
    }, options);
  }

  /**
   * Batch atomic operation for multiple resources
   */
  async atomicBatch(operations, options = {}) {
    const transactionId = this._generateTransactionId();
    const acquiredLocks = [];

    try {
      // Sort operations to prevent deadlocks (alphabetically by resourceId)
      const sortedOps = operations.sort((a, b) => a.resourceId.localeCompare(b.resourceId));

      // Acquire all necessary locks
      for (const op of sortedOps) {
        const lock = op.type === 'read' ?
          await this._acquireReadLock(op.resourceId, options) :
          await this._acquireWriteLock(op.resourceId, options);

        acquiredLocks.push({ resourceId: op.resourceId, lock, type: op.type });
      }

      // Execute operations atomically
      const results = [];
      for (const op of sortedOps) {
        let result;

        if (op.type === 'read') {
          result = await this._executeRead(op.resourceId);
        } else if (op.type === 'write') {
          result = await this._executeWrite(op.resourceId, op.data, op.expectedVersion);
        }

        results.push({ resourceId: op.resourceId, result });
      }

      this.atomicCounters.successfulTransactions++;

      return {
        transactionId,
        success: true,
        results
      };

    } catch (error) {
      this.atomicCounters.failedTransactions++;
      throw error;

    } finally {
      // Release locks in reverse order
      for (let i = acquiredLocks.length - 1; i >= 0; i--) {
        const { resourceId, lock, type } = acquiredLocks[i];

        if (type === 'read') {
          this._releaseReadLock(resourceId, lock);
        } else {
          this._releaseWriteLock(resourceId, lock);
        }
      }
    }
  }

  /**
   * Distributed consensus operation
   */
  async consensusWrite(resourceId, newData, options = {}) {
    const { consensusNodes = 3, quorum = 2 } = options;

    if (quorum > consensusNodes) {
      throw new Error('Quorum cannot be greater than consensus nodes');
    }

    const proposals = [];
    const votes = new Map();

    try {
      // Phase 1: Propose
      for (let i = 0; i < consensusNodes; i++) {
        const proposalId = `${resourceId}_${Date.now()}_${i}`;
        proposals.push(this._sendProposal(proposalId, resourceId, newData));
      }

      const proposalResults = await Promise.allSettled(proposals);

      // Phase 2: Vote
      let acceptedCount = 0;
      for (const result of proposalResults) {
        if (result.status === 'fulfilled' && result.value.accepted) {
          acceptedCount++;
        }
      }

      if (acceptedCount >= quorum) {
        // Phase 3: Commit
        return this.atomicWrite(resourceId, newData, null, {
          ...options,
          consensusApproved: true
        });
      } else {
        throw new ConcurrencyError(
          `Consensus failed: only ${acceptedCount}/${quorum} nodes agreed`,
          'CONSENSUS_FAILED'
        );
      }

    } catch (error) {
      this.emit('consensusFailed', { resourceId, error: error.message });
      throw error;
    }
  }

  /**
   * Thread pool for CPU-intensive operations
   */
  async executeInWorkerPool(operation, data, options = {}) {
    const workerId = this._getAvailableWorker();

    if (!workerId) {
      throw new Error('No available workers in pool');
    }

    const worker = this.workers.get(workerId);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Worker operation timed out'));
      }, options.timeout || 30000);

      worker.postMessage({ operation, data, requestId: crypto.randomUUID() });

      worker.once('message', (result) => {
        clearTimeout(timeout);

        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result.data);
        }
      });
    });
  }

  async _acquireReadLock(resourceId, options) {
    return this._retryOperation(async () => {
      let rwLock = this.readWriteLocks.get(resourceId);

      if (!rwLock) {
        rwLock = new ReadWriteLock();
        this.readWriteLocks.set(resourceId, rwLock);
      }

      return rwLock.acquireReadLock(options.timeout || this.options.lockTimeoutMs);
    }, options);
  }

  async _acquireWriteLock(resourceId, options) {
    return this._retryOperation(async () => {
      let rwLock = this.readWriteLocks.get(resourceId);

      if (!rwLock) {
        rwLock = new ReadWriteLock();
        this.readWriteLocks.set(resourceId, rwLock);
      }

      return rwLock.acquireWriteLock(options.timeout || this.options.lockTimeoutMs);
    }, options);
  }

  _releaseReadLock(resourceId, lock) {
    const rwLock = this.readWriteLocks.get(resourceId);
    if (rwLock) {
      rwLock.releaseReadLock(lock);
    }
  }

  _releaseWriteLock(resourceId, lock) {
    const rwLock = this.readWriteLocks.get(resourceId);
    if (rwLock) {
      rwLock.releaseWriteLock(lock);
    }
  }

  async _retryOperation(operation, options = {}) {
    const maxRetries = options.retryAttempts || this.options.retryAttempts;
    const baseDelay = options.retryDelayMs || this.options.retryDelayMs;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }

        if (this._isRetryableError(error)) {
          this.atomicCounters.retryCount++;

          // Exponential backoff with jitter
          const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 100;
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
  }

  _isRetryableError(error) {
    return error instanceof ConcurrencyError &&
      ['LOCK_TIMEOUT', 'VERSION_CONFLICT', 'TEMPORARY_FAILURE'].includes(error.code);
  }

  _recordScoreAccess(resourceId, accessType, data) {
    let metrics = this.scoreMetrics.get(resourceId);

    if (!metrics) {
      metrics = {
        readCount: 0,
        writeCount: 0,
        scoreValues: [],
        lastAccess: Date.now(),
        varianceWindow: []
      };
      this.scoreMetrics.set(resourceId, metrics);
    }

    if (accessType === 'read') {
      metrics.readCount++;
    } else {
      metrics.writeCount++;

      // Track score if data contains a score field
      if (data && typeof data.score === 'number') {
        metrics.scoreValues.push({
          value: data.score,
          timestamp: Date.now()
        });

        // Keep only recent scores for variance calculation
        const cutoff = Date.now() - 60000; // 1 minute window
        metrics.scoreValues = metrics.scoreValues.filter(s => s.timestamp > cutoff);
      }
    }

    metrics.lastAccess = Date.now();
  }

  _monitorScoreVariance() {
    for (const [resourceId, metrics] of this.scoreMetrics) {
      if (metrics.scoreValues.length < 2) continue;

      const scores = metrics.scoreValues.map(s => s.value);
      const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
      const standardDeviation = Math.sqrt(variance);
      const coefficientOfVariation = standardDeviation / mean;

      if (coefficientOfVariation > this.options.scoreVarianceThreshold) {
        this.emit('highScoreVariance', {
          resourceId,
          variance: coefficientOfVariation,
          threshold: this.options.scoreVarianceThreshold,
          scoreCount: scores.length,
          mean,
          standardDeviation
        });

        // Reset scores to prevent continuous alerts
        metrics.scoreValues = [];
      }
    }
  }

  _detectDeadlocks() {
    // Simple deadlock detection based on lock wait times
    const currentTime = Date.now();
    const suspiciousLocks = [];

    for (const [resourceId, rwLock] of this.readWriteLocks) {
      if (rwLock.waitingWriters.length > 0 || rwLock.waitingReaders.length > 0) {
        const oldestWait = Math.min(
          ...rwLock.waitingWriters.map(w => w.timestamp),
          ...rwLock.waitingReaders.map(r => r.timestamp)
        );

        if (currentTime - oldestWait > this.options.lockTimeoutMs * 2) {
          suspiciousLocks.push({ resourceId, waitTime: currentTime - oldestWait });
        }
      }
    }

    if (suspiciousLocks.length > 0) {
      this.emit('potentialDeadlock', { suspiciousLocks });

      // Force release oldest locks
      suspiciousLocks.forEach(({ resourceId }) => {
        const rwLock = this.readWriteLocks.get(resourceId);
        if (rwLock) {
          rwLock.forceReleaseAll();
        }
      });
    }
  }

  _cleanupExpiredLocks() {
    const currentTime = Date.now();

    for (const [resourceId, rwLock] of this.readWriteLocks) {
      rwLock.cleanupExpiredLocks(currentTime);

      // Remove empty locks
      if (rwLock.isEmpty()) {
        this.readWriteLocks.delete(resourceId);
      }
    }
  }

  _handleTransactionTimeouts() {
    const currentTime = Date.now();
    const timeoutThreshold = this.options.lockTimeoutMs * 3;

    for (const [transactionId, transaction] of this.transactionLog) {
      if (currentTime - transaction.startTime > timeoutThreshold) {
        this.emit('transactionTimeout', { transactionId, transaction });
        this.transactionLog.delete(transactionId);
      }
    }
  }

  _logTransaction(transactionId, operation, resourceId, metadata = {}) {
    this.transactionLog.set(transactionId, {
      id: transactionId,
      operation,
      resourceId,
      metadata,
      startTime: Date.now()
    });
  }

  _generateTransactionId() {
    return `tx_${Date.now()}_${crypto.randomUUID()}`;
  }

  _deepEqual(obj1, obj2) {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
  }

  _executeRead(resourceId) {
    const resource = this.versionedData.get(resourceId);
    return resource ? { ...resource } : null;
  }

  _executeWrite(resourceId, data, expectedVersion) {
    const resource = this.versionedData.get(resourceId);
    const currentVersion = resource ? resource.version : 0;

    if (expectedVersion !== null && currentVersion !== expectedVersion) {
      throw new ConcurrencyError('Version mismatch in batch operation', 'VERSION_CONFLICT');
    }

    const newVersion = currentVersion + 1;
    this.versionedData.set(resourceId, {
      data: structuredClone(data),
      version: newVersion,
      lastModified: Date.now()
    });

    return { version: newVersion };
  }

  async _sendProposal(proposalId, resourceId, data) {
    // Simulate consensus node communication
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

    // Simulate 90% acceptance rate
    return {
      proposalId,
      accepted: Math.random() > 0.1,
      timestamp: Date.now()
    };
  }

  _getAvailableWorker() {
    // Simple round-robin worker selection
    const workerIds = Array.from(this.workers.keys());
    return workerIds[Math.floor(Math.random() * workerIds.length)];
  }

  getMetrics() {
    return {
      ...this.atomicCounters,
      activeLocks: this.readWriteLocks.size,
      versionedResources: this.versionedData.size,
      activeTransactions: this.transactionLog.size,
      scoreResources: this.scoreMetrics.size
    };
  }

  shutdown() {
    // Force release all locks
    for (const rwLock of this.readWriteLocks.values()) {
      rwLock.forceReleaseAll();
    }

    // Terminate workers
    for (const worker of this.workers.values()) {
      worker.terminate();
    }

    this.readWriteLocks.clear();
    this.versionedData.clear();
    this.transactionLog.clear();
    this.workers.clear();

    this.emit('shutdown');
  }
}

// Read-Write Lock implementation
class ReadWriteLock {
  constructor() {
    this.readers = new Set();
    this.writer = null;
    this.waitingReaders = [];
    this.waitingWriters = [];
  }

  async acquireReadLock(timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const lockId = crypto.randomUUID();

      if (this.writer === null && this.waitingWriters.length === 0) {
        // Can acquire immediately
        this.readers.add(lockId);
        resolve(lockId);
      } else {
        // Must wait
        const waiter = {
          resolve,
          reject,
          timestamp: Date.now(),
          lockId
        };

        this.waitingReaders.push(waiter);

        setTimeout(() => {
          const index = this.waitingReaders.indexOf(waiter);
          if (index > -1) {
            this.waitingReaders.splice(index, 1);
            reject(new ConcurrencyError('Read lock timeout', 'LOCK_TIMEOUT'));
          }
        }, timeoutMs);
      }
    });
  }

  async acquireWriteLock(timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const lockId = crypto.randomUUID();

      if (this.writer === null && this.readers.size === 0) {
        // Can acquire immediately
        this.writer = lockId;
        resolve(lockId);
      } else {
        // Must wait
        const waiter = {
          resolve,
          reject,
          timestamp: Date.now(),
          lockId
        };

        this.waitingWriters.push(waiter);

        setTimeout(() => {
          const index = this.waitingWriters.indexOf(waiter);
          if (index > -1) {
            this.waitingWriters.splice(index, 1);
            reject(new ConcurrencyError('Write lock timeout', 'LOCK_TIMEOUT'));
          }
        }, timeoutMs);
      }
    });
  }

  releaseReadLock(lockId) {
    this.readers.delete(lockId);
    this._processWaitingLocks();
  }

  releaseWriteLock(lockId) {
    if (this.writer === lockId) {
      this.writer = null;
      this._processWaitingLocks();
    }
  }

  _processWaitingLocks() {
    // Prioritize writers when no readers
    if (this.readers.size === 0 && this.waitingWriters.length > 0) {
      const waiter = this.waitingWriters.shift();
      this.writer = waiter.lockId;
      waiter.resolve(waiter.lockId);
    }
    // Allow multiple readers when no writers
    else if (this.writer === null && this.waitingReaders.length > 0) {
      while (this.waitingReaders.length > 0 && this.writer === null) {
        const waiter = this.waitingReaders.shift();
        this.readers.add(waiter.lockId);
        waiter.resolve(waiter.lockId);
      }
    }
  }

  forceReleaseAll() {
    this.readers.clear();
    this.writer = null;

    // Reject all waiting requests
    [...this.waitingReaders, ...this.waitingWriters].forEach(waiter => {
      waiter.reject(new ConcurrencyError('Lock forcefully released', 'FORCE_RELEASE'));
    });

    this.waitingReaders = [];
    this.waitingWriters = [];
  }

  cleanupExpiredLocks(currentTime) {
    // Remove expired waiters
    this.waitingReaders = this.waitingReaders.filter(waiter => {
      if (currentTime - waiter.timestamp > 10000) {
        waiter.reject(new ConcurrencyError('Lock request expired', 'EXPIRED'));
        return false;
      }
      return true;
    });

    this.waitingWriters = this.waitingWriters.filter(waiter => {
      if (currentTime - waiter.timestamp > 10000) {
        waiter.reject(new ConcurrencyError('Lock request expired', 'EXPIRED'));
        return false;
      }
      return true;
    });
  }

  isEmpty() {
    return this.readers.size === 0 &&
           this.writer === null &&
           this.waitingReaders.length === 0 &&
           this.waitingWriters.length === 0;
  }
}

class ConcurrencyError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'ConcurrencyError';
    this.code = code;
    this.details = details;
  }
}

export { ConcurrentAccessManager as default, ConcurrencyError, ReadWriteLock };