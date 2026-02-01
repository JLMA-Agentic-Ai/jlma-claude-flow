/**
 * Boundary Condition Validator
 *
 * Implements robust boundary validation and integration safety
 * to prevent silent failures and boundary vulnerabilities.
 * Includes circuit breakers, health checks, and failsafe mechanisms.
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import { performance } from 'perf_hooks';

export class BoundaryConditionValidator extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      healthCheckIntervalMs: options.healthCheckIntervalMs || 30000,
      circuitBreakerTimeoutMs: options.circuitBreakerTimeoutMs || 60000,
      maxRetryAttempts: options.maxRetryAttempts || 3,
      failureThreshold: options.failureThreshold || 0.5,
      responseTimeThresholdMs: options.responseTimeThresholdMs || 5000,
      dataIntegrityChecks: options.dataIntegrityChecks !== false,
      enableSilentFailureDetection: options.enableSilentFailureDetection !== false,
      boundaryTimeoutMs: options.boundaryTimeoutMs || 10000,
      ...options
    };

    // Boundary monitoring
    this.boundaries = new Map(); // BoundaryId -> BoundaryConfig
    this.circuitBreakers = new Map(); // BoundaryId -> CircuitBreaker
    this.healthChecks = new Map(); // BoundaryId -> HealthStatus
    this.integrationMetrics = new Map(); // BoundaryId -> Metrics

    // Validation chains
    this.validationChains = new Map(); // ChainId -> ValidationChain
    this.failurePatterns = new Map(); // Pattern -> FailureSignature

    // Silent failure detection
    this.silentFailureDetectors = new Map(); // BoundaryId -> SilentFailureDetector

    this._initializeBoundaryMonitoring();
  }

  _initializeBoundaryMonitoring() {
    // Health check scheduler
    setInterval(() => this._runHealthChecks(), this.options.healthCheckIntervalMs);

    // Circuit breaker maintenance
    setInterval(() => this._maintainCircuitBreakers(), 5000);

    // Silent failure detection
    setInterval(() => this._detectSilentFailures(), 10000);

    // Boundary stress testing
    setInterval(() => this._performBoundaryStressTest(), 300000); // 5 minutes

    // Failure pattern analysis
    setInterval(() => this._analyzeFailurePatterns(), 60000);
  }

  /**
   * Register a system boundary with validation rules
   */
  registerBoundary(boundaryId, config) {
    const boundaryConfig = {
      id: boundaryId,
      name: config.name,
      type: config.type || 'external', // 'internal', 'external', 'database', 'api'
      endpoint: config.endpoint,
      timeout: config.timeout || this.options.boundaryTimeoutMs,
      validationRules: config.validationRules || [],
      healthCheckConfig: config.healthCheck || {},
      circuitBreakerConfig: {
        failureThreshold: config.failureThreshold || this.options.failureThreshold,
        timeout: config.circuitBreakerTimeout || this.options.circuitBreakerTimeoutMs,
        ...config.circuitBreakerConfig
      },
      retryPolicy: {
        maxAttempts: config.maxRetryAttempts || this.options.maxRetryAttempts,
        backoffStrategy: config.backoffStrategy || 'exponential',
        ...config.retryPolicy
      },
      dataIntegrityChecks: config.dataIntegrityChecks || [],
      silentFailurePatterns: config.silentFailurePatterns || [],
      ...config
    };

    this.boundaries.set(boundaryId, boundaryConfig);
    this.circuitBreakers.set(boundaryId, new BoundaryCircuitBreaker(boundaryConfig.circuitBreakerConfig));
    this.healthChecks.set(boundaryId, { status: 'unknown', lastCheck: null });
    this.integrationMetrics.set(boundaryId, new IntegrationMetrics());

    if (this.options.enableSilentFailureDetection) {
      this.silentFailureDetectors.set(boundaryId,
        new SilentFailureDetector(boundaryConfig.silentFailurePatterns)
      );
    }

    this.emit('boundaryRegistered', { boundaryId, config: boundaryConfig });

    return boundaryConfig;
  }

  /**
   * Execute operation through boundary with full protection
   */
  async executeThroughBoundary(boundaryId, operation, data = null, options = {}) {
    const boundary = this.boundaries.get(boundaryId);
    if (!boundary) {
      throw new BoundaryError(`Boundary ${boundaryId} not registered`, 'BOUNDARY_NOT_FOUND');
    }

    const circuitBreaker = this.circuitBreakers.get(boundaryId);
    const metrics = this.integrationMetrics.get(boundaryId);
    const operationId = this._generateOperationId();

    // Check circuit breaker
    if (circuitBreaker.isOpen()) {
      metrics.recordCircuitBreakerOpen();
      throw new BoundaryError(
        `Circuit breaker open for boundary ${boundaryId}`,
        'CIRCUIT_BREAKER_OPEN'
      );
    }

    const startTime = performance.now();

    try {
      // Pre-execution validation
      await this._validateBoundaryConditions(boundary, data, 'pre');

      // Execute with timeout and retry
      const result = await this._executeWithRetry(
        boundaryId,
        operation,
        data,
        boundary.retryPolicy,
        options
      );

      // Post-execution validation
      await this._validateBoundaryConditions(boundary, result, 'post');

      // Record successful execution
      const duration = performance.now() - startTime;
      metrics.recordSuccess(duration);
      circuitBreaker.recordSuccess();

      // Silent failure detection
      if (this.options.enableSilentFailureDetection) {
        this._checkForSilentFailure(boundaryId, result, duration);
      }

      this.emit('boundaryOperationSuccess', {
        boundaryId,
        operationId,
        duration,
        dataSize: this._getDataSize(result)
      });

      return result;

    } catch (error) {
      const duration = performance.now() - startTime;
      metrics.recordFailure(duration, error);
      circuitBreaker.recordFailure();

      // Analyze failure pattern
      this._recordFailurePattern(boundaryId, error, data, duration);

      this.emit('boundaryOperationFailure', {
        boundaryId,
        operationId,
        error: error.message,
        duration
      });

      throw new BoundaryError(
        `Boundary operation failed: ${error.message}`,
        'OPERATION_FAILED',
        { originalError: error, boundaryId, operationId }
      );
    }
  }

  /**
   * Batch boundary operations with transaction semantics
   */
  async executeBoundaryTransaction(operations, options = {}) {
    const transactionId = this._generateOperationId();
    const executedOperations = [];
    const rollbackActions = [];

    try {
      // Phase 1: Validation
      for (const op of operations) {
        const boundary = this.boundaries.get(op.boundaryId);
        if (!boundary) {
          throw new BoundaryError(`Boundary ${op.boundaryId} not registered`, 'BOUNDARY_NOT_FOUND');
        }

        await this._validateBoundaryConditions(boundary, op.data, 'pre');
      }

      // Phase 2: Execution with rollback tracking
      for (const op of operations) {
        const result = await this.executeThroughBoundary(
          op.boundaryId,
          op.operation,
          op.data,
          { ...options, transactionId }
        );

        executedOperations.push({ ...op, result });

        // Track rollback action if provided
        if (op.rollbackAction) {
          rollbackActions.push({
            action: op.rollbackAction,
            data: result,
            boundaryId: op.boundaryId
          });
        }
      }

      this.emit('boundaryTransactionSuccess', {
        transactionId,
        operationCount: operations.length
      });

      return {
        transactionId,
        success: true,
        results: executedOperations
      };

    } catch (error) {
      // Phase 3: Rollback on failure
      await this._performRollback(rollbackActions, transactionId);

      this.emit('boundaryTransactionFailure', {
        transactionId,
        error: error.message,
        completedOperations: executedOperations.length
      });

      throw new BoundaryError(
        `Boundary transaction failed: ${error.message}`,
        'TRANSACTION_FAILED',
        { transactionId, error }
      );
    }
  }

  /**
   * Health check for boundary
   */
  async checkBoundaryHealth(boundaryId) {
    const boundary = this.boundaries.get(boundaryId);
    if (!boundary) {
      throw new BoundaryError(`Boundary ${boundaryId} not registered`, 'BOUNDARY_NOT_FOUND');
    }

    const startTime = performance.now();

    try {
      let healthResult;

      if (boundary.healthCheckConfig.customCheck) {
        healthResult = await boundary.healthCheckConfig.customCheck();
      } else {
        healthResult = await this._performDefaultHealthCheck(boundary);
      }

      const duration = performance.now() - startTime;

      const healthStatus = {
        status: 'healthy',
        lastCheck: Date.now(),
        responseTime: duration,
        details: healthResult
      };

      this.healthChecks.set(boundaryId, healthStatus);

      this.emit('boundaryHealthCheck', { boundaryId, status: healthStatus });

      return healthStatus;

    } catch (error) {
      const duration = performance.now() - startTime;

      const healthStatus = {
        status: 'unhealthy',
        lastCheck: Date.now(),
        responseTime: duration,
        error: error.message
      };

      this.healthChecks.set(boundaryId, healthStatus);

      this.emit('boundaryHealthCheck', { boundaryId, status: healthStatus });

      return healthStatus;
    }
  }

  /**
   * Validate boundary conditions
   */
  async _validateBoundaryConditions(boundary, data, phase) {
    const relevantRules = boundary.validationRules.filter(rule =>
      !rule.phase || rule.phase === phase
    );

    for (const rule of relevantRules) {
      try {
        const isValid = await this._executeValidationRule(rule, data);

        if (!isValid) {
          throw new BoundaryError(
            `Validation failed: ${rule.name || 'unknown rule'}`,
            'VALIDATION_FAILED',
            { rule, data }
          );
        }
      } catch (error) {
        if (rule.required !== false) {
          throw error;
        }
        // Optional validation failed - log but continue
        this.emit('validationWarning', {
          boundary: boundary.id,
          rule: rule.name,
          error: error.message
        });
      }
    }

    // Data integrity checks
    if (this.options.dataIntegrityChecks && boundary.dataIntegrityChecks) {
      await this._performDataIntegrityChecks(boundary, data);
    }
  }

  async _executeValidationRule(rule, data) {
    switch (rule.type) {
      case 'schema':
        return this._validateSchema(rule.schema, data);

      case 'range':
        return this._validateRange(rule.min, rule.max, data);

      case 'format':
        return this._validateFormat(rule.pattern, data);

      case 'custom':
        return rule.validator(data);

      case 'checksum':
        return this._validateChecksum(rule.algorithm, rule.expectedChecksum, data);

      case 'size':
        return this._validateSize(rule.maxSize, data);

      default:
        throw new BoundaryError(`Unknown validation rule type: ${rule.type}`, 'INVALID_RULE');
    }
  }

  async _executeWithRetry(boundaryId, operation, data, retryPolicy, options) {
    let lastError;
    let attempt = 0;

    while (attempt <= retryPolicy.maxAttempts) {
      try {
        // Execute with timeout
        return await this._executeWithTimeout(operation, data, options);

      } catch (error) {
        lastError = error;
        attempt++;

        if (attempt > retryPolicy.maxAttempts) {
          break;
        }

        if (!this._isRetryableError(error)) {
          throw error;
        }

        // Calculate backoff delay
        const delay = this._calculateBackoffDelay(attempt, retryPolicy);
        await new Promise(resolve => setTimeout(resolve, delay));

        this.emit('boundaryRetry', {
          boundaryId,
          attempt,
          error: error.message,
          nextDelay: delay
        });
      }
    }

    throw lastError;
  }

  async _executeWithTimeout(operation, data, options) {
    const timeout = options.timeout || this.options.boundaryTimeoutMs;

    return Promise.race([
      Promise.resolve(operation(data)),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new BoundaryError('Operation timeout', 'TIMEOUT'));
        }, timeout);
      })
    ]);
  }

  _checkForSilentFailure(boundaryId, result, duration) {
    const detector = this.silentFailureDetectors.get(boundaryId);
    if (!detector) return;

    const isSilentFailure = detector.analyze(result, duration);

    if (isSilentFailure) {
      this.emit('silentFailureDetected', {
        boundaryId,
        result,
        duration,
        patterns: detector.getMatchedPatterns()
      });

      // Automatically trigger health check
      this.checkBoundaryHealth(boundaryId).catch(() => {
        // Health check failed - circuit breaker should handle
      });
    }
  }

  async _performRollback(rollbackActions, transactionId) {
    const rollbackResults = [];

    for (let i = rollbackActions.length - 1; i >= 0; i--) {
      const rollbackAction = rollbackActions[i];

      try {
        await rollbackAction.action(rollbackAction.data);
        rollbackResults.push({ success: true, action: i });
      } catch (error) {
        rollbackResults.push({ success: false, action: i, error: error.message });

        this.emit('rollbackFailure', {
          transactionId,
          action: i,
          error: error.message
        });
      }
    }

    return rollbackResults;
  }

  async _runHealthChecks() {
    const healthPromises = Array.from(this.boundaries.keys()).map(boundaryId =>
      this.checkBoundaryHealth(boundaryId).catch(error => ({
        boundaryId,
        error: error.message
      }))
    );

    const results = await Promise.allSettled(healthPromises);

    this.emit('healthCheckCycle', {
      total: this.boundaries.size,
      results: results.map(r => r.status === 'fulfilled' ? r.value : r.reason)
    });
  }

  _maintainCircuitBreakers() {
    for (const [boundaryId, circuitBreaker] of this.circuitBreakers) {
      const previousState = circuitBreaker.getState();
      circuitBreaker.maintain();
      const newState = circuitBreaker.getState();

      if (previousState !== newState) {
        this.emit('circuitBreakerStateChange', {
          boundaryId,
          previousState,
          newState,
          metrics: circuitBreaker.getMetrics()
        });
      }
    }
  }

  _detectSilentFailures() {
    if (!this.options.enableSilentFailureDetection) return;

    for (const [boundaryId, detector] of this.silentFailureDetectors) {
      const anomalies = detector.detectAnomalies();

      if (anomalies.length > 0) {
        this.emit('silentFailureAnomalies', {
          boundaryId,
          anomalies
        });
      }
    }
  }

  async _performBoundaryStressTest() {
    for (const [boundaryId, boundary] of this.boundaries) {
      if (boundary.enableStressTesting === false) continue;

      try {
        await this._stresTestBoundary(boundaryId);
      } catch (error) {
        this.emit('stressTestFailure', {
          boundaryId,
          error: error.message
        });
      }
    }
  }

  async _stresTestBoundary(boundaryId) {
    const testOperations = Array(10).fill(null).map(() =>
      this.executeThroughBoundary(boundaryId, async () => ({ test: true }), null, {
        timeout: 1000
      })
    );

    const results = await Promise.allSettled(testOperations);
    const failureRate = results.filter(r => r.status === 'rejected').length / results.length;

    if (failureRate > 0.3) {
      this.emit('boundaryStressTestFailed', {
        boundaryId,
        failureRate,
        totalTests: results.length
      });
    }
  }

  _analyzeFailurePatterns() {
    for (const [pattern, signatures] of this.failurePatterns) {
      if (signatures.length >= 3) {
        // Look for common failure patterns
        const recentFailures = signatures.filter(
          sig => Date.now() - sig.timestamp < 300000 // 5 minutes
        );

        if (recentFailures.length >= 2) {
          this.emit('failurePatternDetected', {
            pattern,
            recentFailures: recentFailures.length,
            totalFailures: signatures.length
          });
        }
      }
    }

    // Cleanup old patterns
    this._cleanupOldFailurePatterns();
  }

  _recordFailurePattern(boundaryId, error, data, duration) {
    const pattern = this._generateFailurePattern(boundaryId, error);

    if (!this.failurePatterns.has(pattern)) {
      this.failurePatterns.set(pattern, []);
    }

    this.failurePatterns.get(pattern).push({
      timestamp: Date.now(),
      error: error.message,
      boundaryId,
      duration,
      dataHash: data ? crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex') : null
    });
  }

  _generateFailurePattern(boundaryId, error) {
    return `${boundaryId}:${error.constructor.name}:${error.message.substring(0, 50)}`;
  }

  _cleanupOldFailurePatterns() {
    const cutoff = Date.now() - 3600000; // 1 hour

    for (const [pattern, signatures] of this.failurePatterns) {
      const recentSignatures = signatures.filter(sig => sig.timestamp > cutoff);

      if (recentSignatures.length === 0) {
        this.failurePatterns.delete(pattern);
      } else {
        this.failurePatterns.set(pattern, recentSignatures);
      }
    }
  }

  async _performDefaultHealthCheck(boundary) {
    if (boundary.type === 'api' && boundary.endpoint) {
      // Basic HTTP health check
      const response = await fetch(`${boundary.endpoint}/health`, {
        method: 'GET',
        timeout: 3000
      });

      return {
        status: response.ok ? 'healthy' : 'unhealthy',
        statusCode: response.status,
        responseTime: Date.now()
      };
    }

    // Default ping-style check
    return { status: 'healthy', check: 'default' };
  }

  _validateSchema(schema, data) {
    // Basic schema validation - integrate with your preferred validator
    if (typeof schema === 'object' && schema.required) {
      for (const field of schema.required) {
        if (!(field in data)) {
          return false;
        }
      }
    }
    return true;
  }

  _validateRange(min, max, data) {
    if (typeof data === 'number') {
      return data >= min && data <= max;
    }
    return true;
  }

  _validateFormat(pattern, data) {
    if (typeof data === 'string' && pattern) {
      return new RegExp(pattern).test(data);
    }
    return true;
  }

  _validateChecksum(algorithm, expectedChecksum, data) {
    const hash = crypto.createHash(algorithm).update(JSON.stringify(data)).digest('hex');
    return hash === expectedChecksum;
  }

  _validateSize(maxSize, data) {
    const size = JSON.stringify(data).length;
    return size <= maxSize;
  }

  async _performDataIntegrityChecks(boundary, data) {
    for (const check of boundary.dataIntegrityChecks) {
      const isValid = await this._executeValidationRule(check, data);

      if (!isValid) {
        throw new BoundaryError(
          `Data integrity check failed: ${check.name}`,
          'INTEGRITY_CHECK_FAILED'
        );
      }
    }
  }

  _isRetryableError(error) {
    const retryablePatterns = [
      'TIMEOUT',
      'CONNECTION_REFUSED',
      'NETWORK_ERROR',
      'SERVICE_UNAVAILABLE',
      'TEMPORARY_FAILURE'
    ];

    return retryablePatterns.some(pattern =>
      error.message.includes(pattern) || error.code === pattern
    );
  }

  _calculateBackoffDelay(attempt, retryPolicy) {
    const baseDelay = retryPolicy.baseDelay || 1000;

    switch (retryPolicy.backoffStrategy) {
      case 'linear':
        return baseDelay * attempt;

      case 'exponential':
        return baseDelay * Math.pow(2, attempt - 1);

      case 'fibonacci':
        return baseDelay * this._fibonacci(attempt);

      default:
        return baseDelay;
    }
  }

  _fibonacci(n) {
    if (n <= 1) return n;
    return this._fibonacci(n - 1) + this._fibonacci(n - 2);
  }

  _generateOperationId() {
    return `op_${Date.now()}_${crypto.randomUUID()}`;
  }

  _getDataSize(data) {
    return data ? JSON.stringify(data).length : 0;
  }

  getBoundaryMetrics(boundaryId) {
    if (boundaryId) {
      const metrics = this.integrationMetrics.get(boundaryId);
      const circuitBreaker = this.circuitBreakers.get(boundaryId);
      const health = this.healthChecks.get(boundaryId);

      return {
        metrics: metrics?.getMetrics(),
        circuitBreaker: circuitBreaker?.getMetrics(),
        health
      };
    }

    // Return all boundaries
    const allMetrics = {};

    for (const boundaryId of this.boundaries.keys()) {
      allMetrics[boundaryId] = this.getBoundaryMetrics(boundaryId);
    }

    return allMetrics;
  }

  getAllBoundaries() {
    return Array.from(this.boundaries.values());
  }

  shutdown() {
    // Clear all intervals and clean up
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.shutdown();
    }

    this.boundaries.clear();
    this.circuitBreakers.clear();
    this.healthChecks.clear();
    this.integrationMetrics.clear();
    this.silentFailureDetectors.clear();

    this.emit('shutdown');
  }
}

// Supporting classes
class BoundaryCircuitBreaker {
  constructor(config) {
    this.config = config;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.lastStateChange = Date.now();
  }

  recordSuccess() {
    this.successes++;

    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.failures = 0;
      this.lastStateChange = Date.now();
    }
  }

  recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    const failureRate = this.failures / (this.failures + this.successes);

    if (failureRate >= this.config.failureThreshold && this.state === 'CLOSED') {
      this.state = 'OPEN';
      this.lastStateChange = Date.now();
    }
  }

  isOpen() {
    if (this.state === 'OPEN') {
      // Check if enough time has passed to try half-open
      if (Date.now() - this.lastStateChange >= this.config.timeout) {
        this.state = 'HALF_OPEN';
        this.lastStateChange = Date.now();
        return false;
      }
      return true;
    }

    return false;
  }

  getState() {
    return this.state;
  }

  getMetrics() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      failureRate: (this.failures + this.successes) > 0 ?
        this.failures / (this.failures + this.successes) : 0,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange
    };
  }

  maintain() {
    // Automatic state maintenance if needed
  }

  shutdown() {
    // Cleanup
  }
}

class IntegrationMetrics {
  constructor() {
    this.totalOperations = 0;
    this.successfulOperations = 0;
    this.failedOperations = 0;
    this.totalResponseTime = 0;
    this.maxResponseTime = 0;
    this.minResponseTime = Infinity;
    this.circuitBreakerOpenCount = 0;
    this.errorTypes = new Map();
  }

  recordSuccess(duration) {
    this.totalOperations++;
    this.successfulOperations++;
    this._recordResponseTime(duration);
  }

  recordFailure(duration, error) {
    this.totalOperations++;
    this.failedOperations++;
    this._recordResponseTime(duration);

    const errorType = error.constructor.name;
    this.errorTypes.set(errorType, (this.errorTypes.get(errorType) || 0) + 1);
  }

  recordCircuitBreakerOpen() {
    this.circuitBreakerOpenCount++;
  }

  _recordResponseTime(duration) {
    this.totalResponseTime += duration;
    this.maxResponseTime = Math.max(this.maxResponseTime, duration);
    this.minResponseTime = Math.min(this.minResponseTime, duration);
  }

  getMetrics() {
    return {
      totalOperations: this.totalOperations,
      successfulOperations: this.successfulOperations,
      failedOperations: this.failedOperations,
      successRate: this.totalOperations > 0 ?
        this.successfulOperations / this.totalOperations : 0,
      averageResponseTime: this.totalOperations > 0 ?
        this.totalResponseTime / this.totalOperations : 0,
      maxResponseTime: this.maxResponseTime === 0 ? 0 : this.maxResponseTime,
      minResponseTime: this.minResponseTime === Infinity ? 0 : this.minResponseTime,
      circuitBreakerOpenCount: this.circuitBreakerOpenCount,
      errorTypes: Object.fromEntries(this.errorTypes)
    };
  }
}

class SilentFailureDetector {
  constructor(patterns = []) {
    this.patterns = patterns;
    this.responseHistory = [];
    this.matchedPatterns = [];
  }

  analyze(result, duration) {
    this.responseHistory.push({
      result: this._hashResult(result),
      duration,
      timestamp: Date.now()
    });

    // Keep only recent history
    const cutoff = Date.now() - 300000; // 5 minutes
    this.responseHistory = this.responseHistory.filter(r => r.timestamp > cutoff);

    // Check for silent failure patterns
    for (const pattern of this.patterns) {
      if (this._matchesPattern(pattern, result, duration)) {
        this.matchedPatterns.push({
          pattern: pattern.name,
          timestamp: Date.now()
        });
        return true;
      }
    }

    return false;
  }

  detectAnomalies() {
    const anomalies = [];

    if (this.responseHistory.length >= 10) {
      // Check for response time anomalies
      const durations = this.responseHistory.map(r => r.duration);
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const stdDev = Math.sqrt(
        durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length
      );

      if (stdDev > avgDuration * 0.5) {
        anomalies.push({
          type: 'RESPONSE_TIME_ANOMALY',
          severity: 'medium',
          details: { avgDuration, stdDev }
        });
      }

      // Check for identical responses (potential silent failure)
      const uniqueResponses = new Set(this.responseHistory.map(r => r.result));
      if (uniqueResponses.size === 1 && this.responseHistory.length > 5) {
        anomalies.push({
          type: 'IDENTICAL_RESPONSES',
          severity: 'high',
          details: { responseCount: this.responseHistory.length }
        });
      }
    }

    return anomalies;
  }

  getMatchedPatterns() {
    return this.matchedPatterns.slice(-10); // Return last 10 matches
  }

  _matchesPattern(pattern, result, duration) {
    switch (pattern.type) {
      case 'empty_response':
        return !result || Object.keys(result).length === 0;

      case 'slow_response':
        return duration > pattern.threshold;

      case 'error_code':
        return result && result.errorCode === pattern.code;

      case 'missing_field':
        return result && !result.hasOwnProperty(pattern.field);

      default:
        return false;
    }
  }

  _hashResult(result) {
    return crypto.createHash('sha256').update(JSON.stringify(result)).digest('hex');
  }
}

class BoundaryError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'BoundaryError';
    this.code = code;
    this.details = details;
  }
}

export { BoundaryConditionValidator as default, BoundaryError };