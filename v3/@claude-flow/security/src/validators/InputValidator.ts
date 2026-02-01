/**
 * @claude-flow/security - Input Validation Module
 * Comprehensive input validation and sanitization for security hardening
 * GDPR/HIPAA compliant data processing
 */

import { z } from 'zod';

export interface ValidationResult {
  isValid: boolean;
  sanitizedData?: any;
  errors?: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityConfig {
  enableStrictValidation: boolean;
  maxStringLength: number;
  maxArrayLength: number;
  allowedFileExtensions: string[];
  maxFileSizeBytes: number;
  enableReDoSProtection: boolean;
  timeoutMs: number;
}

export class InputValidator {
  private config: SecurityConfig;
  private patterns: Map<string, RegExp>;

  constructor(config?: Partial<SecurityConfig>) {
    this.config = {
      enableStrictValidation: true,
      maxStringLength: 10000,
      maxArrayLength: 1000,
      allowedFileExtensions: ['.ts', '.js', '.json', '.md', '.txt'],
      maxFileSizeBytes: 10 * 1024 * 1024, // 10MB
      enableReDoSProtection: true,
      timeoutMs: 100,
      ...config
    };

    this.initializePatterns();
  }

  private initializePatterns(): void {
    this.patterns = new Map([
      // SQL injection patterns
      ['sql_injection', /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bDELETE\b|\bUPDATE\b|\bDROP\b|\bCREATE\b|\bALTER\b)(?:\s|\/\*|\*\/|--|#|\/\*|\*\/)/i],

      // Command injection patterns
      ['command_injection', /[;&|`$(){}[\]<>'"\\]/],

      // XSS patterns
      ['xss', /<script|javascript:|vbscript:|onload=|onerror=|onclick=|onmouseover=/i],

      // Path traversal patterns
      ['path_traversal', /\.{2}[\/\\]|[\/\\]\.{2}/],

      // PII patterns (GDPR/HIPAA compliance)
      ['ssn', /\b\d{3}-?\d{2}-?\d{4}\b/],
      ['credit_card', /\b(?:\d{4}[-\s]?){3}\d{4}\b/],
      ['email', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/],
      ['api_key', /\b(?:sk-|pk_|rk_|ak_)[a-zA-Z0-9]{32,}/],

      // ReDoS vulnerable patterns (with timeout protection)
      ['redos_nested', /^(a+)+$/],
      ['redos_alternation', /^(a|a)*$/],
      ['redos_grouping', /^(a*)*$/]
    ]);
  }

  /**
   * Main validation entry point with comprehensive security checks
   */
  public async validate(input: any, schema?: z.ZodSchema): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      // Timeout protection for ReDoS
      if (this.config.enableReDoSProtection) {
        const timeoutPromise = new Promise<ValidationResult>((_, reject) => {
          setTimeout(() => reject(new Error('Validation timeout - potential ReDoS attack')), this.config.timeoutMs);
        });

        const validationPromise = this.performValidation(input, schema);
        return await Promise.race([validationPromise, timeoutPromise]);
      }

      return await this.performValidation(input, schema);

    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation failed: ${error.message}`],
        riskLevel: 'critical'
      };
    } finally {
      const duration = Date.now() - startTime;
      if (duration > this.config.timeoutMs) {
        console.warn(`Validation took ${duration}ms - potential ReDoS detected`);
      }
    }
  }

  private async performValidation(input: any, schema?: z.ZodSchema): Promise<ValidationResult> {
    const errors: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Type-based validation
    const typeValidation = this.validateType(input);
    if (!typeValidation.isValid) {
      errors.push(...typeValidation.errors);
      riskLevel = this.elevateRiskLevel(riskLevel, typeValidation.riskLevel);
    }

    // Security pattern validation
    const securityValidation = this.validateSecurityPatterns(input);
    if (!securityValidation.isValid) {
      errors.push(...securityValidation.errors);
      riskLevel = this.elevateRiskLevel(riskLevel, securityValidation.riskLevel);
    }

    // Schema validation (if provided)
    if (schema) {
      try {
        const parsed = schema.parse(input);
        return {
          isValid: errors.length === 0,
          sanitizedData: this.sanitizeData(parsed),
          errors: errors.length > 0 ? errors : undefined,
          riskLevel
        };
      } catch (zodError) {
        errors.push(`Schema validation failed: ${zodError.message}`);
        riskLevel = this.elevateRiskLevel(riskLevel, 'medium');
      }
    }

    return {
      isValid: errors.length === 0,
      sanitizedData: this.sanitizeData(input),
      errors: errors.length > 0 ? errors : undefined,
      riskLevel
    };
  }

  private validateType(input: any): ValidationResult {
    const errors: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    if (typeof input === 'string') {
      if (input.length > this.config.maxStringLength) {
        errors.push(`String exceeds maximum length of ${this.config.maxStringLength}`);
        riskLevel = 'medium';
      }
    } else if (Array.isArray(input)) {
      if (input.length > this.config.maxArrayLength) {
        errors.push(`Array exceeds maximum length of ${this.config.maxArrayLength}`);
        riskLevel = 'medium';
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      riskLevel
    };
  }

  private validateSecurityPatterns(input: any): ValidationResult {
    const errors: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    const stringToCheck = typeof input === 'string' ? input : JSON.stringify(input);

    for (const [patternName, pattern] of this.patterns) {
      if (pattern.test(stringToCheck)) {
        const risk = this.getRiskLevelForPattern(patternName);
        errors.push(`Detected ${patternName.replace('_', ' ')} pattern`);
        riskLevel = this.elevateRiskLevel(riskLevel, risk);
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      riskLevel
    };
  }

  private getRiskLevelForPattern(patternName: string): 'low' | 'medium' | 'high' | 'critical' {
    const criticalPatterns = ['sql_injection', 'command_injection', 'xss'];
    const highPatterns = ['path_traversal', 'api_key'];
    const mediumPatterns = ['ssn', 'credit_card', 'redos_nested', 'redos_alternation', 'redos_grouping'];

    if (criticalPatterns.includes(patternName)) return 'critical';
    if (highPatterns.includes(patternName)) return 'high';
    if (mediumPatterns.includes(patternName)) return 'medium';
    return 'low';
  }

  private elevateRiskLevel(
    current: 'low' | 'medium' | 'high' | 'critical',
    new_level: 'low' | 'medium' | 'high' | 'critical'
  ): 'low' | 'medium' | 'high' | 'critical' {
    const levels = { low: 1, medium: 2, high: 3, critical: 4 };
    const maxLevel = Math.max(levels[current], levels[new_level]);
    return Object.keys(levels)[maxLevel - 1] as 'low' | 'medium' | 'high' | 'critical';
  }

  private sanitizeData(input: any): any {
    if (typeof input === 'string') {
      return input
        .replace(/[<>&'"]/g, (match) => {
          const htmlEntities = { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&#x27;', '"': '&quot;' };
          return htmlEntities[match] || match;
        })
        .trim();
    }

    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeData(item));
    }

    if (input && typeof input === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[this.sanitizeData(key)] = this.sanitizeData(value);
      }
      return sanitized;
    }

    return input;
  }

  /**
   * GDPR-compliant PII detection and masking
   */
  public maskPII(input: string): string {
    return input
      .replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, 'XXX-XX-XXXX')  // SSN
      .replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, 'XXXX-XXXX-XXXX-XXXX')  // Credit Card
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, 'user@example.com')  // Email
      .replace(/\b(?:sk-|pk_|rk_|ak_)[a-zA-Z0-9]{32,}/g, 'sk-XXXXXXXXXXXXXXXXXX');  // API Keys
  }

  /**
   * Rate limiting check (basic implementation)
   */
  private rateLimitCache = new Map<string, { count: number; resetTime: number }>();

  public checkRateLimit(identifier: string, limit = 100, windowMs = 60000): boolean {
    const now = Date.now();
    const entry = this.rateLimitCache.get(identifier);

    if (!entry || now > entry.resetTime) {
      this.rateLimitCache.set(identifier, { count: 1, resetTime: now + windowMs });
      return true;
    }

    if (entry.count >= limit) {
      return false;
    }

    entry.count++;
    return true;
  }
}

// Export validation schemas
export const securitySchemas = {
  fileName: z.string().regex(/^[a-zA-Z0-9_.-]+$/, 'Invalid filename'),
  filePath: z.string().regex(/^[a-zA-Z0-9_.\/-]+$/, 'Invalid file path').refine(
    (path) => !path.includes('..'), 'Path traversal not allowed'
  ),
  sqlIdentifier: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Invalid SQL identifier'),
  commandArg: z.string().regex(/^[a-zA-Z0-9_.-]+$/, 'Invalid command argument'),
  port: z.number().int().min(1).max(65535),
  url: z.string().url(),
  email: z.string().email(),
  semver: z.string().regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/, 'Invalid semantic version')
};