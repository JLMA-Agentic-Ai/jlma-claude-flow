/**
 * @claude-flow/security - GDPR Compliance Module
 * Implements GDPR/HIPAA data protection mechanisms
 */

import { z } from 'zod';
import * as crypto from 'crypto';

export interface DataProcessingRecord {
  id: string;
  dataType: DataType;
  purpose: ProcessingPurpose;
  legalBasis: LegalBasis;
  dataSubject: string;
  timestamp: Date;
  retentionPeriod: number; // days
  encryptionMethod?: string;
  pseudonymized: boolean;
  minimized: boolean;
}

export interface ConsentRecord {
  dataSubjectId: string;
  purpose: ProcessingPurpose;
  granted: boolean;
  timestamp: Date;
  withdrawnAt?: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface ErasureRequest {
  id: string;
  dataSubjectId: string;
  requestType: 'deletion' | 'anonymization';
  reason: string;
  submittedAt: Date;
  processedAt?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  affectedSystems: string[];
}

export enum DataType {
  PERSONAL_IDENTIFIER = 'personal_identifier',
  CONTACT_INFO = 'contact_info',
  FINANCIAL = 'financial',
  HEALTH = 'health',
  BEHAVIORAL = 'behavioral',
  TECHNICAL = 'technical',
  BIOMETRIC = 'biometric',
  SPECIAL_CATEGORY = 'special_category'
}

export enum ProcessingPurpose {
  SERVICE_PROVISION = 'service_provision',
  PERFORMANCE_IMPROVEMENT = 'performance_improvement',
  SECURITY = 'security',
  ANALYTICS = 'analytics',
  MARKETING = 'marketing',
  COMPLIANCE = 'compliance',
  RESEARCH = 'research'
}

export enum LegalBasis {
  CONSENT = 'consent',
  CONTRACT = 'contract',
  LEGAL_OBLIGATION = 'legal_obligation',
  VITAL_INTERESTS = 'vital_interests',
  PUBLIC_TASK = 'public_task',
  LEGITIMATE_INTERESTS = 'legitimate_interests'
}

// Validation schemas
const gdprSchemas = {
  personalData: z.object({
    email: z.string().email().optional(),
    phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
    name: z.string().max(100).optional(),
    address: z.string().max(500).optional(),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    nationalId: z.string().max(50).optional()
  }),

  consentRequest: z.object({
    dataSubjectId: z.string().uuid(),
    purpose: z.nativeEnum(ProcessingPurpose),
    dataTypes: z.array(z.nativeEnum(DataType)),
    description: z.string().max(1000),
    mandatory: z.boolean().default(false)
  }),

  erasureRequest: z.object({
    dataSubjectId: z.string().uuid(),
    requestType: z.enum(['deletion', 'anonymization']),
    reason: z.string().max(1000),
    specificData: z.array(z.string()).optional()
  })
};

export class GDPRCompliance {
  private processingLog: DataProcessingRecord[] = [];
  private consentRecords: Map<string, ConsentRecord[]> = new Map();
  private erasureRequests: Map<string, ErasureRequest> = new Map();
  private encryptionKey: Buffer;
  private retentionPolicies: Map<DataType, number> = new Map();

  constructor(encryptionKey?: string) {
    this.encryptionKey = encryptionKey
      ? Buffer.from(encryptionKey, 'base64')
      : crypto.randomBytes(32);

    // Default retention periods (in days)
    this.initializeRetentionPolicies();
  }

  private initializeRetentionPolicies(): void {
    this.retentionPolicies.set(DataType.PERSONAL_IDENTIFIER, 2555); // 7 years
    this.retentionPolicies.set(DataType.CONTACT_INFO, 1095); // 3 years
    this.retentionPolicies.set(DataType.FINANCIAL, 2555); // 7 years
    this.retentionPolicies.set(DataType.HEALTH, 3650); // 10 years
    this.retentionPolicies.set(DataType.BEHAVIORAL, 730); // 2 years
    this.retentionPolicies.set(DataType.TECHNICAL, 365); // 1 year
    this.retentionPolicies.set(DataType.BIOMETRIC, 1825); // 5 years
    this.retentionPolicies.set(DataType.SPECIAL_CATEGORY, 1095); // 3 years
  }

  /**
   * Log data processing activity for GDPR compliance
   */
  public logDataProcessing(
    dataType: DataType,
    purpose: ProcessingPurpose,
    legalBasis: LegalBasis,
    dataSubject: string,
    options: {
      encryptionMethod?: string;
      pseudonymized?: boolean;
      minimized?: boolean;
      customRetention?: number;
    } = {}
  ): string {
    const record: DataProcessingRecord = {
      id: crypto.randomUUID(),
      dataType,
      purpose,
      legalBasis,
      dataSubject,
      timestamp: new Date(),
      retentionPeriod: options.customRetention || this.retentionPolicies.get(dataType) || 365,
      encryptionMethod: options.encryptionMethod,
      pseudonymized: options.pseudonymized || false,
      minimized: options.minimized || true
    };

    this.processingLog.push(record);
    return record.id;
  }

  /**
   * Record user consent for data processing
   */
  public recordConsent(
    dataSubjectId: string,
    purpose: ProcessingPurpose,
    granted: boolean,
    metadata: {
      ipAddress?: string;
      userAgent?: string;
    } = {}
  ): void {
    const consent: ConsentRecord = {
      dataSubjectId,
      purpose,
      granted,
      timestamp: new Date(),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent
    };

    if (!this.consentRecords.has(dataSubjectId)) {
      this.consentRecords.set(dataSubjectId, []);
    }

    this.consentRecords.get(dataSubjectId)!.push(consent);
  }

  /**
   * Withdraw consent for data processing
   */
  public withdrawConsent(dataSubjectId: string, purpose: ProcessingPurpose): boolean {
    const consents = this.consentRecords.get(dataSubjectId);
    if (!consents) return false;

    const latestConsent = consents
      .filter(c => c.purpose === purpose && c.granted && !c.withdrawnAt)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    if (latestConsent) {
      latestConsent.withdrawnAt = new Date();
      return true;
    }

    return false;
  }

  /**
   * Check if consent is valid for a specific purpose
   */
  public hasValidConsent(dataSubjectId: string, purpose: ProcessingPurpose): boolean {
    const consents = this.consentRecords.get(dataSubjectId);
    if (!consents) return false;

    const latestConsent = consents
      .filter(c => c.purpose === purpose)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    return latestConsent?.granted && !latestConsent.withdrawnAt;
  }

  /**
   * Submit right to erasure request
   */
  public submitErasureRequest(
    dataSubjectId: string,
    requestType: 'deletion' | 'anonymization',
    reason: string,
    specificData?: string[]
  ): string {
    const request: ErasureRequest = {
      id: crypto.randomUUID(),
      dataSubjectId,
      requestType,
      reason,
      submittedAt: new Date(),
      status: 'pending',
      affectedSystems: this.identifyAffectedSystems(dataSubjectId)
    };

    this.erasureRequests.set(request.id, request);
    return request.id;
  }

  private identifyAffectedSystems(dataSubjectId: string): string[] {
    // In a real implementation, this would query all systems
    // that might contain data for this subject
    return ['user_database', 'analytics_db', 'log_files', 'backup_systems'];
  }

  /**
   * Process erasure request
   */
  public async processErasureRequest(requestId: string): Promise<boolean> {
    const request = this.erasureRequests.get(requestId);
    if (!request || request.status !== 'pending') return false;

    try {
      request.status = 'in_progress';

      // Remove processing records for this data subject
      this.processingLog = this.processingLog.filter(
        record => record.dataSubject !== request.dataSubjectId
      );

      // Remove consent records
      this.consentRecords.delete(request.dataSubjectId);

      // In a real implementation, you would:
      // 1. Remove data from all identified systems
      // 2. Anonymize or pseudonymize data that cannot be deleted
      // 3. Update backup systems
      // 4. Notify third parties

      request.status = 'completed';
      request.processedAt = new Date();

      return true;
    } catch (error) {
      request.status = 'rejected';
      console.error(`Failed to process erasure request ${requestId}:`, error);
      return false;
    }
  }

  /**
   * Encrypt personal data
   */
  public encryptPersonalData(data: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt personal data
   */
  public decryptPersonalData(encryptedData: string): string {
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Pseudonymize data subject identifier
   */
  public pseudonymize(dataSubjectId: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(dataSubjectId + this.encryptionKey.toString('hex'));
    return hash.digest('hex').substring(0, 16);
  }

  /**
   * Data minimization - remove unnecessary fields
   */
  public minimizeData<T extends Record<string, any>>(
    data: T,
    necessaryFields: (keyof T)[]
  ): Partial<T> {
    const minimized: Partial<T> = {};

    for (const field of necessaryFields) {
      if (data[field] !== undefined) {
        minimized[field] = data[field];
      }
    }

    return minimized;
  }

  /**
   * Check if data retention period has expired
   */
  public isRetentionExpired(record: DataProcessingRecord): boolean {
    const expiryDate = new Date(record.timestamp);
    expiryDate.setDate(expiryDate.getDate() + record.retentionPeriod);
    return new Date() > expiryDate;
  }

  /**
   * Get expired data for cleanup
   */
  public getExpiredData(): DataProcessingRecord[] {
    return this.processingLog.filter(record => this.isRetentionExpired(record));
  }

  /**
   * Generate GDPR compliance report
   */
  public generateComplianceReport(): {
    totalRecords: number;
    recordsByType: Record<DataType, number>;
    recordsByPurpose: Record<ProcessingPurpose, number>;
    consentStats: {
      totalConsents: number;
      grantedConsents: number;
      withdrawnConsents: number;
    };
    erasureStats: {
      totalRequests: number;
      pendingRequests: number;
      completedRequests: number;
    };
    expiredData: number;
  } {
    const recordsByType: Record<DataType, number> = {} as any;
    const recordsByPurpose: Record<ProcessingPurpose, number> = {} as any;

    for (const record of this.processingLog) {
      recordsByType[record.dataType] = (recordsByType[record.dataType] || 0) + 1;
      recordsByPurpose[record.purpose] = (recordsByPurpose[record.purpose] || 0) + 1;
    }

    const allConsents = Array.from(this.consentRecords.values()).flat();
    const grantedConsents = allConsents.filter(c => c.granted && !c.withdrawnAt).length;
    const withdrawnConsents = allConsents.filter(c => c.withdrawnAt).length;

    const erasureRequestsArray = Array.from(this.erasureRequests.values());
    const pendingRequests = erasureRequestsArray.filter(r => r.status === 'pending').length;
    const completedRequests = erasureRequestsArray.filter(r => r.status === 'completed').length;

    return {
      totalRecords: this.processingLog.length,
      recordsByType,
      recordsByPurpose,
      consentStats: {
        totalConsents: allConsents.length,
        grantedConsents,
        withdrawnConsents
      },
      erasureStats: {
        totalRequests: erasureRequestsArray.length,
        pendingRequests,
        completedRequests
      },
      expiredData: this.getExpiredData().length
    };
  }

  /**
   * Validate personal data against GDPR requirements
   */
  public validatePersonalData(data: any): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      gdprSchemas.personalData.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(...error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`));
      }
    }

    // Check for common PII patterns that might be missed
    const dataString = JSON.stringify(data);

    if (/\b\d{4}-\d{4}-\d{4}-\d{4}\b/.test(dataString)) {
      warnings.push('Potential credit card number detected');
    }

    if (/\b\d{3}-\d{2}-\d{4}\b/.test(dataString)) {
      warnings.push('Potential SSN detected');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// Export utility functions
export const gdprUtils = {
  schemas: gdprSchemas,

  isPersonalData(value: string): boolean {
    const patterns = [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{4}-\d{4}-\d{4}-\d{4}\b/, // Credit card
      /^\+?[1-9]\d{1,14}$/, // Phone number
      /\b\d{1,2}\/\d{1,2}\/\d{4}\b/ // Date patterns
    ];

    return patterns.some(pattern => pattern.test(value));
  },

  maskPersonalData(value: string): string {
    return value
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, 'user@example.com')
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, 'XXX-XX-XXXX')
      .replace(/\b\d{4}-\d{4}-\d{4}-\d{4}\b/g, 'XXXX-XXXX-XXXX-XXXX')
      .replace(/^\+?[1-9]\d{1,14}$/g, '+1-XXX-XXX-XXXX');
  }
};