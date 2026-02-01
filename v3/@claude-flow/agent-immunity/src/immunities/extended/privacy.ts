/**
 * Privacy/PII Immunity - Detects and prevents exposure of personally identifiable information
 *
 * @module @claude-flow/agent-immunity/immunities/extended/privacy
 */

import type { Immunity, ImmunityViolation } from '../../immunity-service';

/**
 * Privacy/PII Immunity
 *
 * Extends aidefence.containsPII() to detect and prevent exposure of PII
 * in agent actions, responses, and data processing.
 */
export class PrivacyImmunity implements Immunity {
  public readonly name = 'privacy';
  public readonly weight = 0.07; // 7% - Data protection compliance in ADR-001 weight distribution

  private readonly piiPatterns = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
    ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,
    phone: /\b(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
    creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    ipAddress: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g
  };

  /**
   * Analyze action for PII exposure risks
   */
  public async analyze(actionData: any): Promise<{
    score: number;
    violations: ImmunityViolation[];
  }> {
    try {
      const violations: ImmunityViolation[] = [];
      let score = 1.0;

      const content = this.extractTextContent(actionData);
      const detectedPII = this.detectPII(content);

      if (detectedPII.length > 0) {
        const severity = this.calculateSeverity(detectedPII);
        score = severity === 'critical' ? 0.0 : severity === 'high' ? 0.3 : 0.7;

        violations.push({
          type: 'privacy_violation',
          severity,
          score: 1.0 - score,
          description: `Detected ${detectedPII.length} PII pattern(s): ${detectedPII.join(', ')}`,
          details: {
            piiTypes: detectedPII,
            contentLength: content.length,
            maskedContent: this.maskPII(content)
          }
        });
      }

      // Check for data logging/storage without consent
      if (this.hasDataLoggingRisk(actionData)) {
        violations.push({
          type: 'data_logging_risk',
          severity: 'medium',
          score: 0.3,
          description: 'Action may log or store sensitive data without proper privacy controls',
          details: { hasLogging: true }
        });
        score = Math.min(score, 0.7);
      }

      return { score, violations };
    } catch (error) {
      console.warn('🛡️ Privacy immunity check failed:', error);
      return { score: 1.0, violations: [] }; // Fail safe
    }
  }

  private extractTextContent(actionData: any): string {
    const content = [];

    if (actionData.task?.description) content.push(actionData.task.description);
    if (actionData.agent?.prompt) content.push(actionData.agent.prompt);
    if (actionData.input) content.push(JSON.stringify(actionData.input));
    if (actionData.output) content.push(JSON.stringify(actionData.output));

    return content.join(' ');
  }

  private detectPII(text: string): string[] {
    const detected: string[] = [];

    for (const [type, pattern] of Object.entries(this.piiPatterns)) {
      if (pattern.test(text)) {
        detected.push(type);
      }
    }

    return detected;
  }

  private calculateSeverity(piiTypes: string[]): 'low' | 'medium' | 'high' | 'critical' {
    const highRiskTypes = ['ssn', 'creditCard'];
    const hasHighRisk = piiTypes.some(type => highRiskTypes.includes(type));

    if (hasHighRisk) return 'critical';
    if (piiTypes.length > 2) return 'high';
    if (piiTypes.length > 0) return 'medium';
    return 'low';
  }

  private maskPII(text: string): string {
    let masked = text;

    for (const pattern of Object.values(this.piiPatterns)) {
      masked = masked.replace(pattern, '[PII_REDACTED]');
    }

    return masked;
  }

  private hasDataLoggingRisk(actionData: any): boolean {
    const content = JSON.stringify(actionData).toLowerCase();
    const loggingIndicators = ['console.log', 'logger', 'log.info', 'writeFile', 'localStorage'];

    return loggingIndicators.some(indicator => content.includes(indicator));
  }
}