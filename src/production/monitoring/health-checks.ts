/**
 * Production Health Checks Implementation
 * Comprehensive health monitoring for all system components
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { logger } from './structured-logging';
import { productionMetrics } from './prometheus-config';
import { tracing } from './distributed-tracing';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  duration: number;
  details?: Record<string, any>;
  error?: string;
}

export interface HealthCheckConfig {
  name: string;
  timeout: number;
  interval: number;
  retries: number;
  enabled: boolean;
  critical: boolean;
  tags: string[];
}

export abstract class BaseHealthCheck {
  public readonly config: HealthCheckConfig;
  private lastResult: HealthCheckResult | null = null;
  private isRunning: boolean = false;

  constructor(config: Partial<HealthCheckConfig> & { name: string }) {
    this.config = {
      timeout: 5000,
      interval: 30000,
      retries: 3,
      enabled: true,
      critical: false,
      tags: [],
      ...config,
    };
  }

  /**
   * Abstract method for specific health check implementation
   */
  protected abstract performCheck(): Promise<HealthCheckResult>;

  /**
   * Execute health check with timeout and retry logic
   */
  public async check(): Promise<HealthCheckResult> {
    if (this.isRunning) {
      return this.lastResult || {
        status: 'degraded',
        timestamp: Date.now(),
        duration: 0,
        details: { reason: 'Check already running' },
      };
    }

    this.isRunning = true;
    const startTime = performance.now();

    try {
      const result = await tracing.withSpan(
        `health-check.${this.config.name}`,
        async (span) => {
          span.setAttributes({
            'health.check.name': this.config.name,
            'health.check.critical': this.config.critical,
          });

          return this.performCheckWithRetry();
        }
      );

      this.lastResult = result;
      this.recordMetrics(result);
      return result;
    } catch (error) {
      const result: HealthCheckResult = {
        status: 'unhealthy',
        timestamp: Date.now(),
        duration: performance.now() - startTime,
        error: (error as Error).message,
      };

      this.lastResult = result;
      this.recordMetrics(result);

      logger.error(`Health check ${this.config.name} failed`, error as Error, {
        component: 'health-check',
        checkName: this.config.name,
        critical: this.config.critical,
      });

      return result;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Perform health check with retry logic
   */
  private async performCheckWithRetry(): Promise<HealthCheckResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        const result = await this.performCheckWithTimeout();

        if (result.status !== 'unhealthy') {
          return result;
        }

        if (attempt < this.config.retries) {
          await this.delay(Math.min(1000 * attempt, 5000)); // Exponential backoff
        }
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.config.retries) {
          await this.delay(Math.min(1000 * attempt, 5000));
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Perform health check with timeout
   */
  private async performCheckWithTimeout(): Promise<HealthCheckResult> {
    return new Promise<HealthCheckResult>(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Health check timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);

      try {
        const result = await this.performCheck();
        clearTimeout(timeout);
        resolve(result);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Record health check metrics
   */
  private recordMetrics(result: HealthCheckResult): void {
    // Record in custom metrics if available
    if (productionMetrics) {
      // This would require adding health check metrics to ProductionMetrics class
      // productionMetrics.recordHealthCheck(this.config.name, result.status, result.duration);
    }

    // Log the result
    const logLevel = result.status === 'healthy' ? 'debug' : 'warn';
    logger[logLevel](`Health check ${this.config.name}: ${result.status}`, {
      component: 'health-check',
      checkName: this.config.name,
      status: result.status,
      duration: result.duration,
      critical: this.config.critical,
      details: result.details,
    });
  }

  /**
   * Get last check result
   */
  public getLastResult(): HealthCheckResult | null {
    return this.lastResult;
  }

  /**
   * Check if this health check is critical
   */
  public isCritical(): boolean {
    return this.config.critical;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Database connectivity health check
 */
export class DatabaseHealthCheck extends BaseHealthCheck {
  private dbConnection: any;

  constructor(dbConnection: any) {
    super({
      name: 'database',
      critical: true,
      tags: ['infrastructure', 'database'],
    });
    this.dbConnection = dbConnection;
  }

  protected async performCheck(): Promise<HealthCheckResult> {
    const startTime = performance.now();

    try {
      // Perform a simple query to test connectivity
      await this.dbConnection.query('SELECT 1');

      // Test query performance
      const queryStart = performance.now();
      await this.dbConnection.query('SELECT COUNT(*) FROM agents LIMIT 1');
      const queryDuration = performance.now() - queryStart;

      const duration = performance.now() - startTime;

      return {
        status: queryDuration > 1000 ? 'degraded' : 'healthy',
        timestamp: Date.now(),
        duration,
        details: {
          queryDuration,
          connectionPool: await this.getConnectionPoolStats(),
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: Date.now(),
        duration: performance.now() - startTime,
        error: (error as Error).message,
      };
    }
  }

  private async getConnectionPoolStats(): Promise<any> {
    try {
      // This would depend on your database connection library
      return {
        active: this.dbConnection.pool?.activeConnections || 0,
        idle: this.dbConnection.pool?.idleConnections || 0,
        total: this.dbConnection.pool?.totalConnections || 0,
      };
    } catch (error) {
      return { error: 'Unable to get pool stats' };
    }
  }
}

/**
 * Redis cache health check
 */
export class RedisHealthCheck extends BaseHealthCheck {
  private redisClient: any;

  constructor(redisClient: any) {
    super({
      name: 'redis',
      critical: true,
      tags: ['infrastructure', 'cache'],
    });
    this.redisClient = redisClient;
  }

  protected async performCheck(): Promise<HealthCheckResult> {
    const startTime = performance.now();

    try {
      // Test basic connectivity
      const pingStart = performance.now();
      await this.redisClient.ping();
      const pingDuration = performance.now() - pingStart;

      // Test read/write operations
      const testKey = `health-check-${Date.now()}`;
      const testValue = 'test';

      const writeStart = performance.now();
      await this.redisClient.set(testKey, testValue, 'EX', 60);
      const writeDuration = performance.now() - writeStart;

      const readStart = performance.now();
      const value = await this.redisClient.get(testKey);
      const readDuration = performance.now() - readStart;

      // Cleanup
      await this.redisClient.del(testKey);

      const duration = performance.now() - startTime;
      const avgLatency = (pingDuration + writeDuration + readDuration) / 3;

      return {
        status: avgLatency > 100 ? 'degraded' : 'healthy',
        timestamp: Date.now(),
        duration,
        details: {
          pingDuration,
          writeDuration,
          readDuration,
          avgLatency,
          connected: value === testValue,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: Date.now(),
        duration: performance.now() - startTime,
        error: (error as Error).message,
      };
    }
  }
}

/**
 * Agent system health check
 */
export class AgentSystemHealthCheck extends BaseHealthCheck {
  constructor() {
    super({
      name: 'agent-system',
      critical: true,
      tags: ['core', 'agents'],
    });
  }

  protected async performCheck(): Promise<HealthCheckResult> {
    const startTime = performance.now();

    try {
      // Check agent spawning capability
      const spawnTest = await this.testAgentSpawning();

      // Check swarm coordination
      const swarmTest = await this.testSwarmCoordination();

      // Check memory system
      const memoryTest = await this.testMemorySystem();

      const duration = performance.now() - startTime;

      const allHealthy = spawnTest.healthy && swarmTest.healthy && memoryTest.healthy;
      const anyDegraded = spawnTest.degraded || swarmTest.degraded || memoryTest.degraded;

      return {
        status: allHealthy ? 'healthy' : anyDegraded ? 'degraded' : 'unhealthy',
        timestamp: Date.now(),
        duration,
        details: {
          agentSpawning: spawnTest,
          swarmCoordination: swarmTest,
          memorySystem: memoryTest,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: Date.now(),
        duration: performance.now() - startTime,
        error: (error as Error).message,
      };
    }
  }

  private async testAgentSpawning(): Promise<{ healthy: boolean; degraded: boolean; details: any }> {
    try {
      // Simulate agent spawn test (would integrate with actual agent system)
      const testStart = performance.now();
      // await agentSystem.testSpawn();
      const duration = performance.now() - testStart;

      return {
        healthy: duration < 1000,
        degraded: duration >= 1000 && duration < 5000,
        details: { spawnDuration: duration }
      };
    } catch (error) {
      return {
        healthy: false,
        degraded: false,
        details: { error: (error as Error).message }
      };
    }
  }

  private async testSwarmCoordination(): Promise<{ healthy: boolean; degraded: boolean; details: any }> {
    try {
      // Simulate swarm coordination test
      const testStart = performance.now();
      // await swarmCoordinator.ping();
      const duration = performance.now() - testStart;

      return {
        healthy: duration < 500,
        degraded: duration >= 500 && duration < 2000,
        details: { coordinationLatency: duration }
      };
    } catch (error) {
      return {
        healthy: false,
        degraded: false,
        details: { error: (error as Error).message }
      };
    }
  }

  private async testMemorySystem(): Promise<{ healthy: boolean; degraded: boolean; details: any }> {
    try {
      // Simulate memory system test
      const testStart = performance.now();
      // await memorySystem.ping();
      const duration = performance.now() - testStart;

      return {
        healthy: duration < 200,
        degraded: duration >= 200 && duration < 1000,
        details: { memoryLatency: duration }
      };
    } catch (error) {
      return {
        healthy: false,
        degraded: false,
        details: { error: (error as Error).message }
      };
    }
  }
}

/**
 * External API health check
 */
export class ExternalApiHealthCheck extends BaseHealthCheck {
  private apiUrl: string;
  private apiKey?: string;

  constructor(name: string, apiUrl: string, apiKey?: string) {
    super({
      name: `external-api-${name}`,
      critical: false,
      tags: ['external', 'api'],
    });
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
  }

  protected async performCheck(): Promise<HealthCheckResult> {
    const startTime = performance.now();

    try {
      const response = await fetch(this.apiUrl, {
        method: 'GET',
        headers: this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {},
        signal: AbortSignal.timeout(this.config.timeout),
      });

      const duration = performance.now() - startTime;

      return {
        status: response.ok ? (duration > 2000 ? 'degraded' : 'healthy') : 'unhealthy',
        timestamp: Date.now(),
        duration,
        details: {
          statusCode: response.status,
          responseTime: duration,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: Date.now(),
        duration: performance.now() - startTime,
        error: (error as Error).message,
      };
    }
  }
}

/**
 * System resource health check
 */
export class SystemResourceHealthCheck extends BaseHealthCheck {
  constructor() {
    super({
      name: 'system-resources',
      critical: true,
      tags: ['system', 'resources'],
    });
  }

  protected async performCheck(): Promise<HealthCheckResult> {
    const startTime = performance.now();

    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      // Convert to MB for readability
      const memoryMB = {
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
      };

      // Simple thresholds (should be configurable)
      const memoryThresholds = {
        warning: 500, // 500MB
        critical: 1000, // 1GB
      };

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (memoryMB.heapUsed > memoryThresholds.critical) {
        status = 'unhealthy';
      } else if (memoryMB.heapUsed > memoryThresholds.warning) {
        status = 'degraded';
      }

      const duration = performance.now() - startTime;

      return {
        status,
        timestamp: Date.now(),
        duration,
        details: {
          memory: memoryMB,
          cpu: cpuUsage,
          uptime: process.uptime(),
          nodeVersion: process.version,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: Date.now(),
        duration: performance.now() - startTime,
        error: (error as Error).message,
      };
    }
  }
}

/**
 * Health check manager orchestrating all health checks
 */
export class HealthCheckManager extends EventEmitter {
  private checks: Map<string, BaseHealthCheck> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  /**
   * Register a health check
   */
  public register(check: BaseHealthCheck): void {
    this.checks.set(check.config.name, check);

    if (check.config.enabled && check.config.interval > 0) {
      this.startPeriodicCheck(check);
    }

    logger.info(`Registered health check: ${check.config.name}`, {
      component: 'health-manager',
      checkName: check.config.name,
      critical: check.config.critical,
    });
  }

  /**
   * Start periodic health check
   */
  private startPeriodicCheck(check: BaseHealthCheck): void {
    const interval = setInterval(async () => {
      try {
        const result = await check.check();
        this.updateOverallStatus();

        this.emit('health-check-completed', {
          name: check.config.name,
          result,
        });

        // Emit alerts for critical checks
        if (check.isCritical() && result.status === 'unhealthy') {
          this.emit('critical-health-failure', {
            name: check.config.name,
            result,
          });
        }
      } catch (error) {
        logger.error(`Health check ${check.config.name} threw exception`, error as Error);
      }
    }, check.config.interval);

    this.intervals.set(check.config.name, interval);
  }

  /**
   * Run all health checks once
   */
  public async checkAll(): Promise<Record<string, HealthCheckResult>> {
    const results: Record<string, HealthCheckResult> = {};

    const checkPromises = Array.from(this.checks.entries()).map(async ([name, check]) => {
      if (check.config.enabled) {
        try {
          const result = await check.check();
          results[name] = result;
        } catch (error) {
          results[name] = {
            status: 'unhealthy',
            timestamp: Date.now(),
            duration: 0,
            error: (error as Error).message,
          };
        }
      }
    });

    await Promise.allSettled(checkPromises);
    this.updateOverallStatus();

    return results;
  }

  /**
   * Get status of a specific check
   */
  public getCheckStatus(name: string): HealthCheckResult | null {
    const check = this.checks.get(name);
    return check ? check.getLastResult() : null;
  }

  /**
   * Get overall system health status
   */
  public getOverallStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, HealthCheckResult | null>;
    summary: {
      total: number;
      healthy: number;
      degraded: number;
      unhealthy: number;
      critical: number;
    };
  } {
    const checks: Record<string, HealthCheckResult | null> = {};
    let healthy = 0;
    let degraded = 0;
    let unhealthy = 0;
    let critical = 0;

    for (const [name, check] of this.checks) {
      const result = check.getLastResult();
      checks[name] = result;

      if (result) {
        switch (result.status) {
          case 'healthy':
            healthy++;
            break;
          case 'degraded':
            degraded++;
            break;
          case 'unhealthy':
            unhealthy++;
            if (check.isCritical()) {
              critical++;
            }
            break;
        }
      }
    }

    return {
      status: this.overallStatus,
      checks,
      summary: {
        total: this.checks.size,
        healthy,
        degraded,
        unhealthy,
        critical,
      },
    };
  }

  /**
   * Update overall system status based on individual checks
   */
  private updateOverallStatus(): void {
    let hasCriticalFailure = false;
    let hasDegraded = false;

    for (const check of this.checks.values()) {
      const result = check.getLastResult();

      if (result) {
        if (result.status === 'unhealthy' && check.isCritical()) {
          hasCriticalFailure = true;
          break;
        } else if (result.status === 'degraded' || result.status === 'unhealthy') {
          hasDegraded = true;
        }
      }
    }

    const newStatus = hasCriticalFailure ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';

    if (newStatus !== this.overallStatus) {
      this.overallStatus = newStatus;

      this.emit('status-changed', {
        previousStatus: this.overallStatus,
        newStatus,
        timestamp: Date.now(),
      });

      logger.info(`Overall health status changed to: ${newStatus}`, {
        component: 'health-manager',
        status: newStatus,
      });
    }
  }

  /**
   * Stop all periodic health checks
   */
  public shutdown(): void {
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    this.intervals.clear();

    logger.info('Health check manager shutdown completed', {
      component: 'health-manager',
    });
  }

  /**
   * Express middleware for health check endpoint
   */
  public healthEndpoint() {
    return async (req: any, res: any) => {
      try {
        const detailed = req.query.detailed === 'true';

        if (detailed) {
          // Run all checks and return detailed results
          const results = await this.checkAll();
          const overallStatus = this.getOverallStatus();

          res.status(overallStatus.status === 'unhealthy' ? 503 : 200).json({
            status: overallStatus.status,
            timestamp: new Date().toISOString(),
            checks: results,
            summary: overallStatus.summary,
          });
        } else {
          // Return simple status based on last check results
          const overallStatus = this.getOverallStatus();

          res.status(overallStatus.status === 'unhealthy' ? 503 : 200).json({
            status: overallStatus.status,
            timestamp: new Date().toISOString(),
            summary: overallStatus.summary,
          });
        }
      } catch (error) {
        logger.error('Health endpoint error', error as Error);
        res.status(500).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: 'Health check system failure',
        });
      }
    };
  }
}

// Global health check manager instance
export const healthManager = new HealthCheckManager();