/**
 * Data Immunity - Data corruption detection and validation
 *
 * @module @claude-flow/agent-immunity/immunities/data
 */

import type { Immunity, ImmunityViolation } from '../immunity-service';

/**
 * Data Immunity
 *
 * Detects data corruption, validates data integrity, and prevents
 * malicious data manipulation. Uses checksums, schemas, and pattern analysis.
 */
export class DataImmunity implements Immunity {
  public readonly name = 'data';
  public readonly weight = 0.75; // High weight - data integrity is important

  private knownSchemas = new Map<string, DataSchema>();
  private dataChecksums = new Map<string, string>();
  private suspiciousPatterns = [
    /\x00/g, // Null bytes
    /[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, // Control characters
    /[^\x20-\x7E\s]/g, // Non-printable characters
    /%00|%2e%2e|%2f/gi, // URL encoded suspicious chars
    /\.\./g, // Path traversal
    /[<>\"']/g // Potential injection chars
  ];

  /**
   * Analyze action for data integrity violations
   */
  public async analyze(actionData: any): Promise<{
    score: number;
    violations: ImmunityViolation[];
  }> {
    try {
      const violations: ImmunityViolation[] = [];

      // Extract data from action
      const dataElements = this.extractDataElements(actionData);

      if (dataElements.length === 0) {
        return { score: 1.0, violations: [] }; // No data to analyze
      }

      // Analyze each data element
      const dataScores: number[] = [];

      for (const element of dataElements) {
        const elementScore = await this.analyzeDataElement(element, violations);
        dataScores.push(elementScore);
      }

      // Check for data corruption patterns
      this.checkDataCorruptionPatterns(actionData, violations);

      // Check for data consistency
      this.checkDataConsistency(dataElements, violations);

      // Check for malicious data patterns
      this.checkMaliciousDataPatterns(dataElements, violations);

      // Overall score is average of all element scores
      const overallScore = dataScores.length > 0
        ? dataScores.reduce((sum, score) => sum + score, 0) / dataScores.length
        : 1.0;

      return { score: overallScore, violations };
    } catch (error) {
      console.warn('📊 Data immunity check failed:', error);
      return { score: 1.0, violations: [] }; // Fail safe
    }
  }

  /**
   * Extract data elements from action
   */
  private extractDataElements(actionData: any): DataElement[] {
    const elements: DataElement[] = [];

    // Extract from task description
    if (actionData.task?.description) {
      elements.push({
        type: 'task_description',
        content: actionData.task.description,
        source: 'task.description'
      });
    }

    // Extract from metadata
    if (actionData.metadata) {
      for (const [key, value] of Object.entries(actionData.metadata)) {
        if (value && typeof value === 'string') {
          elements.push({
            type: 'metadata',
            content: value,
            source: `metadata.${key}`,
            key
          });
        } else if (value && typeof value === 'object') {
          elements.push({
            type: 'json_data',
            content: JSON.stringify(value),
            source: `metadata.${key}`,
            key
          });
        }
      }
    }

    // Extract from agent config
    if (actionData.agent?.config) {
      elements.push({
        type: 'agent_config',
        content: JSON.stringify(actionData.agent.config),
        source: 'agent.config'
      });
    }

    return elements;
  }

  /**
   * Analyze individual data element
   */
  private async analyzeDataElement(element: DataElement, violations: ImmunityViolation[]): Promise<number> {
    let score = 1.0;

    // Check for suspicious patterns
    const suspiciousScore = this.checkSuspiciousPatterns(element, violations);
    score = Math.min(score, suspiciousScore);

    // Check data size
    const sizeScore = this.checkDataSize(element, violations);
    score = Math.min(score, sizeScore);

    // Check encoding
    const encodingScore = this.checkDataEncoding(element, violations);
    score = Math.min(score, encodingScore);

    // Check schema compliance if available
    if (element.key && this.knownSchemas.has(element.key)) {
      const schemaScore = this.checkSchemaCompliance(element, violations);
      score = Math.min(score, schemaScore);
    }

    // Check for data corruption indicators
    const corruptionScore = this.checkDataCorruption(element, violations);
    score = Math.min(score, corruptionScore);

    return score;
  }

  /**
   * Check for suspicious patterns in data
   */
  private checkSuspiciousPatterns(element: DataElement, violations: ImmunityViolation[]): number {
    let score = 1.0;

    for (const pattern of this.suspiciousPatterns) {
      const matches = element.content.match(pattern);
      if (matches) {
        const severity = this.getSuspiciousPatternSeverity(pattern);
        violations.push({
          type: 'suspicious_data_pattern',
          severity,
          score: severity === 'critical' ? 0.0 : 0.5,
          description: `Suspicious pattern detected in ${element.source}`,
          details: {
            pattern: pattern.source,
            matches: matches.length,
            element: element.type,
            source: element.source
          }
        });

        if (severity === 'critical') {
          score = 0.0;
        } else {
          score = Math.min(score, 0.7);
        }
      }
    }

    return score;
  }

  /**
   * Get severity for suspicious pattern
   */
  private getSuspiciousPatternSeverity(pattern: RegExp): 'low' | 'medium' | 'high' | 'critical' {
    const source = pattern.source;

    if (source.includes('\\x00') || source.includes('\\x01')) {
      return 'critical'; // Null bytes and control chars
    }
    if (source.includes('%00') || source.includes('..')) {
      return 'high'; // Path traversal and null byte encoding
    }
    if (source.includes('[<>"\']')) {
      return 'medium'; // Injection characters
    }

    return 'low';
  }

  /**
   * Check data size for abnormalities
   */
  private checkDataSize(element: DataElement, violations: ImmunityViolation[]): number {
    const size = element.content.length;
    const maxSizes = {
      task_description: 10000,  // 10KB
      metadata: 5000,           // 5KB
      json_data: 50000,         // 50KB
      agent_config: 5000        // 5KB
    };

    const maxSize = maxSizes[element.type] || 10000;

    if (size > maxSize) {
      violations.push({
        type: 'excessive_data_size',
        severity: size > maxSize * 2 ? 'high' : 'medium',
        score: Math.max(0, 1.0 - (size / maxSize)),
        description: `Data size exceeds limit: ${this.formatBytes(size)} > ${this.formatBytes(maxSize)}`,
        details: {
          currentSize: size,
          maxSize,
          element: element.type,
          source: element.source
        }
      });

      return Math.max(0.1, 1.0 - (size / maxSize));
    }

    // Check for suspiciously small data that should have content
    if (element.type === 'task_description' && size < 10) {
      violations.push({
        type: 'insufficient_data',
        severity: 'low',
        score: 0.8,
        description: 'Task description is suspiciously short',
        details: {
          size,
          element: element.type,
          source: element.source
        }
      });
      return 0.8;
    }

    return 1.0;
  }

  /**
   * Check data encoding issues
   */
  private checkDataEncoding(element: DataElement, violations: ImmunityViolation[]): number {
    const content = element.content;
    let score = 1.0;

    // Check for invalid UTF-8 sequences (simplified)
    try {
      const encoded = Buffer.from(content, 'utf8');
      const decoded = encoded.toString('utf8');
      if (decoded !== content) {
        violations.push({
          type: 'encoding_mismatch',
          severity: 'medium',
          score: 0.6,
          description: 'Data encoding mismatch detected',
          details: {
            element: element.type,
            source: element.source,
            originalLength: content.length,
            decodedLength: decoded.length
          }
        });
        score = 0.6;
      }
    } catch (error) {
      violations.push({
        type: 'encoding_error',
        severity: 'high',
        score: 0.3,
        description: 'Data encoding error detected',
        details: {
          element: element.type,
          source: element.source,
          error: error.message
        }
      });
      score = 0.3;
    }

    // Check for mixed encoding indicators
    const utf8Pattern = /[\u0080-\uFFFF]/;
    const asciiPattern = /^[\x00-\x7F]*$/;

    if (utf8Pattern.test(content) && !asciiPattern.test(content)) {
      // Mixed encoding might indicate corruption
      const ratio = content.replace(/[\x00-\x7F]/g, '').length / content.length;
      if (ratio > 0.3) {
        violations.push({
          type: 'mixed_encoding',
          severity: 'low',
          score: 0.8,
          description: 'Mixed character encoding detected',
          details: {
            element: element.type,
            source: element.source,
            nonAsciiRatio: ratio
          }
        });
        score = Math.min(score, 0.9);
      }
    }

    return score;
  }

  /**
   * Check schema compliance
   */
  private checkSchemaCompliance(element: DataElement, violations: ImmunityViolation[]): number {
    const schema = this.knownSchemas.get(element.key!);
    if (!schema) return 1.0;

    try {
      if (element.type === 'json_data') {
        const data = JSON.parse(element.content);
        const isValid = this.validateAgainstSchema(data, schema);

        if (!isValid) {
          violations.push({
            type: 'schema_violation',
            severity: 'medium',
            score: 0.5,
            description: `Data does not conform to expected schema for ${element.key}`,
            details: {
              element: element.type,
              source: element.source,
              key: element.key,
              schema: schema.name
            }
          });
          return 0.5;
        }
      }
    } catch (error) {
      violations.push({
        type: 'json_parse_error',
        severity: 'high',
        score: 0.3,
        description: 'Invalid JSON data',
        details: {
          element: element.type,
          source: element.source,
          error: error.message
        }
      });
      return 0.3;
    }

    return 1.0;
  }

  /**
   * Check for data corruption indicators
   */
  private checkDataCorruption(element: DataElement, violations: ImmunityViolation[]): number {
    const content = element.content;
    let score = 1.0;

    // Check for repeated patterns (possible corruption)
    const repeatedPattern = /(.{10,})\1{3,}/g;
    const repeatedMatches = content.match(repeatedPattern);
    if (repeatedMatches) {
      violations.push({
        type: 'data_repetition',
        severity: 'medium',
        score: 0.6,
        description: 'Excessive data repetition detected (possible corruption)',
        details: {
          element: element.type,
          source: element.source,
          repeatedPatterns: repeatedMatches.length
        }
      });
      score = 0.6;
    }

    // Check for truncation indicators
    const truncationPatterns = [
      /\.\.\.$/, // Ends with ellipsis
      /\[truncated\]/i,
      /\[cut off\]/i,
      /\.\.\.\s*$/
    ];

    for (const pattern of truncationPatterns) {
      if (pattern.test(content)) {
        violations.push({
          type: 'data_truncation',
          severity: 'medium',
          score: 0.7,
          description: 'Data truncation detected',
          details: {
            element: element.type,
            source: element.source,
            pattern: pattern.source
          }
        });
        score = Math.min(score, 0.7);
        break;
      }
    }

    // Check for binary data in text fields
    if (element.type === 'task_description' || element.type === 'metadata') {
      const binaryRatio = this.calculateBinaryRatio(content);
      if (binaryRatio > 0.1) {
        violations.push({
          type: 'binary_in_text',
          severity: 'high',
          score: 1.0 - binaryRatio,
          description: 'Binary data detected in text field',
          details: {
            element: element.type,
            source: element.source,
            binaryRatio
          }
        });
        score = Math.min(score, 1.0 - binaryRatio);
      }
    }

    return score;
  }

  /**
   * Check for data corruption patterns across all elements
   */
  private checkDataCorruptionPatterns(actionData: any, violations: ImmunityViolation[]): void {
    // Check for inconsistent timestamps
    const timestamps = this.extractTimestamps(actionData);
    if (timestamps.length > 1) {
      const maxDiff = Math.max(...timestamps) - Math.min(...timestamps);
      if (maxDiff > 24 * 60 * 60 * 1000) { // More than 24 hours difference
        violations.push({
          type: 'timestamp_inconsistency',
          severity: 'medium',
          score: 0.6,
          description: 'Inconsistent timestamps detected across data',
          details: {
            timestampCount: timestamps.length,
            maxDifference: maxDiff,
            maxDifferenceHours: maxDiff / (60 * 60 * 1000)
          }
        });
      }
    }

    // Check for data checksum mismatches
    this.checkDataChecksums(actionData, violations);
  }

  /**
   * Check data consistency across elements
   */
  private checkDataConsistency(elements: DataElement[], violations: ImmunityViolation[]): void {
    // Check for contradictory information
    const contradictions = this.findDataContradictions(elements);
    if (contradictions.length > 0) {
      violations.push({
        type: 'data_contradiction',
        severity: 'medium',
        score: 0.7,
        description: 'Contradictory data detected',
        details: {
          contradictions,
          count: contradictions.length
        }
      });
    }

    // Check for duplicate data
    const duplicates = this.findDuplicateData(elements);
    if (duplicates.length > 0) {
      violations.push({
        type: 'duplicate_data',
        severity: 'low',
        score: 0.9,
        description: 'Duplicate data detected',
        details: {
          duplicates: duplicates.length
        }
      });
    }
  }

  /**
   * Check for malicious data patterns
   */
  private checkMaliciousDataPatterns(elements: DataElement[], violations: ImmunityViolation[]): void {
    for (const element of elements) {
      // Check for polyglot attacks (data that's valid in multiple contexts)
      if (this.isPolyglotPattern(element.content)) {
        violations.push({
          type: 'polyglot_attack',
          severity: 'critical',
          score: 0.0,
          description: 'Potential polyglot attack pattern detected',
          details: {
            element: element.type,
            source: element.source
          }
        });
      }

      // Check for steganography indicators
      if (this.hasSteganographyIndicators(element.content)) {
        violations.push({
          type: 'steganography_indicators',
          severity: 'high',
          score: 0.2,
          description: 'Potential steganography detected',
          details: {
            element: element.type,
            source: element.source
          }
        });
      }
    }
  }

  /**
   * Calculate ratio of binary data in content
   */
  private calculateBinaryRatio(content: string): number {
    const nonPrintableCount = content.replace(/[\x20-\x7E\s]/g, '').length;
    return nonPrintableCount / content.length;
  }

  /**
   * Extract timestamps from action data
   */
  private extractTimestamps(actionData: any): number[] {
    const timestamps: number[] = [];
    const timestampPattern = /\d{13}/g; // Unix timestamps in milliseconds

    const searchText = JSON.stringify(actionData);
    const matches = searchText.match(timestampPattern);

    if (matches) {
      for (const match of matches) {
        const timestamp = parseInt(match, 10);
        if (timestamp > 1000000000000 && timestamp < 2000000000000) { // Valid range
          timestamps.push(timestamp);
        }
      }
    }

    return timestamps;
  }

  /**
   * Check data checksums (simplified)
   */
  private checkDataChecksums(actionData: any, violations: ImmunityViolation[]): void {
    if (actionData.metadata?.checksum && actionData.metadata?.data) {
      const data = JSON.stringify(actionData.metadata.data);
      const expectedChecksum = this.calculateChecksum(data);

      if (actionData.metadata.checksum !== expectedChecksum) {
        violations.push({
          type: 'checksum_mismatch',
          severity: 'critical',
          score: 0.0,
          description: 'Data checksum mismatch - possible corruption or tampering',
          details: {
            expected: expectedChecksum,
            actual: actionData.metadata.checksum
          }
        });
      }
    }
  }

  /**
   * Find data contradictions
   */
  private findDataContradictions(elements: DataElement[]): string[] {
    const contradictions: string[] = [];
    // Simplified contradiction detection
    const booleanPairs = [
      ['true', 'false'],
      ['enabled', 'disabled'],
      ['active', 'inactive'],
      ['secure', 'insecure']
    ];

    for (const [positive, negative] of booleanPairs) {
      const hasPositive = elements.some(el => el.content.toLowerCase().includes(positive));
      const hasNegative = elements.some(el => el.content.toLowerCase().includes(negative));

      if (hasPositive && hasNegative) {
        contradictions.push(`${positive}/${negative}`);
      }
    }

    return contradictions;
  }

  /**
   * Find duplicate data
   */
  private findDuplicateData(elements: DataElement[]): string[] {
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const element of elements) {
      const hash = this.calculateChecksum(element.content);
      if (seen.has(hash)) {
        duplicates.push(element.source);
      } else {
        seen.add(hash);
      }
    }

    return duplicates;
  }

  /**
   * Check for polyglot attack patterns
   */
  private isPolyglotPattern(content: string): boolean {
    // Simplified polyglot detection
    const polyglotIndicators = [
      /<script[^>]*>.*<\/script>/i, // HTML/JS
      /\/\*.*\*\//,                 // CSS/JS comment
      /<!--.*-->/,                  // HTML comment
      /%PDF-/,                      // PDF header
      /\x89PNG/,                    // PNG header
      /GIF89a|GIF87a/               // GIF header
    ];

    let matches = 0;
    for (const indicator of polyglotIndicators) {
      if (indicator.test(content)) {
        matches++;
      }
    }

    return matches >= 2; // Multiple format indicators
  }

  /**
   * Check for steganography indicators
   */
  private hasSteganographyIndicators(content: string): boolean {
    // Check for hidden text patterns
    const hiddenPatterns = [
      /[\u200B-\u200F\u2060\uFEFF]/g, // Zero-width characters
      /[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g, // Various spaces
      /[\uDB40\uDC00-\uDB40\uDCFF]/g // Private use area
    ];

    for (const pattern of hiddenPatterns) {
      if (pattern.test(content)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Validate data against schema (simplified)
   */
  private validateAgainstSchema(data: any, schema: DataSchema): boolean {
    // Simplified schema validation
    for (const [field, type] of Object.entries(schema.fields)) {
      if (schema.required.includes(field) && !(field in data)) {
        return false;
      }
      if (field in data && typeof data[field] !== type) {
        return false;
      }
    }
    return true;
  }

  /**
   * Calculate simple checksum
   */
  private calculateChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  /**
   * Format bytes for display
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Register data schema for validation
   */
  public registerSchema(key: string, schema: DataSchema): void {
    this.knownSchemas.set(key, schema);
  }
}

/**
 * Data element for analysis
 */
interface DataElement {
  type: 'task_description' | 'metadata' | 'json_data' | 'agent_config';
  content: string;
  source: string;
  key?: string;
}

/**
 * Data schema for validation
 */
interface DataSchema {
  name: string;
  fields: Record<string, string>;
  required: string[];
}