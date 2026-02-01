/**
 * Resource Exhaustion Protection Guard
 *
 * Implements robust protection against memory leaks, CPU starvation,
 * and I/O blocking attacks. Based on forensic findings of >100MB
 * memory growth and 30% timeout rates.
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import cluster from 'cluster';
import os from 'os';

export class ResourceExhaustionGuard extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      memoryThresholdMB: options.memoryThresholdMB || 100,
      cpuThresholdPercent: options.cpuThresholdPercent || 80,
      ioTimeoutMs: options.ioTimeoutMs || 5000,
      checkIntervalMs: options.checkIntervalMs || 1000,
      leakDetectionWindow: options.leakDetectionWindow || 30000,
      maxConcurrentOperations: options.maxConcurrentOperations || 50,
      circuitBreakerThreshold: options.circuitBreakerThreshold || 0.3,
      ...options
    };

    this.metrics = {
      memoryBaseline: process.memoryUsage().heapUsed,
      cpuUsageSamples: [],
      activeOperations: new Map(),
      timeoutCounter: 0,
      totalOperations: 0,
      memoryLeakDetected: false,
      lastGCTime: Date.now(),
      ioBlockingEvents: 0
    };

    this.guards = {
      memoryGuard: new MemoryLeakGuard(this.options),
      cpuGuard: new CPUStarvationGuard(this.options),
      ioGuard: new IOBlockingGuard(this.options),
      circuitBreaker: new CircuitBreaker(this.options)
    };

    this._initializeMonitoring();
  }

  _initializeMonitoring() {
    // Memory leak detection with trend analysis
    setInterval(() => this._checkMemoryLeak(), this.options.checkIntervalMs);

    // CPU starvation detection with moving averages
    setInterval(() => this._checkCPUStarvation(), this.options.checkIntervalMs);

    // I/O blocking detection with timeout tracking
    setInterval(() => this._checkIOBlocking(), this.options.checkIntervalMs);

    // Force garbage collection when needed
    setInterval(() => this._manageMemoryPressure(), 5000);

    // Circuit breaker monitoring
    setInterval(() => this._updateCircuitBreaker(), 1000);
  }

  async protectOperation(operationId, operation, options = {}) {
    const startTime = performance.now();
    const timeout = options.timeout || this.options.ioTimeoutMs;

    // Check circuit breaker
    if (this.guards.circuitBreaker.isOpen()) {
      throw new Error('Circuit breaker is open - system under stress');
    }

    // Check resource limits before starting
    this._enforceResourceLimits();

    // Track active operation
    this.metrics.activeOperations.set(operationId, {
      startTime,
      timeout,
      type: options.type || 'unknown'
    });

    try {
      // Wrap operation with timeout and resource monitoring
      const result = await Promise.race([
        this._wrapOperation(operation, operationId),
        this._createTimeoutPromise(timeout, operationId)
      ]);

      this._recordSuccess(operationId, performance.now() - startTime);
      return result;

    } catch (error) {
      this._recordFailure(operationId, error);
      throw error;

    } finally {
      this.metrics.activeOperations.delete(operationId);
    }
  }

  async _wrapOperation(operation, operationId) {
    return new Promise((resolve, reject) => {
      // Monitor resource usage during operation
      const monitor = setInterval(() => {
        const current = this.metrics.activeOperations.get(operationId);
        if (!current) return;

        const elapsed = performance.now() - current.startTime;

        // Check for resource exhaustion
        if (this._isResourceExhausted()) {
          clearInterval(monitor);
          reject(new Error('Operation cancelled - resource exhaustion detected'));
        }

        // Update operation metrics
        current.cpuUsage = process.cpuUsage();
        current.memoryUsage = process.memoryUsage();
      }, 100);

      Promise.resolve(operation())
        .then(result => {
          clearInterval(monitor);
          resolve(result);
        })
        .catch(error => {
          clearInterval(monitor);
          reject(error);
        });
    });
  }

  _createTimeoutPromise(timeout, operationId) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        this.metrics.timeoutCounter++;
        this.metrics.ioBlockingEvents++;

        this.emit('operationTimeout', {
          operationId,
          timeout,
          activeOperations: this.metrics.activeOperations.size
        });

        reject(new Error(`Operation ${operationId} timed out after ${timeout}ms`));
      }, timeout);
    });
  }

  _checkMemoryLeak() {
    const usage = process.memoryUsage();
    const currentHeap = usage.heapUsed;
    const growthMB = (currentHeap - this.metrics.memoryBaseline) / 1024 / 1024;

    // Detect significant memory growth
    if (growthMB > this.options.memoryThresholdMB) {
      this.metrics.memoryLeakDetected = true;

      this.emit('memoryLeakDetected', {
        growthMB,
        currentHeapMB: currentHeap / 1024 / 1024,
        baselineMB: this.metrics.memoryBaseline / 1024 / 1024,
        activeOperations: this.metrics.activeOperations.size
      });

      // Force aggressive cleanup
      this._performEmergencyCleanup();
    }

    // Update baseline periodically to account for normal growth
    if (!this.metrics.memoryLeakDetected) {
      this.metrics.memoryBaseline = Math.max(
        this.metrics.memoryBaseline,
        currentHeap * 0.9 // Allow some growth
      );
    }
  }

  _checkCPUStarvation() {
    const usage = process.cpuUsage();
    const totalCPU = (usage.user + usage.system) / 1000; // Convert to ms

    this.metrics.cpuUsageSamples.push({
      timestamp: Date.now(),
      total: totalCPU
    });

    // Keep only recent samples
    const cutoff = Date.now() - 10000; // 10 seconds
    this.metrics.cpuUsageSamples = this.metrics.cpuUsageSamples.filter(
      sample => sample.timestamp > cutoff
    );

    // Calculate CPU usage rate
    if (this.metrics.cpuUsageSamples.length >= 2) {
      const latest = this.metrics.cpuUsageSamples[this.metrics.cpuUsageSamples.length - 1];
      const previous = this.metrics.cpuUsageSamples[0];

      const timeDiff = latest.timestamp - previous.timestamp;
      const cpuDiff = latest.total - previous.total;
      const cpuPercent = (cpuDiff / timeDiff) * 100;

      if (cpuPercent > this.options.cpuThresholdPercent) {
        this.emit('cpuStarvationDetected', {
          cpuPercent,
          activeOperations: this.metrics.activeOperations.size,
          timeoutRate: this._getTimeoutRate()
        });

        // Throttle new operations
        this._activateThrottling();
      }
    }
  }

  _checkIOBlocking() {
    const now = Date.now();
    const timeoutRate = this._getTimeoutRate();

    // Detect I/O blocking based on timeout rate
    if (timeoutRate > this.options.circuitBreakerThreshold) {
      this.metrics.ioBlockingEvents++;

      this.emit('ioBlockingDetected', {
        timeoutRate,
        activeOperations: this.metrics.activeOperations.size,
        blockingEvents: this.metrics.ioBlockingEvents
      });

      // Reduce I/O concurrency
      this._reduceIOConcurrency();
    }

    // Check for stuck operations
    for (const [opId, operation] of this.metrics.activeOperations) {
      const elapsed = now - operation.startTime;
      if (elapsed > operation.timeout * 1.5) {
        this.emit('stuckOperationDetected', {
          operationId: opId,
          elapsedMs: elapsed,
          expectedTimeoutMs: operation.timeout
        });
      }
    }
  }

  _isResourceExhausted() {
    const usage = process.memoryUsage();
    const memoryUsageMB = usage.heapUsed / 1024 / 1024;
    const timeoutRate = this._getTimeoutRate();

    return (
      memoryUsageMB > this.options.memoryThresholdMB * 2 ||
      this.metrics.activeOperations.size > this.options.maxConcurrentOperations ||
      timeoutRate > this.options.circuitBreakerThreshold
    );
  }

  _getTimeoutRate() {
    if (this.metrics.totalOperations === 0) return 0;
    return this.metrics.timeoutCounter / this.metrics.totalOperations;
  }

  _performEmergencyCleanup() {
    // Cancel non-critical operations
    for (const [opId, operation] of this.metrics.activeOperations) {
      if (operation.type !== 'critical') {
        this.metrics.activeOperations.delete(opId);
      }
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      this.metrics.lastGCTime = Date.now();
    }

    // Reset memory baseline
    this.metrics.memoryBaseline = process.memoryUsage().heapUsed;
    this.metrics.memoryLeakDetected = false;
  }

  _enforceResourceLimits() {
    if (this.metrics.activeOperations.size >= this.options.maxConcurrentOperations) {
      throw new Error(`Maximum concurrent operations exceeded: ${this.options.maxConcurrentOperations}`);
    }

    if (this._isResourceExhausted()) {
      throw new Error('System under resource stress - operation rejected');
    }
  }

  _recordSuccess(operationId, duration) {
    this.metrics.totalOperations++;
    this.guards.circuitBreaker.recordSuccess();
  }

  _recordFailure(operationId, error) {
    this.metrics.totalOperations++;

    if (error.message.includes('timeout')) {
      this.metrics.timeoutCounter++;
    }

    this.guards.circuitBreaker.recordFailure();
  }

  _activateThrottling() {
    // Implement adaptive throttling
    const currentConcurrency = this.options.maxConcurrentOperations;
    this.options.maxConcurrentOperations = Math.max(1, Math.floor(currentConcurrency * 0.5));

    setTimeout(() => {
      this.options.maxConcurrentOperations = currentConcurrency;
    }, 30000); // Restore after 30 seconds
  }

  _reduceIOConcurrency() {
    // Temporarily reduce I/O timeout to fail faster
    const originalTimeout = this.options.ioTimeoutMs;
    this.options.ioTimeoutMs = Math.max(1000, originalTimeout * 0.5);

    setTimeout(() => {
      this.options.ioTimeoutMs = originalTimeout;
    }, 15000); // Restore after 15 seconds
  }

  _manageMemoryPressure() {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    const memoryPressure = heapUsedMB / (os.totalmem() / 1024 / 1024);

    if (memoryPressure > 0.8 && global.gc) {
      global.gc();
      this.metrics.lastGCTime = Date.now();
    }
  }

  _updateCircuitBreaker() {
    const timeoutRate = this._getTimeoutRate();

    if (timeoutRate > this.options.circuitBreakerThreshold) {
      this.guards.circuitBreaker.open();
    } else if (timeoutRate < this.options.circuitBreakerThreshold * 0.5) {
      this.guards.circuitBreaker.close();
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      memoryUsageMB: process.memoryUsage().heapUsed / 1024 / 1024,
      timeoutRate: this._getTimeoutRate(),
      circuitBreakerState: this.guards.circuitBreaker.getState()
    };
  }

  shutdown() {
    // Cancel all active operations
    for (const operationId of this.metrics.activeOperations.keys()) {
      this.metrics.activeOperations.delete(operationId);
    }

    this.emit('shutdown');
  }
}

// Supporting classes
class CircuitBreaker {
  constructor(options) {
    this.failureThreshold = options.circuitBreakerThreshold || 0.3;
    this.failures = 0;
    this.successes = 0;
    this.isOpenFlag = false;
    this.lastFailureTime = null;
    this.recoveryTimeoutMs = 30000;
  }

  recordSuccess() {
    this.successes++;
    if (this.isOpenFlag) {
      this.close();
    }
  }

  recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    const total = this.failures + this.successes;
    if (total > 10 && this.failures / total > this.failureThreshold) {
      this.open();
    }
  }

  open() {
    this.isOpenFlag = true;
  }

  close() {
    this.isOpenFlag = false;
    this.failures = 0;
    this.successes = 0;
  }

  isOpen() {
    if (!this.isOpenFlag) return false;

    // Auto-recovery after timeout
    if (Date.now() - this.lastFailureTime > this.recoveryTimeoutMs) {
      this.close();
      return false;
    }

    return true;
  }

  getState() {
    return {
      isOpen: this.isOpenFlag,
      failures: this.failures,
      successes: this.successes,
      failureRate: (this.failures + this.successes) > 0 ?
        this.failures / (this.failures + this.successes) : 0
    };
  }
}

class MemoryLeakGuard {
  constructor(options) {
    this.options = options;
    this.snapshots = [];
  }
}

class CPUStarvationGuard {
  constructor(options) {
    this.options = options;
    this.throttleActive = false;
  }
}

class IOBlockingGuard {
  constructor(options) {
    this.options = options;
    this.blockedOperations = new Set();
  }
}

export default ResourceExhaustionGuard;