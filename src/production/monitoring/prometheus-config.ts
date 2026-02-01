/**
 * Production Prometheus Configuration
 * Comprehensive metrics collection and monitoring setup
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

export class ProductionMetrics {
  private registry: Registry;

  // System Performance Metrics
  public readonly httpRequestDuration: Histogram<string>;
  public readonly httpRequestsTotal: Counter<string>;
  public readonly activeConnections: Gauge<string>;
  public readonly memoryUsage: Gauge<string>;
  public readonly cpuUsage: Gauge<string>;

  // AIS-Specific Metrics
  public readonly agentSpawnCount: Counter<string>;
  public readonly agentExecutionTime: Histogram<string>;
  public readonly taskCompletionRate: Counter<string>;
  public readonly evidenceChainValidations: Counter<string>;
  public readonly swarmCoordinationLatency: Histogram<string>;

  // Business Metrics
  public readonly apiResponseTimes: Histogram<string>;
  public readonly errorRates: Counter<string>;
  public readonly throughputRPS: Gauge<string>;
  public readonly concurrentUsers: Gauge<string>;

  // Security Metrics
  public readonly authenticationAttempts: Counter<string>;
  public readonly securityViolations: Counter<string>;
  public readonly rateLimitExceeded: Counter<string>;

  constructor() {
    this.registry = new Registry();

    // Collect default Node.js metrics
    collectDefaultMetrics({
      register: this.registry,
      prefix: 'ais_production_'
    });

    // HTTP Request Metrics
    this.httpRequestDuration = new Histogram({
      name: 'ais_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry]
    });

    this.httpRequestsTotal = new Counter({
      name: 'ais_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry]
    });

    this.activeConnections = new Gauge({
      name: 'ais_active_connections',
      help: 'Number of active connections',
      registers: [this.registry]
    });

    // System Resource Metrics
    this.memoryUsage = new Gauge({
      name: 'ais_memory_usage_bytes',
      help: 'Memory usage in bytes',
      labelNames: ['type'],
      registers: [this.registry]
    });

    this.cpuUsage = new Gauge({
      name: 'ais_cpu_usage_percent',
      help: 'CPU usage percentage',
      registers: [this.registry]
    });

    // AIS-Specific Metrics
    this.agentSpawnCount = new Counter({
      name: 'ais_agent_spawn_total',
      help: 'Total number of agents spawned',
      labelNames: ['agent_type', 'swarm_id', 'success'],
      registers: [this.registry]
    });

    this.agentExecutionTime = new Histogram({
      name: 'ais_agent_execution_duration_seconds',
      help: 'Agent execution duration in seconds',
      labelNames: ['agent_type', 'task_type'],
      buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120, 300],
      registers: [this.registry]
    });

    this.taskCompletionRate = new Counter({
      name: 'ais_task_completion_total',
      help: 'Total completed tasks',
      labelNames: ['task_type', 'success', 'agent_type'],
      registers: [this.registry]
    });

    this.evidenceChainValidations = new Counter({
      name: 'ais_evidence_chain_validations_total',
      help: 'Evidence chain validations performed',
      labelNames: ['validation_type', 'result', 'confidence_level'],
      registers: [this.registry]
    });

    this.swarmCoordinationLatency = new Histogram({
      name: 'ais_swarm_coordination_latency_seconds',
      help: 'Swarm coordination latency in seconds',
      labelNames: ['topology', 'operation'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
      registers: [this.registry]
    });

    // Business Metrics
    this.apiResponseTimes = new Histogram({
      name: 'ais_api_response_time_seconds',
      help: 'API response times in seconds',
      labelNames: ['endpoint', 'version'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [this.registry]
    });

    this.errorRates = new Counter({
      name: 'ais_errors_total',
      help: 'Total number of errors',
      labelNames: ['error_type', 'component', 'severity'],
      registers: [this.registry]
    });

    this.throughputRPS = new Gauge({
      name: 'ais_throughput_requests_per_second',
      help: 'Current throughput in requests per second',
      registers: [this.registry]
    });

    this.concurrentUsers = new Gauge({
      name: 'ais_concurrent_users',
      help: 'Number of concurrent users',
      registers: [this.registry]
    });

    // Security Metrics
    this.authenticationAttempts = new Counter({
      name: 'ais_authentication_attempts_total',
      help: 'Total authentication attempts',
      labelNames: ['result', 'method'],
      registers: [this.registry]
    });

    this.securityViolations = new Counter({
      name: 'ais_security_violations_total',
      help: 'Total security violations detected',
      labelNames: ['violation_type', 'severity'],
      registers: [this.registry]
    });

    this.rateLimitExceeded = new Counter({
      name: 'ais_rate_limit_exceeded_total',
      help: 'Rate limit exceeded events',
      labelNames: ['client_id', 'endpoint'],
      registers: [this.registry]
    });

    this.startSystemMetricsCollection();
  }

  /**
   * Start collecting system metrics at regular intervals
   */
  private startSystemMetricsCollection(): void {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.memoryUsage.set({ type: 'rss' }, memUsage.rss);
      this.memoryUsage.set({ type: 'heapUsed' }, memUsage.heapUsed);
      this.memoryUsage.set({ type: 'heapTotal' }, memUsage.heapTotal);
      this.memoryUsage.set({ type: 'external' }, memUsage.external);

      // CPU usage calculation (simplified)
      const cpuUsage = process.cpuUsage();
      const totalUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
      this.cpuUsage.set(totalUsage);
    }, 5000); // Collect every 5 seconds
  }

  /**
   * Get the Prometheus registry for HTTP endpoint
   */
  public getRegistry(): Registry {
    return this.registry;
  }

  /**
   * Record HTTP request metrics
   */
  public recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number
  ): void {
    this.httpRequestDuration
      .labels(method, route, statusCode.toString())
      .observe(duration);

    this.httpRequestsTotal
      .labels(method, route, statusCode.toString())
      .inc();
  }

  /**
   * Record agent spawn event
   */
  public recordAgentSpawn(agentType: string, swarmId: string, success: boolean): void {
    this.agentSpawnCount
      .labels(agentType, swarmId, success.toString())
      .inc();
  }

  /**
   * Record agent execution time
   */
  public recordAgentExecution(agentType: string, taskType: string, duration: number): void {
    this.agentExecutionTime
      .labels(agentType, taskType)
      .observe(duration);
  }

  /**
   * Record task completion
   */
  public recordTaskCompletion(taskType: string, success: boolean, agentType: string): void {
    this.taskCompletionRate
      .labels(taskType, success.toString(), agentType)
      .inc();
  }

  /**
   * Record evidence chain validation
   */
  public recordEvidenceChainValidation(
    validationType: string,
    result: string,
    confidenceLevel: string
  ): void {
    this.evidenceChainValidations
      .labels(validationType, result, confidenceLevel)
      .inc();
  }

  /**
   * Record swarm coordination latency
   */
  public recordSwarmCoordination(topology: string, operation: string, latency: number): void {
    this.swarmCoordinationLatency
      .labels(topology, operation)
      .observe(latency);
  }

  /**
   * Record security event
   */
  public recordSecurityEvent(
    eventType: 'auth_attempt' | 'violation' | 'rate_limit',
    details: { result?: string; method?: string; violationType?: string; severity?: string; clientId?: string; endpoint?: string }
  ): void {
    switch (eventType) {
      case 'auth_attempt':
        this.authenticationAttempts
          .labels(details.result || 'unknown', details.method || 'unknown')
          .inc();
        break;
      case 'violation':
        this.securityViolations
          .labels(details.violationType || 'unknown', details.severity || 'medium')
          .inc();
        break;
      case 'rate_limit':
        this.rateLimitExceeded
          .labels(details.clientId || 'unknown', details.endpoint || 'unknown')
          .inc();
        break;
    }
  }

  /**
   * Update active connections count
   */
  public setActiveConnections(count: number): void {
    this.activeConnections.set(count);
  }

  /**
   * Update concurrent users count
   */
  public setConcurrentUsers(count: number): void {
    this.concurrentUsers.set(count);
  }

  /**
   * Update throughput
   */
  public setThroughput(rps: number): void {
    this.throughputRPS.set(rps);
  }

  /**
   * Record API response time
   */
  public recordApiResponse(endpoint: string, version: string, responseTime: number): void {
    this.apiResponseTimes
      .labels(endpoint, version)
      .observe(responseTime);
  }

  /**
   * Record error
   */
  public recordError(errorType: string, component: string, severity: string): void {
    this.errorRates
      .labels(errorType, component, severity)
      .inc();
  }
}

// Singleton instance for global use
export const productionMetrics = new ProductionMetrics();

/**
 * Express middleware for automatic HTTP metrics collection
 */
export function metricsMiddleware() {
  return (req: any, res: any, next: any) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      productionMetrics.recordHttpRequest(
        req.method,
        req.route?.path || req.path,
        res.statusCode,
        duration
      );
    });

    next();
  };
}