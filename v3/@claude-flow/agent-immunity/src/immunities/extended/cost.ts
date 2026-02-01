/**
 * Cost/Tokens Immunity - Prevents excessive token usage and infinite loops
 *
 * @module @claude-flow/agent-immunity/immunities/extended/cost
 */

import type { Immunity, ImmunityViolation } from '../../immunity-service';

/**
 * Cost/Tokens Immunity
 *
 * Monitors and prevents excessive token usage, infinite loops, and runaway costs.
 * Implements token counting and execution pattern analysis.
 */
export class CostImmunity implements Immunity {
  public readonly name = 'cost';
  public readonly weight = 0.015; // 1.5% - Resource management in ADR-001 weight distribution

  private readonly thresholds = {
    maxTokensPerAction: 50000,
    maxExecutionTime: 30000, // 30 seconds
    maxIterations: 100,
    suspiciousPatternCount: 5
  };

  /**
   * Analyze action for cost/token efficiency issues
   */
  public async analyze(actionData: any): Promise<{
    score: number;
    violations: ImmunityViolation[];
  }> {
    try {
      const violations: ImmunityViolation[] = [];
      let score = 1.0;

      // Estimate token usage
      const tokenCount = this.estimateTokens(actionData);
      if (tokenCount > this.thresholds.maxTokensPerAction) {
        const severity = tokenCount > this.thresholds.maxTokensPerAction * 2 ? 'critical' : 'high';
        score = severity === 'critical' ? 0.0 : 0.3;

        violations.push({
          type: 'excessive_tokens',
          severity,
          score: 1.0 - score,
          description: `Action would consume ~${tokenCount} tokens (limit: ${this.thresholds.maxTokensPerAction})`,
          details: {
            estimatedTokens: tokenCount,
            threshold: this.thresholds.maxTokensPerAction,
            costImpact: this.estimateCost(tokenCount)
          }
        });
      }

      // Check for infinite loop patterns
      const loopRisk = this.detectInfiniteLoopRisk(actionData);
      if (loopRisk.detected) {
        violations.push({
          type: 'infinite_loop_risk',
          severity: 'high',
          score: 0.7,
          description: `Potential infinite loop detected: ${loopRisk.pattern}`,
          details: {
            pattern: loopRisk.pattern,
            confidence: loopRisk.confidence,
            preventionSuggestion: loopRisk.suggestion
          }
        });
        score = Math.min(score, 0.3);
      }

      // Check for recursive depth issues
      const recursionDepth = this.estimateRecursionDepth(actionData);
      if (recursionDepth > 20) {
        violations.push({
          type: 'excessive_recursion',
          severity: 'medium',
          score: 0.4,
          description: `Potential deep recursion detected (depth: ~${recursionDepth})`,
          details: { estimatedDepth: recursionDepth }
        });
        score = Math.min(score, 0.6);
      }

      // Check for resource-intensive operations
      const resourceUsage = this.analyzeResourceUsage(actionData);
      if (resourceUsage.risk > 0.5) {
        violations.push({
          type: 'resource_intensive',
          severity: 'medium',
          score: resourceUsage.risk,
          description: 'Action may consume excessive computational resources',
          details: {
            riskFactors: resourceUsage.factors,
            riskScore: resourceUsage.risk
          }
        });
        score = Math.min(score, 1.0 - resourceUsage.risk);
      }

      return { score, violations };
    } catch (error) {
      console.warn('🛡️ Cost immunity check failed:', error);
      return { score: 1.0, violations: [] }; // Fail safe
    }
  }

  private estimateTokens(actionData: any): number {
    const content = this.extractAllContent(actionData);
    // Rough estimation: ~4 characters per token
    return Math.ceil(content.length / 4);
  }

  private extractAllContent(actionData: any): string {
    const content = [];

    if (actionData.task?.description) content.push(actionData.task.description);
    if (actionData.agent?.prompt) content.push(actionData.agent.prompt);
    if (actionData.agent?.config) content.push(JSON.stringify(actionData.agent.config));
    if (actionData.context) content.push(JSON.stringify(actionData.context));

    return content.join(' ');
  }

  private estimateCost(tokens: number): number {
    // Rough cost estimation based on token count
    // Using average pricing: $0.003 per 1K tokens
    return (tokens / 1000) * 0.003;
  }

  private detectInfiniteLoopRisk(actionData: any): {
    detected: boolean;
    pattern: string;
    confidence: number;
    suggestion: string;
  } {
    const content = JSON.stringify(actionData).toLowerCase();

    // Check for common infinite loop patterns
    const patterns = [
      {
        regex: /while\s*\(\s*true\s*\)/g,
        name: 'while(true)',
        confidence: 0.9,
        suggestion: 'Add explicit exit condition'
      },
      {
        regex: /for\s*\(\s*;\s*;\s*\)/g,
        name: 'infinite for loop',
        confidence: 0.8,
        suggestion: 'Add loop termination condition'
      },
      {
        regex: /recursiv.*call.*self/g,
        name: 'recursive self-call',
        confidence: 0.7,
        suggestion: 'Add base case and depth limiting'
      },
      {
        regex: /setinterval.*(?!clearinterval)/g,
        name: 'unclearable interval',
        confidence: 0.6,
        suggestion: 'Ensure intervals are properly cleared'
      }
    ];

    for (const pattern of patterns) {
      if (pattern.regex.test(content)) {
        return {
          detected: true,
          pattern: pattern.name,
          confidence: pattern.confidence,
          suggestion: pattern.suggestion
        };
      }
    }

    return { detected: false, pattern: '', confidence: 0, suggestion: '' };
  }

  private estimateRecursionDepth(actionData: any): number {
    const content = JSON.stringify(actionData).toLowerCase();

    // Look for recursive patterns and estimate depth
    const recursiveMatches = content.match(/recursiv|call.*self|function.*\(\s*\)/g) || [];

    // Simple heuristic: more recursive mentions = higher estimated depth
    return Math.min(recursiveMatches.length * 5, 100);
  }

  private analyzeResourceUsage(actionData: any): {
    risk: number;
    factors: string[];
  } {
    const content = JSON.stringify(actionData).toLowerCase();
    const factors: string[] = [];
    let risk = 0;

    // Check for resource-intensive operations
    const riskIndicators = [
      { pattern: /large.*array|big.*data/g, factor: 'large data processing', weight: 0.3 },
      { pattern: /parallel.*process|concurrent.*exec/g, factor: 'parallel processing', weight: 0.2 },
      { pattern: /database.*scan|full.*table/g, factor: 'database scanning', weight: 0.4 },
      { pattern: /file.*read.*all|load.*entire/g, factor: 'full file loading', weight: 0.3 },
      { pattern: /image.*process|video.*transcode/g, factor: 'media processing', weight: 0.5 }
    ];

    for (const indicator of riskIndicators) {
      if (indicator.pattern.test(content)) {
        factors.push(indicator.factor);
        risk += indicator.weight;
      }
    }

    return {
      risk: Math.min(risk, 1.0),
      factors
    };
  }
}