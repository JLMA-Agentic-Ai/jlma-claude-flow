/**
 * Production Structured Logging Implementation
 * Comprehensive logging with correlation IDs, structured output, and performance tracking
 */

import winston from 'winston';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

// Request context storage for correlation IDs
const correlationContext = new AsyncLocalStorage<{
  correlationId: string;
  userId?: string;
  agentId?: string;
  swarmId?: string;
  taskId?: string;
}>();

export interface LogContext {
  correlationId?: string;
  userId?: string;
  agentId?: string;
  swarmId?: string;
  taskId?: string;
  component?: string;
  operation?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export class ProductionLogger {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss.SSS'
        }),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(this.formatLogEntry.bind(this))
      ),
      defaultMeta: {
        service: 'ais-production',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        hostname: process.env.HOSTNAME || 'localhost',
        pid: process.pid
      },
      transports: [
        // Console output for development
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),

        // File output for production
        new winston.transports.File({
          filename: '/var/log/ais/error.log',
          level: 'error',
          format: winston.format.json()
        }),
        new winston.transports.File({
          filename: '/var/log/ais/combined.log',
          format: winston.format.json()
        }),

        // Separate files for different log types
        new winston.transports.File({
          filename: '/var/log/ais/audit.log',
          level: 'info',
          format: winston.format.json(),
          // Only log entries with audit: true
          filter: (info: any) => info.audit === true
        }),
        new winston.transports.File({
          filename: '/var/log/ais/security.log',
          level: 'warn',
          format: winston.format.json(),
          // Only log security-related entries
          filter: (info: any) => info.security === true
        }),
        new winston.transports.File({
          filename: '/var/log/ais/performance.log',
          level: 'info',
          format: winston.format.json(),
          // Only log performance metrics
          filter: (info: any) => info.performance === true
        })
      ],

      // Handle uncaught exceptions and rejections
      exceptionHandlers: [
        new winston.transports.File({ filename: '/var/log/ais/exceptions.log' })
      ],
      rejectionHandlers: [
        new winston.transports.File({ filename: '/var/log/ais/rejections.log' })
      ]
    });

    // Add ELK Stack transport for production
    if (process.env.ELASTICSEARCH_URL) {
      // Note: Would require '@elastic/winston-elasticsearch' package
      // this.addElasticsearchTransport();
    }

    // Add Datadog transport for production
    if (process.env.DATADOG_API_KEY) {
      // Note: Would require custom Datadog transport
      // this.addDatadogTransport();
    }
  }

  /**
   * Format log entry with correlation context
   */
  private formatLogEntry(info: any): string {
    const context = correlationContext.getStore();
    const baseEntry = {
      timestamp: info.timestamp,
      level: info.level,
      message: info.message,
      service: info.service,
      version: info.version,
      environment: info.environment,
      hostname: info.hostname,
      pid: info.pid,
      ...context,
      ...info
    };

    // Remove winston-specific fields
    delete baseEntry.level;
    delete baseEntry.timestamp;

    return JSON.stringify(baseEntry, null, 0);
  }

  /**
   * Create correlation context for request tracking
   */
  public withCorrelationId<T>(
    context: Partial<LogContext>,
    callback: () => T
  ): T {
    const correlationId = context.correlationId || randomUUID();
    const fullContext = { correlationId, ...context };
    return correlationContext.run(fullContext, callback);
  }

  /**
   * Express middleware for request correlation
   */
  public correlationMiddleware() {
    return (req: any, res: any, next: any) => {
      const correlationId = req.headers['x-correlation-id'] || randomUUID();
      const userId = req.user?.id;

      // Store correlation ID in response headers
      res.setHeader('x-correlation-id', correlationId);

      correlationContext.run({ correlationId, userId }, () => {
        this.info('HTTP Request Started', {
          method: req.method,
          url: req.url,
          userAgent: req.headers['user-agent'],
          ip: req.ip,
          audit: true
        });

        const startTime = Date.now();
        res.on('finish', () => {
          const duration = Date.now() - startTime;
          this.info('HTTP Request Completed', {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration,
            contentLength: res.get('content-length'),
            audit: true,
            performance: true
          });
        });

        next();
      });
    };
  }

  /**
   * Info level logging
   */
  public info(message: string, context: LogContext = {}): void {
    this.logger.info(message, this.enrichContext(context));
  }

  /**
   * Warning level logging
   */
  public warn(message: string, context: LogContext = {}): void {
    this.logger.warn(message, this.enrichContext(context));
  }

  /**
   * Error level logging
   */
  public error(message: string, error?: Error, context: LogContext = {}): void {
    const enrichedContext = this.enrichContext(context);

    if (error) {
      enrichedContext.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause
      };
    }

    this.logger.error(message, enrichedContext);
  }

  /**
   * Debug level logging
   */
  public debug(message: string, context: LogContext = {}): void {
    this.logger.debug(message, this.enrichContext(context));
  }

  /**
   * Security event logging
   */
  public security(message: string, context: LogContext & { severity?: 'low' | 'medium' | 'high' | 'critical' } = {}): void {
    this.logger.warn(message, this.enrichContext({
      ...context,
      security: true,
      severity: context.severity || 'medium'
    }));
  }

  /**
   * Audit event logging
   */
  public audit(message: string, context: LogContext = {}): void {
    this.logger.info(message, this.enrichContext({
      ...context,
      audit: true
    }));
  }

  /**
   * Performance metric logging
   */
  public performance(message: string, context: LogContext & { duration: number } = { duration: 0 }): void {
    this.logger.info(message, this.enrichContext({
      ...context,
      performance: true
    }));
  }

  /**
   * Agent-specific logging
   */
  public agent(message: string, agentId: string, agentType: string, context: LogContext = {}): void {
    this.info(message, {
      ...context,
      agentId,
      agentType,
      component: 'agent'
    });
  }

  /**
   * Swarm-specific logging
   */
  public swarm(message: string, swarmId: string, operation: string, context: LogContext = {}): void {
    this.info(message, {
      ...context,
      swarmId,
      operation,
      component: 'swarm'
    });
  }

  /**
   * Task-specific logging
   */
  public task(message: string, taskId: string, taskType: string, context: LogContext = {}): void {
    this.info(message, {
      ...context,
      taskId,
      taskType,
      component: 'task'
    });
  }

  /**
   * Evidence chain logging
   */
  public evidenceChain(
    message: string,
    chainId: string,
    validationType: string,
    result: 'pass' | 'fail' | 'warning',
    confidenceScore: number,
    context: LogContext = {}
  ): void {
    this.info(message, {
      ...context,
      chainId,
      validationType,
      result,
      confidenceScore,
      component: 'evidence-chain',
      audit: true
    });
  }

  /**
   * Performance timer utility
   */
  public timer(label: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.performance(`Timer: ${label}`, { duration, operation: label });
    };
  }

  /**
   * Async operation wrapper with automatic logging
   */
  public async withLogging<T>(
    operation: string,
    callback: () => Promise<T>,
    context: LogContext = {}
  ): Promise<T> {
    const timer = this.timer(operation);
    this.debug(`Starting ${operation}`, context);

    try {
      const result = await callback();
      timer();
      this.debug(`Completed ${operation}`, { ...context, success: true });
      return result;
    } catch (error) {
      timer();
      this.error(`Failed ${operation}`, error as Error, { ...context, success: false });
      throw error;
    }
  }

  /**
   * Enrich log context with current correlation data
   */
  private enrichContext(context: LogContext): LogContext {
    const correlationData = correlationContext.getStore();
    return {
      ...correlationData,
      ...context,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get current correlation ID
   */
  public getCorrelationId(): string | undefined {
    return correlationContext.getStore()?.correlationId;
  }

  /**
   * Create child logger with specific context
   */
  public child(context: LogContext): ProductionLogger {
    const childLogger = new ProductionLogger();
    const originalEnrichContext = childLogger.enrichContext.bind(childLogger);

    childLogger.enrichContext = (logContext: LogContext) => {
      return originalEnrichContext({
        ...context,
        ...logContext
      });
    };

    return childLogger;
  }
}

// Singleton instance for global use
export const logger = new ProductionLogger();

// Specialized loggers for different components
export const agentLogger = logger.child({ component: 'agent' });
export const swarmLogger = logger.child({ component: 'swarm' });
export const taskLogger = logger.child({ component: 'task' });
export const securityLogger = logger.child({ component: 'security' });
export const performanceLogger = logger.child({ component: 'performance' });

/**
 * Utility functions for common logging patterns
 */
export class LoggingUtils {
  /**
   * Log HTTP request/response cycle
   */
  static logHttpRequest(req: any, res: any, duration: number): void {
    logger.audit('HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      contentLength: res.get('content-length')
    });
  }

  /**
   * Log database operation
   */
  static logDatabaseOperation(
    operation: string,
    table: string,
    duration: number,
    recordsAffected?: number
  ): void {
    performanceLogger.info('Database Operation', {
      operation,
      table,
      duration,
      recordsAffected,
      performance: true
    });
  }

  /**
   * Log authentication event
   */
  static logAuthentication(
    userId: string,
    method: string,
    success: boolean,
    ip: string
  ): void {
    securityLogger.security('Authentication Attempt', {
      userId,
      method,
      success,
      ip,
      severity: success ? 'low' : 'medium'
    });
  }

  /**
   * Log rate limiting event
   */
  static logRateLimit(clientId: string, endpoint: string, ip: string): void {
    securityLogger.security('Rate Limit Exceeded', {
      clientId,
      endpoint,
      ip,
      severity: 'medium'
    });
  }

  /**
   * Log security violation
   */
  static logSecurityViolation(
    violationType: string,
    details: Record<string, any>,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'high'
  ): void {
    securityLogger.security('Security Violation Detected', {
      violationType,
      severity,
      metadata: details
    });
  }
}