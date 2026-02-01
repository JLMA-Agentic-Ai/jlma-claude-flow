/**
 * Performance Immunity - Regex patterns for O(n²), readFileSync
 *
 * @module @claude-flow/agent-immunity/immunities/performance
 */

import type { Immunity, ImmunityViolation } from '../immunity-service';

/**
 * Performance anti-pattern with details
 */
interface PerformancePattern {
  pattern: RegExp;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestion: string;
}

/**
 * Performance Immunity
 *
 * Detects performance anti-patterns using regex analysis.
 * Identifies O(n²) algorithms, synchronous I/O, and other performance issues.
 */
export class PerformanceImmunity implements Immunity {
  public readonly name = 'performance';
  public readonly weight = 0.6;

  private performancePatterns: PerformancePattern[] = [
    {
      pattern: /readFileSync\(/gi,
      description: 'Synchronous file read operation detected',
      severity: 'high',
      suggestion: 'Use readFile() or fs.promises.readFile() for async I/O'
    },
    {
      pattern: /writeFileSync\(/gi,
      description: 'Synchronous file write operation detected',
      severity: 'high',
      suggestion: 'Use writeFile() or fs.promises.writeFile() for async I/O'
    },
    {
      pattern: /for\s*\([^)]*\)\s*{\s*for\s*\(/gi,
      description: 'Nested loops detected - potential O(n²) complexity',
      severity: 'medium',
      suggestion: 'Consider using Map/Set for lookups or optimizing algorithm'
    },
    {
      pattern: /forEach\([^)]*\)\s*[^}]*forEach\(/gi,
      description: 'Nested forEach loops - potential O(n²) complexity',
      severity: 'medium',
      suggestion: 'Use flatMap, reduce, or optimized data structures'
    },
    {
      pattern: /\.find\([^)]*\).*\.find\(/gi,
      description: 'Multiple array.find() calls - inefficient lookup pattern',
      severity: 'medium',
      suggestion: 'Create a lookup Map/Set for better performance'
    },
    {
      pattern: /execSync\(/gi,
      description: 'Synchronous command execution detected',
      severity: 'high',
      suggestion: 'Use child_process.exec() or spawn() for async execution'
    },
    {
      pattern: /sleep\(\d+\)/gi,
      description: 'Blocking sleep operation detected',
      severity: 'medium',
      suggestion: 'Use setTimeout/setInterval or async delay functions'
    },
    {
      pattern: /while\s*\(\s*true\s*\)/gi,
      description: 'Infinite loop without break condition',
      severity: 'critical',
      suggestion: 'Add proper exit conditions or use event-driven patterns'
    },
    {
      pattern: /JSON\.parse\(.*JSON\.stringify/gi,
      description: 'Inefficient deep clone using JSON.parse/stringify',
      severity: 'low',
      suggestion: 'Use structuredClone() or a proper deep clone library'
    },
    {
      pattern: /document\.getElementById.*getElementById/gi,
      description: 'Multiple DOM queries - cache elements instead',
      severity: 'low',
      suggestion: 'Cache DOM elements in variables for reuse'
    }
  ];

  /**
   * Analyze action for performance anti-patterns
   */
  public async analyze(actionData: any): Promise<{
    score: number;
    violations: ImmunityViolation[];
  }> {
    try {
      const violations: ImmunityViolation[] = [];
      const codeText = this.extractCodeContent(actionData);

      if (!codeText || codeText.length < 20) {
        return { score: 1.0, violations: [] }; // No code to analyze
      }

      console.log(`⚡ Performance analysis on ${codeText.length} chars of code`);

      // Check each performance pattern
      const detectedPatterns: string[] = [];

      for (const perfPattern of this.performancePatterns) {
        const matches = codeText.match(perfPattern.pattern);
        if (matches && matches.length > 0) {
          detectedPatterns.push(perfPattern.description);

          violations.push({
            type: 'performance_issue',
            severity: perfPattern.severity,
            score: this.getSeverityScore(perfPattern.severity),
            description: perfPattern.description,
            details: {
              pattern: perfPattern.pattern.source,
              matches: matches.length,
              suggestion: perfPattern.suggestion,
              codeSnippet: this.extractCodeSnippet(codeText, perfPattern.pattern)
            }
          });
        }
      }

      // Calculate overall score based on violations
      const overallScore = this.calculatePerformanceScore(violations);

      if (detectedPatterns.length > 0) {
        console.log(`⚠️ Performance issues detected: ${detectedPatterns.join(', ')}`);
      }

      return { score: overallScore, violations };
    } catch (error) {
      console.warn('⚡ Performance immunity check failed:', error);
      return { score: 1.0, violations: [] }; // Fail safe
    }
  }

  /**
   * Extract code content from action data
   */
  private extractCodeContent(actionData: any): string {
    const codeContent: string[] = [];

    // Extract from various sources
    if (actionData.metadata?.code) codeContent.push(actionData.metadata.code);
    if (actionData.metadata?.implementation) codeContent.push(actionData.metadata.implementation);
    if (actionData.metadata?.script) codeContent.push(actionData.metadata.script);
    if (actionData.task?.description) {
      // Look for code blocks in description
      const codeBlocks = actionData.task.description.match(/```[\s\S]*?```/g);
      if (codeBlocks) {
        codeContent.push(...codeBlocks.map((block: string) => block.replace(/```/g, '')));
      }
    }

    return codeContent.join('\n');
  }

  /**
   * Calculate performance score based on violations
   */
  private calculatePerformanceScore(violations: ImmunityViolation[]): number {
    if (violations.length === 0) return 1.0;

    // Weight violations by severity
    let totalWeight = 0;
    let weightedScore = 0;

    for (const violation of violations) {
      const weight = this.getSeverityWeight(violation.severity);
      totalWeight += weight;
      weightedScore += violation.score * weight;
    }

    return totalWeight > 0 ? weightedScore / totalWeight : 1.0;
  }

  /**
   * Get numeric score for severity level
   */
  private getSeverityScore(severity: string): number {
    switch (severity) {
      case 'critical': return 0.0;
      case 'high': return 0.3;
      case 'medium': return 0.6;
      case 'low': return 0.8;
      default: return 1.0;
    }
  }

  /**
   * Get weight for severity level
   */
  private getSeverityWeight(severity: string): number {
    switch (severity) {
      case 'critical': return 4.0;
      case 'high': return 3.0;
      case 'medium': return 2.0;
      case 'low': return 1.0;
      default: return 1.0;
    }
  }

  /**
   * Extract code snippet around pattern match
   */
  private extractCodeSnippet(code: string, pattern: RegExp): string {
    const match = pattern.exec(code);
    if (!match) return '';

    const matchIndex = match.index || 0;
    const start = Math.max(0, matchIndex - 50);
    const end = Math.min(code.length, matchIndex + match[0].length + 50);

    return code.substring(start, end).trim();
  }
}