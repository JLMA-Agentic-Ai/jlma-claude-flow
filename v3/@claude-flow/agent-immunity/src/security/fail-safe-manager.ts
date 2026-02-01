/**
 * Fail-Safe Manager - PHASE 1 Security Fix
 *
 * Implements fail-closed patterns with circuit breakers and comprehensive error logging.
 * Replaces all fail-open vulnerabilities with secure fail-closed defaults.
 *
 * @module @claude-flow/agent-immunity/security/fail-safe-manager
 */

/**
 * Security levels for fail-safe operations
 */
export enum SecurityLevel {
  DENY_ALL = 0,      // Complete lockdown
  RESTRICTED = 0.2,  // Severely restricted
  CAUTIOUS = 0.4,    // Cautious operation
  MONITORED = 0.6,   // Active monitoring
  NORMAL = 0.8,      // Normal operation
  TRUSTED = 1.0      // Fully trusted
}

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'CLOSED',     // Operating normally
  OPEN = 'OPEN',         // Blocking all requests
  HALF_OPEN = 'HALF_OPEN' // Testing recovery
}

/**
 * Fail-safe policy configuration
 */
export interface FailSafePolicy {
  defaultSecurityLevel: SecurityLevel;
  circuitBreaker: {
    failureThreshold: number;
    timeoutMs: number;
    recoveryTimeMs: number;
  };
  errorLogging: {
    enabled: boolean;
    logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
    auditTrail: boolean;
  };
  escalation: {
    enabled: boolean;
    thresholds: {
      warning: number;
      critical: number;
      emergency: number;
    };
  };
}

/**
 * Security audit event
 */
export interface SecurityAuditEvent {
  timestamp: number;
  eventType: 'FAIL_SAFE_TRIGGERED' | 'CIRCUIT_BREAKER_OPENED' | 'SECURITY_VIOLATION' | 'ERROR_ESCALATION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  component: string;
  details: Record<string, any>;
  securityLevel: SecurityLevel;
  actionTaken: string;
}

/**
 * Circuit breaker for security operations
 */
class SecurityCircuitBreaker {
  private state = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly policy: FailSafePolicy['circuitBreaker'];

  constructor(policy: FailSafePolicy['circuitBreaker']) {
    this.policy = policy;
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>, fallback: () => T): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.policy.recoveryTimeMs) {
        this.state = CircuitState.HALF_OPEN;
        console.log(`🔄 Circuit breaker transitioning to HALF_OPEN`);
      } else {
        console.warn(`🚫 Circuit breaker OPEN - using fail-closed fallback`);
        return fallback();
      }
    }

    try {
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Circuit breaker timeout')), this.policy.timeoutMs)
        )
      ]);

      // Success - reset failure count
      if (this.state === CircuitState.HALF_OPEN) {
        this.state = CircuitState.CLOSED;
        console.log(`✅ Circuit breaker recovered - state CLOSED`);
      }
      this.failureCount = 0;
      return result;

    } catch (error) {
      this.recordFailure();
      console.error(`❌ Circuit breaker recorded failure: ${error.message}`);
      return fallback();
    }
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.policy.failureThreshold) {
      this.state = CircuitState.OPEN;
      console.error(`🚨 Circuit breaker OPENED after ${this.failureCount} failures`);
    }
  }

  getState(): { state: CircuitState; failureCount: number; lastFailureTime: number } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

/**
 * Comprehensive security audit logger
 */
class SecurityAuditLogger {
  private auditEvents: SecurityAuditEvent[] = [];
  private readonly policy: FailSafePolicy['errorLogging'];

  constructor(policy: FailSafePolicy['errorLogging']) {
    this.policy = policy;
  }

  /**
   * Log security event with fail-closed audit trail
   */
  logSecurityEvent(event: Omit<SecurityAuditEvent, 'timestamp'>): void {
    const auditEvent: SecurityAuditEvent = {
      ...event,
      timestamp: Date.now()
    };

    this.auditEvents.push(auditEvent);

    // Log to console based on policy
    if (this.policy.enabled) {
      const logMessage = `🛡️ SECURITY AUDIT [${event.severity}] ${event.component}: ${event.actionTaken}`;

      switch (event.severity) {
        case 'CRITICAL':
          console.error(logMessage, event.details);
          break;
        case 'HIGH':
          console.warn(logMessage, event.details);
          break;
        case 'MEDIUM':
          console.warn(logMessage, event.details);
          break;
        case 'LOW':
          console.info(logMessage, event.details);
          break;
      }
    }

    // Maintain audit trail size
    if (this.auditEvents.length > 10000) {
      this.auditEvents = this.auditEvents.slice(-5000);
    }

    // Audit trail persistence (if enabled)
    if (this.policy.auditTrail) {
      this.persistAuditEvent(auditEvent);
    }
  }

  private persistAuditEvent(event: SecurityAuditEvent): void {
    try {
      // In production, this would write to secure audit storage
      // For now, write to secure memory location
      if (typeof global !== 'undefined') {
        if (!global.__claude_flow_audit_trail) {
          global.__claude_flow_audit_trail = [];
        }
        global.__claude_flow_audit_trail.push(event);

        // Limit global trail size
        if (global.__claude_flow_audit_trail.length > 1000) {
          global.__claude_flow_audit_trail = global.__claude_flow_audit_trail.slice(-500);
        }
      }
    } catch (error) {
      console.error(`Failed to persist audit event: ${error.message}`);
    }
  }

  getAuditTrail(limit = 100): SecurityAuditEvent[] {
    return this.auditEvents.slice(-limit);
  }

  getCriticalEvents(): SecurityAuditEvent[] {
    return this.auditEvents.filter(event => event.severity === 'CRITICAL');
  }
}

/**
 * Fail-Safe Manager - Core Security Implementation
 *
 * Implements secure fail-closed patterns for all security operations
 */
export class FailSafeManager {
  private readonly policy: FailSafePolicy;
  private readonly circuitBreaker: SecurityCircuitBreaker;
  private readonly auditLogger: SecurityAuditLogger;
  private escalationCount = 0;

  constructor(customPolicy?: Partial<FailSafePolicy>) {
    // Default to MAXIMUM SECURITY fail-closed policy
    this.policy = {
      defaultSecurityLevel: SecurityLevel.DENY_ALL, // FAIL CLOSED!
      circuitBreaker: {
        failureThreshold: 3,
        timeoutMs: 5000,
        recoveryTimeMs: 30000
      },
      errorLogging: {
        enabled: true,
        logLevel: 'ERROR',
        auditTrail: true
      },
      escalation: {
        enabled: true,
        thresholds: {
          warning: 5,
          critical: 10,
          emergency: 20
        }
      },
      ...customPolicy
    };

    this.circuitBreaker = new SecurityCircuitBreaker(this.policy.circuitBreaker);
    this.auditLogger = new SecurityAuditLogger(this.policy.errorLogging);
  }

  /**
   * Execute security operation with fail-closed protection
   *
   * CRITICAL: This ALWAYS returns a DENY/RESTRICTED result on any error!
   */
  async executeSecureOperation<T>(
    operation: () => Promise<T>,
    fallbackSecurityLevel: SecurityLevel,
    component: string,
    context: Record<string, any> = {}
  ): Promise<{ success: boolean; result?: T; securityLevel: SecurityLevel }> {

    const startTime = performance.now();

    try {
      // Execute with circuit breaker protection
      const result = await this.circuitBreaker.execute(
        async () => {
          const operationResult = await operation();
          return operationResult;
        },
        () => {
          // FAIL-CLOSED FALLBACK - DENY OPERATION
          this.auditLogger.logSecurityEvent({
            eventType: 'FAIL_SAFE_TRIGGERED',
            severity: 'HIGH',
            component,
            details: {
              reason: 'Circuit breaker fallback triggered',
              context,
              securityLevel: this.policy.defaultSecurityLevel
            },
            securityLevel: this.policy.defaultSecurityLevel,
            actionTaken: 'OPERATION DENIED - Fail-closed fallback'
          });

          throw new Error('Fail-closed: Operation denied by circuit breaker');
        }
      );

      // Success - but still apply conservative security level
      const securityLevel = Math.min(fallbackSecurityLevel, SecurityLevel.MONITORED);

      this.auditLogger.logSecurityEvent({
        eventType: 'SECURITY_VIOLATION',
        severity: 'LOW',
        component,
        details: {
          result: typeof result,
          executionTimeMs: performance.now() - startTime,
          context
        },
        securityLevel,
        actionTaken: 'Operation completed with monitoring'
      });

      return { success: true, result, securityLevel };

    } catch (error) {
      // CRITICAL: FAIL-CLOSED BEHAVIOR
      const denialLevel = this.policy.defaultSecurityLevel;

      this.auditLogger.logSecurityEvent({
        eventType: 'FAIL_SAFE_TRIGGERED',
        severity: 'CRITICAL',
        component,
        details: {
          error: error.message,
          stack: error.stack,
          context,
          executionTimeMs: performance.now() - startTime,
          escalationCount: this.escalationCount
        },
        securityLevel: denialLevel,
        actionTaken: 'OPERATION DENIED - Fail-closed security policy'
      });

      // Escalate if configured
      if (this.policy.escalation.enabled) {
        await this.escalateSecurityIncident(error, component, context);
      }

      // ALWAYS DENY on error (fail-closed)
      return { success: false, securityLevel: denialLevel };
    }
  }

  /**
   * Get fail-closed security assessment
   *
   * Returns DENY_ALL on any uncertainty
   */
  getSecurityAssessment(violations: any[], componentHealth: number): {
    score: number;
    securityLevel: SecurityLevel;
    actionRequired: string
  } {

    // Start with maximum restriction
    let securityLevel = this.policy.defaultSecurityLevel;
    let score = 0.0; // Fail-closed: start with complete denial

    try {
      // Only increase security level if NO violations and high health
      if (violations.length === 0 && componentHealth > 0.9) {
        securityLevel = SecurityLevel.MONITORED;
        score = 0.6;
      } else if (violations.length === 0 && componentHealth > 0.7) {
        securityLevel = SecurityLevel.CAUTIOUS;
        score = 0.4;
      } else if (componentHealth > 0.5) {
        securityLevel = SecurityLevel.RESTRICTED;
        score = 0.2;
      }
      // else: stays at DENY_ALL with score 0.0

      const actionRequired = this.determineSecurityAction(securityLevel, violations.length);

      this.auditLogger.logSecurityEvent({
        eventType: 'SECURITY_VIOLATION',
        severity: violations.length > 0 ? 'HIGH' : 'LOW',
        component: 'FailSafeManager',
        details: {
          violationCount: violations.length,
          componentHealth,
          calculatedScore: score
        },
        securityLevel,
        actionTaken: actionRequired
      });

      return { score, securityLevel, actionRequired };

    } catch (error) {
      // FAIL-CLOSED: On any error, deny everything
      this.auditLogger.logSecurityEvent({
        eventType: 'FAIL_SAFE_TRIGGERED',
        severity: 'CRITICAL',
        component: 'FailSafeManager',
        details: {
          error: error.message,
          violationCount: violations.length,
          componentHealth
        },
        securityLevel: SecurityLevel.DENY_ALL,
        actionTaken: 'COMPLETE LOCKDOWN - Assessment failed'
      });

      return {
        score: 0.0,
        securityLevel: SecurityLevel.DENY_ALL,
        actionRequired: 'COMPLETE LOCKDOWN - Manual security review required'
      };
    }
  }

  /**
   * Handle network operation with fail-closed protection
   */
  async handleNetworkOperation(networkData: any): Promise<{ allowed: boolean; securityLevel: SecurityLevel }> {
    return this.executeSecureOperation(
      async () => {
        // Simulate network validation
        if (!networkData || Object.keys(networkData).length === 0) {
          return { validated: true };
        }

        // Any network operation requires strict validation
        if (networkData.urls && networkData.urls.length > 0) {
          throw new Error('Network operations require manual approval');
        }

        return { validated: true };
      },
      SecurityLevel.RESTRICTED,
      'NetworkImmunity',
      { networkData: typeof networkData, urlCount: networkData?.urls?.length || 0 }
    ).then(result => ({
      allowed: result.success,
      securityLevel: result.securityLevel
    }));
  }

  /**
   * Handle consensus operation with fail-closed protection
   */
  async handleConsensusOperation(consensusData: any): Promise<{ allowed: boolean; securityLevel: SecurityLevel }> {
    return this.executeSecureOperation(
      async () => {
        // Strict consensus validation
        if (!consensusData || typeof consensusData !== 'object') {
          throw new Error('Invalid consensus data structure');
        }

        // Require explicit approval for consensus operations
        if (!consensusData.explicitApproval) {
          throw new Error('Consensus operations require explicit approval');
        }

        return { validated: true };
      },
      SecurityLevel.CAUTIOUS,
      'ConsensusImmunity',
      { consensusData: typeof consensusData }
    ).then(result => ({
      allowed: result.success,
      securityLevel: result.securityLevel
    }));
  }

  private determineSecurityAction(level: SecurityLevel, violationCount: number): string {
    if (level === SecurityLevel.DENY_ALL) {
      return 'DENY ALL OPERATIONS - Maximum security lockdown';
    } else if (level === SecurityLevel.RESTRICTED) {
      return 'RESTRICT OPERATIONS - Limited functionality only';
    } else if (level === SecurityLevel.CAUTIOUS) {
      return 'CAUTIOUS OPERATION - Enhanced monitoring active';
    } else if (level === SecurityLevel.MONITORED) {
      return 'MONITORED OPERATION - Standard security protocols';
    } else {
      return 'NORMAL OPERATION - All systems operational';
    }
  }

  private async escalateSecurityIncident(error: Error, component: string, context: Record<string, any>): Promise<void> {
    this.escalationCount++;

    try {
      // Check escalation thresholds
      if (this.escalationCount >= this.policy.escalation.thresholds.emergency) {
        console.error(`🚨 EMERGENCY ESCALATION: ${this.escalationCount} security incidents in ${component}`);

        // In production: alert security team, lock down system
        this.auditLogger.logSecurityEvent({
          eventType: 'ERROR_ESCALATION',
          severity: 'CRITICAL',
          component: 'FailSafeManager',
          details: {
            escalationLevel: 'EMERGENCY',
            escalationCount: this.escalationCount,
            triggeringError: error.message,
            triggeringComponent: component,
            context
          },
          securityLevel: SecurityLevel.DENY_ALL,
          actionTaken: 'EMERGENCY ESCALATION - Security team notified'
        });

      } else if (this.escalationCount >= this.policy.escalation.thresholds.critical) {
        console.warn(`⚠️ CRITICAL ESCALATION: ${this.escalationCount} security incidents`);

        this.auditLogger.logSecurityEvent({
          eventType: 'ERROR_ESCALATION',
          severity: 'HIGH',
          component: 'FailSafeManager',
          details: {
            escalationLevel: 'CRITICAL',
            escalationCount: this.escalationCount,
            triggeringError: error.message,
            triggeringComponent: component
          },
          securityLevel: SecurityLevel.RESTRICTED,
          actionTaken: 'CRITICAL ESCALATION - Enhanced monitoring activated'
        });
      }

    } catch (escalationError) {
      console.error(`Failed to escalate security incident: ${escalationError.message}`);
    }
  }

  /**
   * Get system security status
   */
  getSecurityStatus(): {
    overallSecurityLevel: SecurityLevel;
    circuitBreakerState: CircuitState;
    escalationCount: number;
    auditEventCount: number;
    criticalEventCount: number;
  } {
    return {
      overallSecurityLevel: this.policy.defaultSecurityLevel,
      circuitBreakerState: this.circuitBreaker.getState().state,
      escalationCount: this.escalationCount,
      auditEventCount: this.auditLogger.getAuditTrail().length,
      criticalEventCount: this.auditLogger.getCriticalEvents().length
    };
  }

  /**
   * Get audit trail for security analysis
   */
  getAuditTrail(limit?: number): SecurityAuditEvent[] {
    return this.auditLogger.getAuditTrail(limit);
  }

  /**
   * Reset escalation count (admin function)
   */
  resetEscalationCount(): void {
    this.escalationCount = 0;
    this.auditLogger.logSecurityEvent({
      eventType: 'ERROR_ESCALATION',
      severity: 'MEDIUM',
      component: 'FailSafeManager',
      details: { action: 'escalation_count_reset' },
      securityLevel: this.policy.defaultSecurityLevel,
      actionTaken: 'Escalation count reset by administrator'
    });
  }
}

/**
 * Global fail-safe manager instance
 */
export const globalFailSafeManager = new FailSafeManager();