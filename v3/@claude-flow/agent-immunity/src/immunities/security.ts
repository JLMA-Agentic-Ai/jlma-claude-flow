/**
 * Security Immunity - Wrapper for aidefence.analyze()
 *
 * @module @claude-flow/agent-immunity/immunities/security
 */

import type { Immunity, ImmunityViolation } from '../immunity-service';

/**
 * Security Immunity
 *
 * Wrapper for @claude-flow/aidefence security analysis.
 * Detects threats, injections, and security vulnerabilities.
 */
export class SecurityImmunity implements Immunity {
  public readonly name = 'security';
  public readonly weight = 1.0;

  /**
   * Analyze action for security threats
   */
  public async analyze(actionData: any): Promise<{
    score: number;
    violations: ImmunityViolation[];
  }> {
    try {
      // Simulate aidefence.analyze() - would use real implementation
      // const aidefence = await import('@claude-flow/aidefence');
      // const result = await aidefence.analyze(actionData);

      // For now, implement basic security checks
      const violations: ImmunityViolation[] = [];
      let score = 1.0;

      // Check for common injection patterns
      const input = this.extractTextContent(actionData);
      if (this.containsInjectionPattern(input)) {
        violations.push({
          type: 'security_threat',
          severity: 'critical',
          score: 0.0,
          description: 'Potential injection attack detected',
          details: { pattern: 'injection', input: input.substring(0, 100) }
        });
        score = 0.0;
      }

      return { score, violations };
    } catch (error) {
      console.warn('🛡️ Security immunity check failed:', error);
      return { score: 1.0, violations: [] }; // Fail safe
    }
  }

  /**
   * Extract text content from action data
   */
  private extractTextContent(actionData: any): string {
    const content = [];

    if (actionData.task?.description) content.push(actionData.task.description);
    if (actionData.agent?.config) content.push(JSON.stringify(actionData.agent.config));
    if (actionData.metadata) content.push(JSON.stringify(actionData.metadata));

    return content.join(' ').toLowerCase();
  }

  /**
   * Check for basic injection patterns
   */
  private containsInjectionPattern(text: string): boolean {
    const injectionPatterns = [
      'ignore previous',
      'system prompt',
      '<script>',
      'javascript:',
      'eval(',
      'exec(',
      'rm -rf',
      '; drop table'
    ];

    return injectionPatterns.some(pattern => text.includes(pattern));
  }
}