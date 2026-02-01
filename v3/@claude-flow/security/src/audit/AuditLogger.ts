/**
 * @claude-flow/security - Audit Logging System
 * SOC2/HIPAA compliant audit trail for security events
 */

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  severity: AuditSeverity;
  actor: AuditActor;
  resource: AuditResource;
  action: string;
  outcome: 'success' | 'failure' | 'unknown';
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  correlationId?: string;
  signature?: string; // Digital signature for tamper detection
}

export interface AuditActor {
  type: 'user' | 'system' | 'service' | 'anonymous';
  id: string;
  name?: string;
  roles?: string[];
  permissions?: string[];
}

export interface AuditResource {
  type: string;
  id: string;
  name?: string;
  attributes?: Record<string, any>;
}

export enum AuditEventType {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  DATA_ACCESS = 'data_access',
  DATA_MODIFICATION = 'data_modification',
  SYSTEM_CONFIGURATION = 'system_configuration',
  SECURITY_EVENT = 'security_event',
  COMPLIANCE_EVENT = 'compliance_event',
  ERROR = 'error',
  PERFORMANCE = 'performance'
}

export enum AuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface AuditConfig {
  logDirectory: string;
  maxFileSize: number; // bytes
  maxFiles: number;
  enableEncryption: boolean;
  enableSigning: boolean;
  encryptionKey?: string;
  signingKey?: string;
  bufferSize: number;
  flushInterval: number; // ms
  enableRemoteLogging: boolean;
  remoteEndpoint?: string;
}

// Schema for audit event validation
const auditEventSchema = z.object({
  eventType: z.nativeEnum(AuditEventType),
  severity: z.nativeEnum(AuditSeverity),
  actor: z.object({
    type: z.enum(['user', 'system', 'service', 'anonymous']),
    id: z.string().min(1),
    name: z.string().optional(),
    roles: z.array(z.string()).optional(),
    permissions: z.array(z.string()).optional()
  }),
  resource: z.object({
    type: z.string().min(1),
    id: z.string().min(1),
    name: z.string().optional(),
    attributes: z.record(z.any()).optional()
  }),
  action: z.string().min(1),
  outcome: z.enum(['success', 'failure', 'unknown']),
  details: z.record(z.any()),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().optional(),
  sessionId: z.string().optional(),
  correlationId: z.string().optional()
});

export class AuditLogger {
  private config: AuditConfig;
  private buffer: AuditEvent[] = [];
  private currentFileHandle?: fs.FileHandle;
  private currentFileSize = 0;
  private currentFileIndex = 0;
  private flushTimer?: NodeJS.Timeout;
  private encryptionKey?: Buffer;
  private signingKey?: Buffer;

  constructor(config: Partial<AuditConfig> = {}) {
    this.config = {
      logDirectory: './logs/audit',
      maxFileSize: 50 * 1024 * 1024, // 50MB
      maxFiles: 100,
      enableEncryption: true,
      enableSigning: true,
      bufferSize: 1000,
      flushInterval: 5000, // 5 seconds
      enableRemoteLogging: false,
      ...config
    };

    this.initializeKeys();
    this.startFlushTimer();
  }

  private initializeKeys(): void {
    if (this.config.enableEncryption) {
      this.encryptionKey = this.config.encryptionKey
        ? Buffer.from(this.config.encryptionKey, 'base64')
        : crypto.randomBytes(32);
    }

    if (this.config.enableSigning) {
      this.signingKey = this.config.signingKey
        ? Buffer.from(this.config.signingKey, 'base64')
        : crypto.randomBytes(64);
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(error => {
        console.error('Failed to flush audit logs:', error);
      });
    }, this.config.flushInterval);
  }

  /**
   * Log an audit event
   */
  public async log(
    eventType: AuditEventType,
    severity: AuditSeverity,
    actor: AuditActor,
    resource: AuditResource,
    action: string,
    outcome: 'success' | 'failure' | 'unknown',
    details: Record<string, any> = {},
    metadata: {
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
      correlationId?: string;
    } = {}
  ): Promise<void> {
    try {
      // Validate input
      const validatedEvent = auditEventSchema.parse({
        eventType,
        severity,
        actor,
        resource,
        action,
        outcome,
        details,
        ...metadata
      });

      const event: AuditEvent = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        ...validatedEvent
      };

      // Add digital signature if enabled
      if (this.config.enableSigning && this.signingKey) {
        event.signature = this.signEvent(event);
      }

      // Add to buffer
      this.buffer.push(event);

      // Flush if buffer is full
      if (this.buffer.length >= this.config.bufferSize) {
        await this.flush();
      }

      // Send to remote logging if enabled
      if (this.config.enableRemoteLogging) {
        await this.sendToRemoteLogger(event);
      }

    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw - audit logging should not break application flow
    }
  }

  private signEvent(event: Omit<AuditEvent, 'signature'>): string {
    if (!this.signingKey) return '';

    const eventData = {
      id: event.id,
      timestamp: event.timestamp.toISOString(),
      eventType: event.eventType,
      actor: event.actor,
      resource: event.resource,
      action: event.action,
      outcome: event.outcome
    };

    const dataString = JSON.stringify(eventData, Object.keys(eventData).sort());
    return crypto.createHmac('sha256', this.signingKey)
      .update(dataString)
      .digest('hex');
  }

  /**
   * Verify the integrity of an audit event
   */
  public verifyEventSignature(event: AuditEvent): boolean {
    if (!event.signature || !this.signingKey) return false;

    const eventWithoutSignature = { ...event };
    delete eventWithoutSignature.signature;

    const expectedSignature = this.signEvent(eventWithoutSignature);
    return crypto.timingSafeEqual(
      Buffer.from(event.signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Flush buffered events to disk
   */
  public async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    try {
      await this.ensureLogDirectory();
      await this.rotateLogFileIfNeeded();

      const events = this.buffer.splice(0);
      const logEntries = events.map(event => JSON.stringify(event) + '\n').join('');

      if (this.config.enableEncryption && this.encryptionKey) {
        const encrypted = this.encryptData(logEntries);
        await this.writeToLogFile(encrypted);
      } else {
        await this.writeToLogFile(logEntries);
      }

    } catch (error) {
      console.error('Failed to flush audit logs to disk:', error);
      // Put events back in buffer for retry
      this.buffer.unshift(...events);
    }
  }

  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.access(this.config.logDirectory);
    } catch {
      await fs.mkdir(this.config.logDirectory, { recursive: true });
    }
  }

  private async rotateLogFileIfNeeded(): Promise<void> {
    if (this.currentFileSize >= this.config.maxFileSize) {
      await this.closeCurrentFile();
      this.currentFileIndex++;
      this.currentFileSize = 0;

      // Remove old files if we exceed max files
      await this.cleanupOldLogs();
    }
  }

  private async closeCurrentFile(): Promise<void> {
    if (this.currentFileHandle) {
      await this.currentFileHandle.close();
      this.currentFileHandle = undefined;
    }
  }

  private async getCurrentFileHandle(): Promise<fs.FileHandle> {
    if (!this.currentFileHandle) {
      const fileName = `audit-${this.currentFileIndex.toString().padStart(6, '0')}.log`;
      const filePath = path.join(this.config.logDirectory, fileName);

      this.currentFileHandle = await fs.open(filePath, 'a');

      // Get current file size
      const stats = await this.currentFileHandle.stat();
      this.currentFileSize = stats.size;
    }

    return this.currentFileHandle;
  }

  private async writeToLogFile(data: string): Promise<void> {
    const fileHandle = await this.getCurrentFileHandle();
    const buffer = Buffer.from(data, 'utf8');

    await fileHandle.write(buffer);
    this.currentFileSize += buffer.length;
  }

  private encryptData(data: string): string {
    if (!this.encryptionKey) return data;

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  private decryptData(encryptedData: string): string {
    if (!this.encryptionKey) return encryptedData;

    const parts = encryptedData.split(':');
    if (parts.length !== 3) return encryptedData;

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  private async cleanupOldLogs(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.logDirectory);
      const logFiles = files
        .filter(file => file.startsWith('audit-') && file.endsWith('.log'))
        .sort();

      if (logFiles.length > this.config.maxFiles) {
        const filesToDelete = logFiles.slice(0, logFiles.length - this.config.maxFiles);

        for (const file of filesToDelete) {
          const filePath = path.join(this.config.logDirectory, file);
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup old log files:', error);
    }
  }

  private async sendToRemoteLogger(event: AuditEvent): Promise<void> {
    if (!this.config.remoteEndpoint) return;

    try {
      // In a real implementation, you would send to a remote logging service
      // such as Splunk, ElasticSearch, or a SIEM system
      console.log(`Would send to remote logger: ${this.config.remoteEndpoint}`, {
        eventId: event.id,
        eventType: event.eventType,
        severity: event.severity
      });
    } catch (error) {
      console.warn('Failed to send audit event to remote logger:', error);
    }
  }

  /**
   * Search audit logs (simplified implementation)
   */
  public async search(criteria: {
    eventType?: AuditEventType;
    severity?: AuditSeverity;
    actorId?: string;
    resourceType?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
  }): Promise<AuditEvent[]> {
    // In a real implementation, this would efficiently search through log files
    // or query a database. For now, return events from the current buffer.

    let results = this.buffer;

    if (criteria.eventType) {
      results = results.filter(event => event.eventType === criteria.eventType);
    }

    if (criteria.severity) {
      results = results.filter(event => event.severity === criteria.severity);
    }

    if (criteria.actorId) {
      results = results.filter(event => event.actor.id === criteria.actorId);
    }

    if (criteria.resourceType) {
      results = results.filter(event => event.resource.type === criteria.resourceType);
    }

    if (criteria.fromDate) {
      results = results.filter(event => event.timestamp >= criteria.fromDate!);
    }

    if (criteria.toDate) {
      results = results.filter(event => event.timestamp <= criteria.toDate!);
    }

    const limit = criteria.limit || 100;
    return results.slice(0, limit);
  }

  /**
   * Generate audit report
   */
  public async generateReport(fromDate: Date, toDate: Date): Promise<{
    totalEvents: number;
    eventsByType: Record<AuditEventType, number>;
    eventsBySeverity: Record<AuditSeverity, number>;
    failedOperations: number;
    topActors: Array<{ actorId: string; eventCount: number }>;
    topResources: Array<{ resourceType: string; eventCount: number }>;
  }> {
    const events = await this.search({ fromDate, toDate, limit: 10000 });

    const eventsByType = {} as Record<AuditEventType, number>;
    const eventsBySeverity = {} as Record<AuditSeverity, number>;
    const actorCounts = new Map<string, number>();
    const resourceTypeCounts = new Map<string, number>();

    let failedOperations = 0;

    for (const event of events) {
      // Count by type
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;

      // Count by severity
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;

      // Count failed operations
      if (event.outcome === 'failure') {
        failedOperations++;
      }

      // Count by actor
      const currentActorCount = actorCounts.get(event.actor.id) || 0;
      actorCounts.set(event.actor.id, currentActorCount + 1);

      // Count by resource type
      const currentResourceCount = resourceTypeCounts.get(event.resource.type) || 0;
      resourceTypeCounts.set(event.resource.type, currentResourceCount + 1);
    }

    // Get top actors and resources
    const topActors = Array.from(actorCounts.entries())
      .map(([actorId, eventCount]) => ({ actorId, eventCount }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10);

    const topResources = Array.from(resourceTypeCounts.entries())
      .map(([resourceType, eventCount]) => ({ resourceType, eventCount }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10);

    return {
      totalEvents: events.length,
      eventsByType,
      eventsBySeverity,
      failedOperations,
      topActors,
      topResources
    };
  }

  /**
   * Close the audit logger and flush remaining events
   */
  public async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    await this.flush();
    await this.closeCurrentFile();
  }
}

// Convenience methods for common audit events
export class SecurityAuditLogger extends AuditLogger {

  public async logAuthentication(
    userId: string,
    action: string,
    outcome: 'success' | 'failure',
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    return this.log(
      AuditEventType.AUTHENTICATION,
      outcome === 'failure' ? AuditSeverity.HIGH : AuditSeverity.MEDIUM,
      { type: 'user', id: userId },
      { type: 'authentication_system', id: 'auth' },
      action,
      outcome,
      {},
      { ipAddress, userAgent }
    );
  }

  public async logDataAccess(
    userId: string,
    resourceId: string,
    resourceType: string,
    action: string,
    outcome: 'success' | 'failure'
  ): Promise<void> {
    return this.log(
      AuditEventType.DATA_ACCESS,
      AuditSeverity.MEDIUM,
      { type: 'user', id: userId },
      { type: resourceType, id: resourceId },
      action,
      outcome
    );
  }

  public async logSecurityEvent(
    eventDescription: string,
    severity: AuditSeverity,
    actorId: string,
    details: Record<string, any> = {}
  ): Promise<void> {
    return this.log(
      AuditEventType.SECURITY_EVENT,
      severity,
      { type: 'system', id: actorId },
      { type: 'security_system', id: 'security' },
      eventDescription,
      'unknown',
      details
    );
  }
}