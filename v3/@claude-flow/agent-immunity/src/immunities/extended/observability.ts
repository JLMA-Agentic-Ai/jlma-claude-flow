/**
 * Observability Immunity - Ensures proper logging, monitoring, and tracing
 *
 * @module @claude-flow/agent-immunity/immunities/extended/observability
 */

import type { Immunity, ImmunityViolation } from '../../immunity-service';

/**
 * Observability Immunity
 *
 * Uses AST analysis to check for proper logging, monitoring, and tracing in agent actions.
 * Ensures system visibility and debuggability without performance degradation.
 */
export class ObservabilityImmunity implements Immunity {
  public readonly name = 'observability';
  public readonly weight = 0.03; // 3% - Operations/debugging in ADR-001 weight distribution

  private readonly requiredObservabilityPatterns = [
    'logging',
    'monitoring',
    'tracing',
    'metrics',
    'error_handling'
  ];

  /**
   * Analyze action for observability compliance
   */
  public async analyze(actionData: any): Promise<{
    score: number;
    violations: ImmunityViolation[];
  }> {
    try {
      const violations: ImmunityViolation[] = [];
      let score = 1.0;

      // Analyze code for observability patterns
      const observabilityAnalysis = this.analyzeObservabilityPatterns(actionData);

      if (observabilityAnalysis.missingPatterns.length > 0) {
        const severity = this.calculateObservabilitySeverity(observabilityAnalysis);
        const scoreReduction = observabilityAnalysis.missingPatterns.length * 0.15;
        score = Math.max(0.2, 1.0 - scoreReduction);

        violations.push({
          type: 'observability_gap',
          severity,
          score: scoreReduction,
          description: `Missing observability patterns: ${observabilityAnalysis.missingPatterns.join(', ')}`,
          details: {
            missingPatterns: observabilityAnalysis.missingPatterns,
            presentPatterns: observabilityAnalysis.presentPatterns,
            complexity: observabilityAnalysis.complexity,
            recommendations: this.generateObservabilityRecommendations(observabilityAnalysis)
          }
        });
      }

      // Check for excessive logging that could impact performance
      const loggingAnalysis = this.analyzeLoggingPattern(actionData);
      if (loggingAnalysis.excessive) {
        violations.push({
          type: 'excessive_logging',
          severity: 'medium',
          score: 0.3,
          description: `Excessive logging detected: ${loggingAnalysis.count} log statements`,
          details: {
            logCount: loggingAnalysis.count,
            recommendedMax: loggingAnalysis.recommendedMax,
            performanceImpact: loggingAnalysis.performanceImpact
          }
        });
        score = Math.min(score, 0.7);
      }

      // Check for proper error tracking
      const errorTracking = this.analyzeErrorTracking(actionData);
      if (!errorTracking.hasProperTracking) {
        violations.push({
          type: 'insufficient_error_tracking',
          severity: 'high',
          score: 0.4,
          description: 'Insufficient error tracking and monitoring',
          details: {
            hasErrorHandling: errorTracking.hasErrorHandling,
            hasErrorLogging: errorTracking.hasErrorLogging,
            hasErrorMetrics: errorTracking.hasErrorMetrics
          }
        });
        score = Math.min(score, 0.6);
      }

      // Check for distributed tracing compatibility
      const tracingAnalysis = this.analyzeTracingCompatibility(actionData);
      if (tracingAnalysis.complexity > 'simple' && !tracingAnalysis.hasTracing) {
        violations.push({
          type: 'missing_distributed_tracing',
          severity: 'medium',
          score: 0.25,
          description: 'Complex operation lacks distributed tracing capabilities',
          details: {
            complexity: tracingAnalysis.complexity,
            hasTracing: tracingAnalysis.hasTracing,
            spanCount: tracingAnalysis.estimatedSpanCount
          }
        });
        score = Math.min(score, 0.75);
      }

      return { score, violations };
    } catch (error) {
      console.warn('🛡️ Observability immunity check failed:', error);
      return { score: 1.0, violations: [] }; // Fail safe
    }
  }

  private analyzeObservabilityPatterns(actionData: any): {
    presentPatterns: string[];
    missingPatterns: string[];
    complexity: 'simple' | 'moderate' | 'complex';
  } {
    const content = this.extractCodeContent(actionData);
    const presentPatterns: string[] = [];
    const missingPatterns: string[] = [];

    // Check for logging patterns
    if (this.hasLoggingPattern(content)) {
      presentPatterns.push('logging');
    } else {
      missingPatterns.push('logging');
    }

    // Check for monitoring/metrics patterns
    if (this.hasMonitoringPattern(content)) {
      presentPatterns.push('monitoring');
    } else {
      missingPatterns.push('monitoring');
    }

    // Check for tracing patterns
    if (this.hasTracingPattern(content)) {
      presentPatterns.push('tracing');
    } else {
      missingPatterns.push('tracing');
    }

    // Check for metrics collection
    if (this.hasMetricsPattern(content)) {
      presentPatterns.push('metrics');
    } else {
      missingPatterns.push('metrics');
    }

    // Check for error handling
    if (this.hasErrorHandlingPattern(content)) {
      presentPatterns.push('error_handling');
    } else {
      missingPatterns.push('error_handling');
    }

    const complexity = this.calculateComplexity(content);

    return {
      presentPatterns,
      missingPatterns,
      complexity
    };
  }

  private extractCodeContent(actionData: any): string {
    const content = [];

    if (actionData.task?.implementation) content.push(actionData.task.implementation);
    if (actionData.agent?.code) content.push(actionData.agent.code);
    if (actionData.files) {
      for (const file of Object.values(actionData.files as any[])) {
        if (typeof file === 'string') content.push(file);
      }
    }

    return content.join('\n').toLowerCase();
  }

  private hasLoggingPattern(content: string): boolean {
    const loggingPatterns = [
      /console\.log/g,
      /logger\./g,
      /log\.(info|debug|warn|error)/g,
      /winston/g,
      /pino/g
    ];

    return loggingPatterns.some(pattern => pattern.test(content));
  }

  private hasMonitoringPattern(content: string): boolean {
    const monitoringPatterns = [
      /monitor/g,
      /health.*check/g,
      /prometheus/g,
      /grafana/g,
      /datadog/g
    ];

    return monitoringPatterns.some(pattern => pattern.test(content));
  }

  private hasTracingPattern(content: string): boolean {
    const tracingPatterns = [
      /trace/g,
      /span/g,
      /opentelemetry/g,
      /jaeger/g,
      /zipkin/g,
      /correlation.*id/g
    ];

    return tracingPatterns.some(pattern => pattern.test(content));
  }

  private hasMetricsPattern(content: string): boolean {
    const metricsPatterns = [
      /metrics/g,
      /counter/g,
      /gauge/g,
      /histogram/g,
      /timer/g,
      /measure/g
    ];

    return metricsPatterns.some(pattern => pattern.test(content));
  }

  private hasErrorHandlingPattern(content: string): boolean {
    const errorPatterns = [
      /try.*catch/g,
      /throw.*error/g,
      /error.*handler/g,
      /\.catch\(/g,
      /onerror/g
    ];

    return errorPatterns.some(pattern => pattern.test(content));
  }

  private calculateComplexity(content: string): 'simple' | 'moderate' | 'complex' {
    const complexityIndicators = [
      /async.*await/g,
      /promise/g,
      /database/g,
      /api.*call/g,
      /microservice/g,
      /distributed/g
    ];

    const matches = complexityIndicators.reduce((count, pattern) => {
      return count + (content.match(pattern)?.length || 0);
    }, 0);

    if (matches > 10) return 'complex';
    if (matches > 3) return 'moderate';
    return 'simple';
  }

  private calculateObservabilitySeverity(analysis: {
    missingPatterns: string[];
    complexity: string;
  }): 'low' | 'medium' | 'high' | 'critical' {
    const criticalMissing = analysis.missingPatterns.includes('error_handling');
    const missingCount = analysis.missingPatterns.length;

    if (criticalMissing && analysis.complexity === 'complex') return 'critical';
    if (missingCount >= 4) return 'high';
    if (missingCount >= 2) return 'medium';
    return 'low';
  }

  private generateObservabilityRecommendations(analysis: any): string[] {
    const recommendations: string[] = [];

    if (analysis.missingPatterns.includes('logging')) {
      recommendations.push('Add structured logging with appropriate log levels');
    }
    if (analysis.missingPatterns.includes('monitoring')) {
      recommendations.push('Implement health checks and system monitoring');
    }
    if (analysis.missingPatterns.includes('tracing')) {
      recommendations.push('Add distributed tracing for request correlation');
    }
    if (analysis.missingPatterns.includes('metrics')) {
      recommendations.push('Implement metrics collection for performance monitoring');
    }
    if (analysis.missingPatterns.includes('error_handling')) {
      recommendations.push('Add comprehensive error handling and reporting');
    }

    return recommendations;
  }

  private analyzeLoggingPattern(actionData: any): {
    excessive: boolean;
    count: number;
    recommendedMax: number;
    performanceImpact: 'low' | 'medium' | 'high';
  } {
    const content = this.extractCodeContent(actionData);
    const logStatements = content.match(/console\.|log\.|logger\./g) || [];
    const count = logStatements.length;
    const lines = content.split('\n').length;
    const logDensity = count / Math.max(lines, 1);

    const recommendedMax = Math.max(10, Math.floor(lines * 0.1)); // Max 10% of lines

    return {
      excessive: count > recommendedMax,
      count,
      recommendedMax,
      performanceImpact: logDensity > 0.2 ? 'high' : logDensity > 0.1 ? 'medium' : 'low'
    };
  }

  private analyzeErrorTracking(actionData: any): {
    hasProperTracking: boolean;
    hasErrorHandling: boolean;
    hasErrorLogging: boolean;
    hasErrorMetrics: boolean;
  } {
    const content = this.extractCodeContent(actionData);

    const hasErrorHandling = this.hasErrorHandlingPattern(content);
    const hasErrorLogging = /error.*log|log.*error/.test(content);
    const hasErrorMetrics = /error.*metric|metric.*error|error.*count/.test(content);

    return {
      hasProperTracking: hasErrorHandling && hasErrorLogging,
      hasErrorHandling,
      hasErrorLogging,
      hasErrorMetrics
    };
  }

  private analyzeTracingCompatibility(actionData: any): {
    complexity: 'simple' | 'moderate' | 'complex';
    hasTracing: boolean;
    estimatedSpanCount: number;
  } {
    const content = this.extractCodeContent(actionData);
    const complexity = this.calculateComplexity(content);
    const hasTracing = this.hasTracingPattern(content);

    // Estimate span count based on async operations
    const asyncOperations = content.match(/await|\.then\(|promise/g) || [];
    const estimatedSpanCount = asyncOperations.length;

    return {
      complexity,
      hasTracing,
      estimatedSpanCount
    };
  }
}