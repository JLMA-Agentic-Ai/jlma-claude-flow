/**
 * Production Distributed Tracing Implementation
 * OpenTelemetry-based tracing for microservices and agent coordination
 */

import { NodeTracerProvider } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { AsyncLocalStorage } from 'async_hooks';

export interface TraceContext {
  traceId: string;
  spanId: string;
  agentId?: string;
  swarmId?: string;
  taskId?: string;
  userId?: string;
}

export class ProductionTracing {
  private tracer: any;
  private provider: NodeTracerProvider;
  private traceContext = new AsyncLocalStorage<TraceContext>();

  constructor() {
    this.initializeTracing();
  }

  /**
   * Initialize OpenTelemetry tracing
   */
  private initializeTracing(): void {
    // Create resource with service information
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'ais-production',
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
      [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: process.env.HOSTNAME || 'localhost',
    });

    // Create tracer provider
    this.provider = new NodeTracerProvider({
      resource: resource,
    });

    // Configure exporters
    this.setupExporters();

    // Register auto-instrumentations
    registerInstrumentations({
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': {
            enabled: false, // Disable filesystem instrumentation for performance
          },
        }),
      ],
    });

    // Register the provider
    this.provider.register();

    // Get tracer instance
    this.tracer = trace.getTracer('ais-production', process.env.npm_package_version || '1.0.0');
  }

  /**
   * Setup trace exporters for different environments
   */
  private setupExporters(): void {
    // Jaeger exporter for development/staging
    if (process.env.JAEGER_ENDPOINT) {
      const jaegerExporter = new JaegerExporter({
        endpoint: process.env.JAEGER_ENDPOINT,
        username: process.env.JAEGER_USERNAME,
        password: process.env.JAEGER_PASSWORD,
      });

      this.provider.addSpanProcessor(
        new BatchSpanProcessor(jaegerExporter, {
          maxQueueSize: 1000,
          scheduledDelayMillis: 500,
          exportTimeoutMillis: 30000,
          maxExportBatchSize: 100,
        })
      );
    }

    // Console exporter for development
    if (process.env.NODE_ENV === 'development') {
      const { ConsoleSpanExporter } = require('@opentelemetry/sdk-trace-base');
      this.provider.addSpanProcessor(
        new BatchSpanProcessor(new ConsoleSpanExporter())
      );
    }

    // Custom production exporters could be added here
    // e.g., AWS X-Ray, Google Cloud Trace, Datadog APM
  }

  /**
   * Create a new span with automatic context management
   */
  public async withSpan<T>(
    name: string,
    operation: (span: any) => Promise<T>,
    options: {
      kind?: SpanKind;
      attributes?: Record<string, string | number | boolean>;
      parentContext?: any;
    } = {}
  ): Promise<T> {
    const span = this.tracer.startSpan(name, {
      kind: options.kind || SpanKind.INTERNAL,
      attributes: options.attributes,
    }, options.parentContext);

    // Extract trace context
    const spanContext = span.spanContext();
    const traceContext: TraceContext = {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      ...this.traceContext.getStore(),
    };

    try {
      return await this.traceContext.run(traceContext, async () => {
        return await context.with(trace.setSpan(context.active(), span), async () => {
          try {
            const result = await operation(span);
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
          } catch (error) {
            span.recordException(error as Error);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: (error as Error).message,
            });
            throw error;
          } finally {
            span.end();
          }
        });
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create agent execution span
   */
  public async traceAgentExecution<T>(
    agentId: string,
    agentType: string,
    taskId: string,
    operation: (span: any) => Promise<T>
  ): Promise<T> {
    return this.withSpan(
      `agent.execute`,
      operation,
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          'agent.id': agentId,
          'agent.type': agentType,
          'task.id': taskId,
          'component': 'agent',
        },
      }
    );
  }

  /**
   * Create swarm coordination span
   */
  public async traceSwarmCoordination<T>(
    swarmId: string,
    topology: string,
    operation: string,
    callback: (span: any) => Promise<T>
  ): Promise<T> {
    return this.withSpan(
      `swarm.${operation}`,
      callback,
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          'swarm.id': swarmId,
          'swarm.topology': topology,
          'swarm.operation': operation,
          'component': 'swarm',
        },
      }
    );
  }

  /**
   * Create task execution span
   */
  public async traceTaskExecution<T>(
    taskId: string,
    taskType: string,
    callback: (span: any) => Promise<T>
  ): Promise<T> {
    return this.withSpan(
      `task.execute`,
      callback,
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          'task.id': taskId,
          'task.type': taskType,
          'component': 'task',
        },
      }
    );
  }

  /**
   * Create HTTP request span
   */
  public async traceHttpRequest<T>(
    method: string,
    url: string,
    callback: (span: any) => Promise<T>
  ): Promise<T> {
    return this.withSpan(
      `HTTP ${method} ${url}`,
      callback,
      {
        kind: SpanKind.SERVER,
        attributes: {
          'http.method': method,
          'http.url': url,
          'component': 'http',
        },
      }
    );
  }

  /**
   * Create database operation span
   */
  public async traceDatabaseOperation<T>(
    operation: string,
    table: string,
    callback: (span: any) => Promise<T>
  ): Promise<T> {
    return this.withSpan(
      `db.${operation}`,
      callback,
      {
        kind: SpanKind.CLIENT,
        attributes: {
          'db.operation': operation,
          'db.table': table,
          'component': 'database',
        },
      }
    );
  }

  /**
   * Create evidence chain validation span
   */
  public async traceEvidenceValidation<T>(
    chainId: string,
    validationType: string,
    callback: (span: any) => Promise<T>
  ): Promise<T> {
    return this.withSpan(
      `evidence.validate`,
      callback,
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          'evidence.chain_id': chainId,
          'evidence.validation_type': validationType,
          'component': 'evidence-chain',
        },
      }
    );
  }

  /**
   * Create external API call span
   */
  public async traceExternalApi<T>(
    service: string,
    method: string,
    endpoint: string,
    callback: (span: any) => Promise<T>
  ): Promise<T> {
    return this.withSpan(
      `external.${service}`,
      callback,
      {
        kind: SpanKind.CLIENT,
        attributes: {
          'external.service': service,
          'http.method': method,
          'http.url': endpoint,
          'component': 'external-api',
        },
      }
    );
  }

  /**
   * Add custom attributes to current span
   */
  public addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.setAttributes(attributes);
    }
  }

  /**
   * Add event to current span
   */
  public addSpanEvent(name: string, attributes?: Record<string, any>): void {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.addEvent(name, attributes);
    }
  }

  /**
   * Record exception in current span
   */
  public recordException(error: Error): void {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.recordException(error);
      activeSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
    }
  }

  /**
   * Get current trace context
   */
  public getCurrentTraceContext(): TraceContext | undefined {
    return this.traceContext.getStore();
  }

  /**
   * Get trace ID for logging correlation
   */
  public getCurrentTraceId(): string | undefined {
    const activeSpan = trace.getActiveSpan();
    return activeSpan?.spanContext().traceId;
  }

  /**
   * Express middleware for HTTP request tracing
   */
  public tracingMiddleware() {
    return (req: any, res: any, next: any) => {
      const traceId = this.getCurrentTraceId();
      if (traceId) {
        res.setHeader('x-trace-id', traceId);
      }

      this.traceHttpRequest(req.method, req.url, async (span) => {
        // Add request attributes
        span.setAttributes({
          'http.method': req.method,
          'http.url': req.url,
          'http.user_agent': req.headers['user-agent'] || '',
          'http.remote_addr': req.ip,
        });

        // Add user context if available
        if (req.user?.id) {
          span.setAttributes({
            'user.id': req.user.id,
          });
        }

        // Wait for response to complete
        return new Promise<void>((resolve, reject) => {
          res.on('finish', () => {
            span.setAttributes({
              'http.status_code': res.statusCode,
              'http.response_size': res.get('content-length') || 0,
            });

            // Set span status based on HTTP status
            if (res.statusCode >= 400) {
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: `HTTP ${res.statusCode}`,
              });
            } else {
              span.setStatus({ code: SpanStatusCode.OK });
            }

            resolve();
          });

          res.on('error', (error: Error) => {
            span.recordException(error);
            reject(error);
          });

          next();
        });
      }).catch(next);
    };
  }

  /**
   * Shutdown tracing gracefully
   */
  public async shutdown(): Promise<void> {
    await this.provider.shutdown();
  }
}

// Singleton instance for global use
export const tracing = new ProductionTracing();

/**
 * Utility decorators for automatic tracing
 */
export function Traced(spanName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const name = spanName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      return tracing.withSpan(name, async (span) => {
        // Add method information
        span.setAttributes({
          'method.class': target.constructor.name,
          'method.name': propertyKey,
        });

        return originalMethod.apply(this, args);
      });
    };

    return descriptor;
  };
}

/**
 * Utility class for trace correlation
 */
export class TraceCorrelation {
  /**
   * Extract trace context from HTTP headers
   */
  static fromHeaders(headers: Record<string, string>): TraceContext | null {
    const traceId = headers['x-trace-id'];
    const spanId = headers['x-span-id'];

    if (traceId && spanId) {
      return {
        traceId,
        spanId,
        agentId: headers['x-agent-id'],
        swarmId: headers['x-swarm-id'],
        taskId: headers['x-task-id'],
        userId: headers['x-user-id'],
      };
    }

    return null;
  }

  /**
   * Add trace context to HTTP headers
   */
  static toHeaders(context: TraceContext): Record<string, string> {
    const headers: Record<string, string> = {
      'x-trace-id': context.traceId,
      'x-span-id': context.spanId,
    };

    if (context.agentId) headers['x-agent-id'] = context.agentId;
    if (context.swarmId) headers['x-swarm-id'] = context.swarmId;
    if (context.taskId) headers['x-task-id'] = context.taskId;
    if (context.userId) headers['x-user-id'] = context.userId;

    return headers;
  }

  /**
   * Propagate trace context across async boundaries
   */
  static async withPropagation<T>(
    context: TraceContext,
    callback: () => Promise<T>
  ): Promise<T> {
    return tracing['traceContext'].run(context, callback);
  }
}