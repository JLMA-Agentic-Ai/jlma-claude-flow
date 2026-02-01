/**
 * Unit Tests for Antibody Pattern Matching System
 * Tests pattern detection, learning mechanisms, and adaptive immunity
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AntibodySystem } from '../../../src/immunity/core/AntibodySystem';
import { PatternMatcher } from '../../../src/immunity/core/PatternMatcher';
import { ImmunityPattern, MatchResult } from '../../../src/immunity/types';

describe('AntibodySystem', () => {
  let antibodySystem: AntibodySystem;
  let patternMatcher: PatternMatcher;

  beforeEach(() => {
    patternMatcher = new PatternMatcher();
    antibodySystem = new AntibodySystem({
      patternMatcher,
      learningRate: 0.1,
      adaptationEnabled: true,
      maxPatterns: 1000
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Pattern Registration and Management', () => {
    it('should register new immunity patterns', async () => {
      const sqlInjectionPattern: ImmunityPattern = {
        id: 'sql-injection-001',
        type: 'security',
        name: 'SQL Injection Detection',
        pattern: /SELECT\s+.*\s+FROM\s+.*\s+WHERE\s+.*=.*\+/gi,
        confidence: 0.8,
        severity: 'high',
        description: 'Detects basic SQL injection patterns',
        metadata: {
          category: 'injection',
          cwe: 'CWE-89'
        }
      };

      const registered = await antibodySystem.registerPattern(sqlInjectionPattern);

      expect(registered).toBe(true);
      expect(antibodySystem.getPatternCount()).toBe(1);
      expect(antibodySystem.hasPattern('sql-injection-001')).toBe(true);
    });

    it('should prevent duplicate pattern registration', async () => {
      const pattern: ImmunityPattern = {
        id: 'duplicate-test',
        type: 'security',
        name: 'Test Pattern',
        pattern: /test/,
        confidence: 0.5
      };

      await antibodySystem.registerPattern(pattern);
      const duplicate = await antibodySystem.registerPattern(pattern);

      expect(duplicate).toBe(false);
      expect(antibodySystem.getPatternCount()).toBe(1);
    });

    it('should update existing patterns', async () => {
      const originalPattern: ImmunityPattern = {
        id: 'updateable-pattern',
        type: 'security',
        name: 'Original Pattern',
        pattern: /original/,
        confidence: 0.5
      };

      await antibodySystem.registerPattern(originalPattern);

      const updatedPattern: ImmunityPattern = {
        ...originalPattern,
        name: 'Updated Pattern',
        confidence: 0.8,
        pattern: /updated/
      };

      const updated = await antibodySystem.updatePattern('updateable-pattern', updatedPattern);

      expect(updated).toBe(true);

      const retrieved = antibodySystem.getPattern('updateable-pattern');
      expect(retrieved?.name).toBe('Updated Pattern');
      expect(retrieved?.confidence).toBe(0.8);
    });

    it('should remove patterns correctly', async () => {
      const pattern: ImmunityPattern = {
        id: 'removable-pattern',
        type: 'security',
        name: 'Removable Pattern',
        pattern: /remove/,
        confidence: 0.6
      };

      await antibodySystem.registerPattern(pattern);
      expect(antibodySystem.getPatternCount()).toBe(1);

      const removed = await antibodySystem.removePattern('removable-pattern');
      expect(removed).toBe(true);
      expect(antibodySystem.getPatternCount()).toBe(0);
      expect(antibodySystem.hasPattern('removable-pattern')).toBe(false);
    });
  });

  describe('Pattern Matching and Detection', () => {
    beforeEach(async () => {
      // Register test patterns
      const patterns: ImmunityPattern[] = [
        {
          id: 'sql-injection',
          type: 'security',
          name: 'SQL Injection',
          pattern: /SELECT.*FROM.*WHERE.*=.*['"].*['"];?/gi,
          confidence: 0.9,
          severity: 'high'
        },
        {
          id: 'xss-script',
          type: 'security',
          name: 'XSS Script Injection',
          pattern: /<script[^>]*>.*<\/script>/gi,
          confidence: 0.85,
          severity: 'high'
        },
        {
          id: 'command-injection',
          type: 'security',
          name: 'Command Injection',
          pattern: /exec\s*\(\s*["'].*["']\s*\)/gi,
          confidence: 0.8,
          severity: 'critical'
        }
      ];

      for (const pattern of patterns) {
        await antibodySystem.registerPattern(pattern);
      }
    });

    it('should detect SQL injection patterns', async () => {
      const maliciousCode = `
        const userId = req.body.id;
        const query = "SELECT * FROM users WHERE id = '" + userId + "'";
        db.query(query);
      `;

      const matches = await antibodySystem.scanForPatterns(maliciousCode);

      expect(matches).toHaveLength(1);
      expect(matches[0].patternId).toBe('sql-injection');
      expect(matches[0].confidence).toBe(0.9);
      expect(matches[0].severity).toBe('high');
      expect(matches[0].matchedText).toBeDefined();
    });

    it('should detect XSS script patterns', async () => {
      const xssCode = `
        const userInput = req.body.comment;
        const output = "<script>alert('" + userInput + "')</script>";
        res.send(output);
      `;

      const matches = await antibodySystem.scanForPatterns(xssCode);

      expect(matches).toHaveLength(1);
      expect(matches[0].patternId).toBe('xss-script');
      expect(matches[0].confidence).toBe(0.85);
    });

    it('should detect multiple patterns in complex code', async () => {
      const complexMaliciousCode = `
        const userInput = req.body.data;
        const command = "ls -la " + userInput;
        exec(command);

        const output = "<script>console.log('injected')</script>";
        const query = "SELECT * FROM logs WHERE user = '" + userInput + "'";
      `;

      const matches = await antibodySystem.scanForPatterns(complexMaliciousCode);

      expect(matches.length).toBeGreaterThanOrEqual(2);

      const patternIds = matches.map(m => m.patternId);
      expect(patternIds).toContain('command-injection');
      expect(patternIds).toContain('xss-script');
    });

    it('should return no matches for safe code', async () => {
      const safeCode = `
        const userId = parseInt(req.params.id);
        if (!userId || userId <= 0) {
          return res.status(400).json({ error: 'Invalid user ID' });
        }

        const query = "SELECT * FROM users WHERE id = ?";
        const result = await db.query(query, [userId]);
        res.json(result);
      `;

      const matches = await antibodySystem.scanForPatterns(safeCode);

      expect(matches).toHaveLength(0);
    });
  });

  describe('Learning and Adaptation', () => {
    it('should learn new patterns from detected threats', async () => {
      const threatCode = `
        const malicious = "rm -rf / --no-preserve-root";
        subprocess.call([malicious]);
      `;

      const initialPatternCount = antibodySystem.getPatternCount();

      // Simulate threat detection and learning
      await antibodySystem.learnFromThreat({
        code: threatCode,
        threatType: 'command-injection',
        severity: 'critical',
        confidence: 0.95,
        context: 'file-deletion-attempt'
      });

      const newPatternCount = antibodySystem.getPatternCount();
      expect(newPatternCount).toBeGreaterThan(initialPatternCount);

      // Test that the learned pattern can detect similar threats
      const similarThreat = `subprocess.call(["rm", "-rf", "/tmp"]);`;
      const matches = await antibodySystem.scanForPatterns(similarThreat);

      expect(matches.length).toBeGreaterThan(0);
    });

    it('should adapt pattern confidence based on feedback', async () => {
      const pattern: ImmunityPattern = {
        id: 'adaptive-pattern',
        type: 'security',
        name: 'Adaptive Test Pattern',
        pattern: /adaptive.*test/gi,
        confidence: 0.5,
        learningEnabled: true
      };

      await antibodySystem.registerPattern(pattern);

      // Provide positive feedback (correct detection)
      await antibodySystem.provideFeedback('adaptive-pattern', {
        correct: true,
        severity: 'medium',
        context: 'test-scenario'
      });

      const updatedPattern = antibodySystem.getPattern('adaptive-pattern');
      expect(updatedPattern?.confidence).toBeGreaterThan(0.5);
    });

    it('should reduce confidence for false positives', async () => {
      const pattern: ImmunityPattern = {
        id: 'false-positive-pattern',
        type: 'security',
        name: 'False Positive Test',
        pattern: /console\.log/gi,
        confidence: 0.8,
        learningEnabled: true
      };

      await antibodySystem.registerPattern(pattern);

      // Provide negative feedback (false positive)
      await antibodySystem.provideFeedback('false-positive-pattern', {
        correct: false,
        falsePositive: true,
        context: 'debug-logging'
      });

      const updatedPattern = antibodySystem.getPattern('false-positive-pattern');
      expect(updatedPattern?.confidence).toBeLessThan(0.8);
    });

    it('should evolve patterns through genetic algorithm', async () => {
      // Create a population of similar patterns
      const basePattern = /eval\s*\(\s*.*\s*\)/gi;

      await antibodySystem.enableGeneticEvolution({
        populationSize: 10,
        mutationRate: 0.1,
        crossoverRate: 0.7,
        generations: 5
      });

      const population = await antibodySystem.evolvePatterns(basePattern, {
        targetAccuracy: 0.9,
        trainingData: [
          { code: 'eval(userInput);', threat: true },
          { code: 'evaluate(userInput);', threat: false },
          { code: 'eval("1 + 1");', threat: false },
          { code: 'eval(req.body.script);', threat: true }
        ]
      });

      expect(population).toHaveLength(10);
      expect(population.every(p => p.accuracy >= 0.7)).toBe(true);

      // Best pattern should be automatically registered
      const bestPattern = population.reduce((best, current) =>
        current.accuracy > best.accuracy ? current : best
      );

      expect(antibodySystem.hasPattern(bestPattern.id)).toBe(true);
    });
  });

  describe('Pattern Efficiency and Optimization', () => {
    it('should optimize pattern matching performance', async () => {
      // Register many patterns to test optimization
      const patterns = Array.from({ length: 100 }, (_, i) => ({
        id: `pattern-${i}`,
        type: 'test' as const,
        name: `Test Pattern ${i}`,
        pattern: new RegExp(`test${i}`, 'gi'),
        confidence: 0.5 + (i % 50) / 100
      }));

      for (const pattern of patterns) {
        await antibodySystem.registerPattern(pattern);
      }

      const testCode = 'const test50 = "this should match pattern 50";';

      const startTime = performance.now();
      const matches = await antibodySystem.scanForPatterns(testCode);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(50); // Should be fast even with 100 patterns
      expect(matches).toHaveLength(1);
      expect(matches[0].patternId).toBe('pattern-50');
    });

    it('should implement pattern indexing for faster lookups', async () => {
      await antibodySystem.enablePatternIndexing({
        indexByType: true,
        indexBySeverity: true,
        indexByConfidence: true
      });

      const patterns = [
        { id: 'sec-1', type: 'security', severity: 'high', confidence: 0.9, pattern: /security1/ },
        { id: 'sec-2', type: 'security', severity: 'medium', confidence: 0.7, pattern: /security2/ },
        { id: 'truth-1', type: 'truth', severity: 'low', confidence: 0.5, pattern: /truth1/ }
      ];

      for (const pattern of patterns) {
        await antibodySystem.registerPattern(pattern as ImmunityPattern);
      }

      // Test indexed lookup by type
      const securityPatterns = await antibodySystem.getPatternsByIndex('type', 'security');
      expect(securityPatterns).toHaveLength(2);

      // Test indexed lookup by severity
      const highSeverityPatterns = await antibodySystem.getPatternsByIndex('severity', 'high');
      expect(highSeverityPatterns).toHaveLength(1);
    });

    it('should prune ineffective patterns automatically', async () => {
      const ineffectivePattern: ImmunityPattern = {
        id: 'ineffective-pattern',
        type: 'security',
        name: 'Ineffective Pattern',
        pattern: /rarely.*matches/gi,
        confidence: 0.3,
        learningEnabled: true,
        statistics: {
          totalMatches: 100,
          falsePositives: 95,
          truePositives: 5,
          lastUsed: Date.now() - 30 * 24 * 60 * 60 * 1000 // 30 days ago
        }
      };

      await antibodySystem.registerPattern(ineffectivePattern);

      // Enable automatic pruning
      await antibodySystem.enableAutoPruning({
        minAccuracy: 0.7,
        minUsageFrequency: 0.1,
        inactivityThreshold: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      await antibodySystem.performMaintenance();

      // Ineffective pattern should be removed
      expect(antibodySystem.hasPattern('ineffective-pattern')).toBe(false);
    });
  });

  describe('Fleet Integration and Sharing', () => {
    it('should export patterns for fleet sharing', async () => {
      const patterns: ImmunityPattern[] = [
        {
          id: 'shareable-1',
          type: 'security',
          name: 'Shareable Pattern 1',
          pattern: /share.*pattern.*1/gi,
          confidence: 0.8,
          metadata: { exportable: true }
        },
        {
          id: 'private-1',
          type: 'security',
          name: 'Private Pattern 1',
          pattern: /private.*pattern.*1/gi,
          confidence: 0.7,
          metadata: { exportable: false }
        }
      ];

      for (const pattern of patterns) {
        await antibodySystem.registerPattern(pattern);
      }

      const exportablePatterns = await antibodySystem.exportPatternsForFleet({
        minConfidence: 0.75,
        onlyExportable: true
      });

      expect(exportablePatterns).toHaveLength(1);
      expect(exportablePatterns[0].id).toBe('shareable-1');
      expect(exportablePatterns[0].metadata.source).toBeDefined();
      expect(exportablePatterns[0].metadata.exportTimestamp).toBeDefined();
    });

    it('should import patterns from fleet', async () => {
      const fleetPatterns = [
        {
          id: 'fleet-pattern-1',
          type: 'security' as const,
          name: 'Fleet Shared Pattern 1',
          pattern: /fleet.*shared/gi,
          confidence: 0.85,
          metadata: {
            source: 'fleet-agent-456',
            shared: true,
            exportTimestamp: Date.now() - 1000
          }
        }
      ];

      const importResults = await antibodySystem.importPatternsFromFleet(fleetPatterns, {
        verifySource: true,
        minConfidence: 0.8,
        mergeStrategy: 'highest-confidence'
      });

      expect(importResults.imported).toBe(1);
      expect(importResults.rejected).toBe(0);
      expect(antibodySystem.hasPattern('fleet-pattern-1')).toBe(true);

      const imported = antibodySystem.getPattern('fleet-pattern-1');
      expect(imported?.metadata.fleetImported).toBe(true);
    });

    it('should handle pattern conflicts during fleet import', async () => {
      // Register a local pattern
      const localPattern: ImmunityPattern = {
        id: 'conflicting-pattern',
        type: 'security',
        name: 'Local Pattern',
        pattern: /local.*version/gi,
        confidence: 0.7
      };

      await antibodySystem.registerPattern(localPattern);

      // Try to import conflicting pattern from fleet
      const fleetPattern = {
        id: 'conflicting-pattern',
        type: 'security' as const,
        name: 'Fleet Pattern',
        pattern: /fleet.*version/gi,
        confidence: 0.9,
        metadata: { source: 'fleet-agent-789' }
      };

      const importResults = await antibodySystem.importPatternsFromFleet([fleetPattern], {
        mergeStrategy: 'highest-confidence'
      });

      expect(importResults.merged).toBe(1);

      const finalPattern = antibodySystem.getPattern('conflicting-pattern');
      expect(finalPattern?.confidence).toBe(0.9); // Should use higher confidence
      expect(finalPattern?.name).toBe('Fleet Pattern');
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle large pattern sets efficiently', async () => {
      const largePatternSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `large-pattern-${i}`,
        type: 'test' as const,
        name: `Large Pattern ${i}`,
        pattern: new RegExp(`pattern${i}.*test`, 'gi'),
        confidence: 0.5 + Math.random() * 0.5
      }));

      const startTime = performance.now();

      for (const pattern of largePatternSet) {
        await antibodySystem.registerPattern(pattern);
      }

      const registrationTime = performance.now() - startTime;
      expect(registrationTime).toBeLessThan(5000); // Should register 1000 patterns in < 5s

      // Test scanning performance
      const testCode = 'pattern500 test code here';
      const scanStartTime = performance.now();

      const matches = await antibodySystem.scanForPatterns(testCode);

      const scanTime = performance.now() - scanStartTime;
      expect(scanTime).toBeLessThan(100); // Should scan in < 100ms
      expect(matches).toHaveLength(1);
    });

    it('should manage memory usage with pattern caching', async () => {
      await antibodySystem.enablePatternCaching({
        maxCacheSize: 100,
        ttl: 60000, // 1 minute
        lruEviction: true
      });

      const initialMemory = process.memoryUsage().heapUsed;

      // Create many temporary patterns that should be cached and evicted
      for (let i = 0; i < 200; i++) {
        const pattern: ImmunityPattern = {
          id: `temp-pattern-${i}`,
          type: 'test',
          name: `Temp Pattern ${i}`,
          pattern: new RegExp(`temp${i}`, 'gi'),
          confidence: 0.5,
          metadata: { temporary: true }
        };

        await antibodySystem.registerPattern(pattern);

        // Access pattern to put in cache
        await antibodySystem.scanForPatterns(`temp${i} test`);
      }

      // Force garbage collection if available
      if (global.gc) global.gc();

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable despite many patterns
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // < 50MB

      // Cache should respect size limits
      const cacheStats = antibodySystem.getCacheStats();
      expect(cacheStats.size).toBeLessThanOrEqual(100);
    });

    it('should implement pattern compilation for performance', async () => {
      const patterns: ImmunityPattern[] = [
        {
          id: 'compiled-1',
          type: 'security',
          name: 'Compiled Pattern 1',
          pattern: /(?:SELECT|INSERT|UPDATE|DELETE)\s+.*\s+(?:FROM|INTO|SET)\s+/gi,
          confidence: 0.8,
          compileForPerformance: true
        }
      ];

      await antibodySystem.registerPattern(patterns[0]);

      // Enable pattern compilation
      await antibodySystem.compilePatterns({
        optimizationLevel: 'high',
        useNativeRegex: true
      });

      const testCode = 'SELECT * FROM users WHERE id = 1';

      // Measure compiled pattern performance
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await antibodySystem.scanForPatterns(testCode);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      expect(avgTime).toBeLessThan(1); // Should be < 1ms per scan with compilation
    });
  });
});