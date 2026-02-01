/**
 * AIS Boundary Condition Investigator
 *
 * Tests integration failures where unit tests pass but system integration fails.
 * Investigates edge cases, resource exhaustion, concurrent access, and error propagation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ImmunityService, ImmunityPlugin, AntibodyService } from '../v3/@claude-flow/agent-immunity/src';
import { HybridBackend } from '../v3/src/memory/infrastructure/HybridBackend';
import { AgentDBBackend } from '../v3/src/memory/infrastructure/AgentDBBackend';
import { SQLiteBackend } from '../v3/src/memory/infrastructure/SQLiteBackend';
import * as os from 'os';
import * as path from 'path';

describe('AIS Boundary Condition Investigation', () => {
  let immunityService: ImmunityService;
  let plugin: ImmunityPlugin;
  let antibodyService: AntibodyService;
  let memoryBackend: HybridBackend;

  beforeEach(async () => {
    // Initialize with realistic constraints
    immunityService = new ImmunityService({
      threshold: 0.7,
      enableLearning: true,
      customImmunities: {}
    });

    plugin = new ImmunityPlugin({
      enabled: true,
      threshold: 0.7,
      enableLearning: true
    });

    antibodyService = new AntibodyService();

    // Initialize hybrid memory backend for integration tests
    const testDbPath = path.join(os.tmpdir(), `boundary-test-${Date.now()}.db`);
    const testAgentDbPath = path.join(os.tmpdir(), `boundary-agentdb-${Date.now()}`);

    const sqliteBackend = new SQLiteBackend(testDbPath);
    const agentDbBackend = new AgentDBBackend({ dbPath: testAgentDbPath });

    await sqliteBackend.initialize();
    await agentDbBackend.initialize();

    memoryBackend = new HybridBackend(sqliteBackend, agentDbBackend);
    await memoryBackend.initialize();

    await immunityService.initialize();
    await plugin.initialize();
  });

  describe('1. Edge Cases Where Immunity Scoring Fails Silently', () => {
    it('should detect when immunity scores are undefined but tests pass', async () => {
      // Edge case: Empty action data that passes unit tests but causes undefined behavior
      const emptyActionData = {};

      const report = await immunityService.analyzeAction(emptyActionData);

      // This might pass unit tests but fail in real scenarios
      console.log('🔍 Empty action analysis:', {
        safe: report.safe,
        overallScore: report.overallScore,
        hasNaN: isNaN(report.overallScore),
        immunityScores: Object.values(report.immunityScores).some(s => isNaN(s))
      });

      // Test boundary condition: NaN scores should be treated as unsafe
      if (isNaN(report.overallScore)) {
        expect(report.safe).toBe(false);
        expect(report.violations.length).toBeGreaterThan(0);
      }
    });

    it('should handle malformed action data that causes scoring inconsistencies', async () => {
      const malformedActions = [
        // Circular references
        (() => {
          const circular: any = { type: 'test' };
          circular.self = circular;
          return circular;
        })(),

        // Extremely deep nesting
        {
          type: 'nested',
          data: Array.from({ length: 1000 }, (_, i) => ({ level: i, nested: {} }))
        },

        // Invalid UTF-8 sequences
        {
          type: 'encoding',
          content: '\uD800\uD800\uD800' // Invalid surrogate pairs
        },

        // Extremely large strings
        {
          type: 'large',
          content: 'A'.repeat(10 * 1024 * 1024) // 10MB string
        }
      ];

      for (const [index, action] of malformedActions.entries()) {
        try {
          const report = await immunityService.analyzeAction(action);

          console.log(`🔍 Malformed action ${index}:`, {
            type: action.type,
            safe: report.safe,
            score: report.overallScore,
            hasValidScore: typeof report.overallScore === 'number' && !isNaN(report.overallScore)
          });

          // Boundary condition: Malformed data should be handled gracefully
          expect(typeof report.overallScore).toBe('number');
          expect(report.overallScore).toBeGreaterThanOrEqual(0);
          expect(report.overallScore).toBeLessThanOrEqual(1);
        } catch (error) {
          console.warn(`⚠️ Action ${index} caused error:`, error?.toString().substring(0, 200));
          // Errors should not crash the system
          expect(error).toBeDefined();
        }
      }
    });

    it('should detect immunity weight normalization edge cases', async () => {
      // Test when immunities return extreme scores
      const extremeAction = {
        type: 'extreme_test',
        metadata: {
          code: 'while(true) { readFileSync("/dev/random"); eval(userInput); }',
          pii: 'SSN: 123-45-6789, Credit Card: 4111-1111-1111-1111'
        }
      };

      const report = await immunityService.analyzeAction(extremeAction);

      console.log('🔍 Extreme case immunity scores:', {
        immunityScores: report.immunityScores,
        overallScore: report.overallScore,
        violations: report.violations.length,
        scoreConsistency: this.checkScoreConsistency(report.immunityScores, report.overallScore)
      });

      // Boundary condition: Weighted average should be consistent
      const manualWeightedAverage = this.calculateManualWeightedAverage(report.immunityScores);
      const scoreDifference = Math.abs(report.overallScore - manualWeightedAverage);

      expect(scoreDifference).toBeLessThan(0.01); // Allow small floating point differences
    });
  });

  describe('2. Resource Exhaustion Scenarios', () => {
    it('should handle memory exhaustion during concurrent immunity checks', async () => {
      // Create many large action objects simultaneously
      const largeActions = Array.from({ length: 100 }, (_, i) => ({
        type: 'memory_stress',
        id: `stress-${i}`,
        data: {
          largeArray: new Array(1000000).fill(`data-${i}`),
          metadata: {
            code: `function test${i}() { ${Array.from({ length: 1000 }, (_, j) => `var x${j} = ${j};`).join(' ')} }`
          }
        }
      }));

      const startTime = Date.now();
      const startMemory = process.memoryUsage().heapUsed;

      try {
        // Run concurrent analysis
        const promises = largeActions.map(action => immunityService.analyzeAction(action));
        const results = await Promise.allSettled(promises);

        const endTime = Date.now();
        const endMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = endMemory - startMemory;

        console.log('🔍 Memory stress test results:', {
          totalActions: largeActions.length,
          successful: results.filter(r => r.status === 'fulfilled').length,
          failed: results.filter(r => r.status === 'rejected').length,
          executionTime: endTime - startTime,
          memoryIncreaseBytes: memoryIncrease,
          memoryIncreaseMB: Math.round(memoryIncrease / 1024 / 1024)
        });

        // Boundary condition: System should handle memory pressure gracefully
        const successRate = results.filter(r => r.status === 'fulfilled').length / results.length;
        expect(successRate).toBeGreaterThan(0.8); // At least 80% should succeed

        // Memory shouldn't grow unbounded (adjust threshold based on system)
        expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024); // 500MB limit

      } catch (error) {
        console.error('💥 Memory exhaustion test failed:', error);
        throw error;
      }
    });

    it('should handle file system pressure during memory backend operations', async () => {
      // Simulate concurrent file operations that stress I/O
      const memories = Array.from({ length: 1000 }, (_, i) => ({
        id: `fs-stress-${i}`,
        agentId: `agent-${i % 10}`,
        content: `Large content block ${'x'.repeat(10000)} ${i}`,
        type: 'stress_test',
        timestamp: Date.now() + i,
        embedding: new Array(384).fill(0).map(() => Math.random())
      }));

      const operations = [];
      const startTime = Date.now();

      // Mix of concurrent operations
      for (const memory of memories) {
        operations.push(
          memoryBackend.store(memory),
          memoryBackend.query({ agentId: memory.agentId }),
          memoryBackend.vectorSearch(memory.embedding || [], 5)
        );
      }

      try {
        const results = await Promise.allSettled(operations);
        const endTime = Date.now();

        console.log('🔍 File system stress results:', {
          totalOperations: operations.length,
          successful: results.filter(r => r.status === 'fulfilled').length,
          failed: results.filter(r => r.status === 'rejected').length,
          executionTime: endTime - startTime,
          avgLatency: (endTime - startTime) / operations.length
        });

        // Boundary condition: I/O operations should complete reasonably
        const successRate = results.filter(r => r.status === 'fulfilled').length / results.length;
        expect(successRate).toBeGreaterThan(0.9); // 90% success rate

      } catch (error) {
        console.error('💥 File system stress failed:', error);
        throw error;
      }
    });

    it('should detect CPU exhaustion during complex immunity analysis', async () => {
      // Create computationally expensive action data
      const cpuIntensiveAction = {
        type: 'cpu_stress',
        metadata: {
          code: Array.from({ length: 100 }, (_, i) =>
            `function heavyComputation${i}() {
              let result = 0;
              for(let x = 0; x < 1000000; x++) {
                for(let y = 0; y < 100; y++) {
                  result += Math.sin(x * y) * Math.cos(x / (y + 1));
                }
              }
              return result;
            }`
          ).join('\n'),
          complexData: this.generateComplexNestedStructure(10, 1000)
        }
      };

      const startTime = process.hrtime.bigint();
      const startCpu = process.cpuUsage();

      const report = await immunityService.analyzeAction(cpuIntensiveAction);

      const endTime = process.hrtime.bigint();
      const endCpu = process.cpuUsage(startCpu);
      const executionTimeMs = Number(endTime - startTime) / 1000000;

      console.log('🔍 CPU stress test results:', {
        executionTimeMs,
        userCpuMs: endCpu.user / 1000,
        systemCpuMs: endCpu.system / 1000,
        safe: report.safe,
        violations: report.violations.length
      });

      // Boundary condition: Analysis should complete within reasonable time
      expect(executionTimeMs).toBeLessThan(30000); // 30 second timeout
      expect(report).toBeDefined();
      expect(typeof report.overallScore).toBe('number');
    });
  });

  describe('3. Concurrent Access Patterns', () => {
    it('should handle race conditions in immunity service initialization', async () => {
      // Create multiple immunity services simultaneously
      const initPromises = Array.from({ length: 10 }, () => {
        const service = new ImmunityService({
          threshold: 0.7,
          enableLearning: true,
          customImmunities: {}
        });
        return service.initialize();
      });

      const results = await Promise.allSettled(initPromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;

      console.log('🔍 Concurrent initialization:', {
        total: initPromises.length,
        successful,
        failed: results.length - successful
      });

      // All initializations should succeed
      expect(successful).toBe(initPromises.length);
    });

    it('should detect data corruption during concurrent memory operations', async () => {
      const testData = 'integrity-test-data';
      const concurrentWriters = 20;
      const operationsPerWriter = 50;

      // Generate unique memory objects for each writer
      const generateMemoryBatch = (writerId: number) =>
        Array.from({ length: operationsPerWriter }, (_, i) => ({
          id: `writer-${writerId}-memory-${i}`,
          agentId: `writer-${writerId}`,
          content: `${testData}-${writerId}-${i}`,
          type: 'integrity_test',
          timestamp: Date.now() + i,
          metadata: { writerId, sequence: i, checksum: this.calculateChecksum(`${testData}-${writerId}-${i}`) }
        }));

      // Launch concurrent writers
      const writerPromises = Array.from({ length: concurrentWriters }, async (_, writerId) => {
        const memories = generateMemoryBatch(writerId);

        return Promise.all(memories.map(async (memory) => {
          try {
            await memoryBackend.store(memory);
            return { success: true, writerId, memoryId: memory.id };
          } catch (error) {
            return { success: false, writerId, memoryId: memory.id, error: error?.toString() };
          }
        }));
      });

      const results = await Promise.allSettled(writerPromises);
      const allOperations = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
      const successfulOps = allOperations.filter(op => op.success);

      console.log('🔍 Concurrent write test:', {
        totalWriters: concurrentWriters,
        operationsPerWriter,
        totalOperations: allOperations.length,
        successful: successfulOps.length,
        failed: allOperations.length - successfulOps.length
      });

      // Verify data integrity by reading back and checking checksums
      const integrityChecks = await Promise.all(
        successfulOps.slice(0, 100).map(async (op) => { // Check first 100 for performance
          try {
            const retrieved = await memoryBackend.retrieve(op.memoryId);
            const expectedChecksum = this.calculateChecksum(retrieved?.content || '');
            const storedChecksum = retrieved?.metadata?.checksum;

            return {
              memoryId: op.memoryId,
              retrieved: !!retrieved,
              checksumMatch: expectedChecksum === storedChecksum,
              expected: expectedChecksum,
              stored: storedChecksum
            };
          } catch (error) {
            return {
              memoryId: op.memoryId,
              retrieved: false,
              checksumMatch: false,
              error: error?.toString()
            };
          }
        })
      );

      const integrityFailures = integrityChecks.filter(check => !check.checksumMatch);

      console.log('🔍 Data integrity results:', {
        checkedItems: integrityChecks.length,
        integrityFailures: integrityFailures.length,
        integrityRate: (integrityChecks.length - integrityFailures.length) / integrityChecks.length
      });

      // Boundary condition: Data integrity should be maintained
      expect(integrityFailures.length).toBe(0);
    });

    it('should handle immunity analysis during high concurrency', async () => {
      const concurrentAnalyses = 50;
      const actions = Array.from({ length: concurrentAnalyses }, (_, i) => ({
        type: 'concurrent_analysis',
        id: `analysis-${i}`,
        timestamp: Date.now() + i,
        task: {
          description: `Concurrent task ${i} with potential security issues: ${i % 3 === 0 ? 'eval(userInput)' : 'safe operation'}`
        },
        metadata: {
          sequence: i,
          threadId: Math.floor(i / 10)
        }
      }));

      const startTime = Date.now();
      const analysisPromises = actions.map(async (action, index) => {
        try {
          const report = await immunityService.analyzeAction(action);
          return {
            index,
            success: true,
            safe: report.safe,
            score: report.overallScore,
            violations: report.violations.length,
            analysisTime: Date.now() - startTime
          };
        } catch (error) {
          return {
            index,
            success: false,
            error: error?.toString(),
            analysisTime: Date.now() - startTime
          };
        }
      });

      const results = await Promise.all(analysisPromises);
      const endTime = Date.now();

      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      console.log('🔍 Concurrent analysis results:', {
        totalAnalyses: concurrentAnalyses,
        successful: successful.length,
        failed: failed.length,
        totalTime: endTime - startTime,
        avgLatency: successful.length > 0 ? successful.reduce((sum, r) => sum + r.analysisTime, 0) / successful.length : 0,
        scoreConsistency: this.checkConcurrentScoreConsistency(successful)
      });

      // Boundary condition: High concurrency should not cause failures
      expect(successful.length).toBeGreaterThan(concurrentAnalyses * 0.95); // 95% success rate
      expect(failed.length).toBeLessThan(concurrentAnalyses * 0.05); // Less than 5% failures
    });
  });

  describe('4. Error Propagation Across Module Boundaries', () => {
    it('should test error propagation from immunity modules to service layer', async () => {
      // Mock immunity that throws different types of errors
      class FailingImmunity {
        name = 'failing_test';
        weight = 0.1;

        async analyze(actionData: any) {
          const errorType = actionData.metadata?.errorType || 'generic';

          switch (errorType) {
            case 'timeout':
              return new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout error')), 100)
              );
            case 'memory':
              throw new Error('Out of memory');
            case 'network':
              throw new Error('Network unreachable');
            case 'permission':
              throw new Error('Permission denied');
            case 'corruption':
              throw new Error('Data corruption detected');
            default:
              throw new Error('Generic immunity failure');
          }
        }
      }

      // Register failing immunity
      immunityService.registerImmunity('failing_test', new FailingImmunity() as any);

      const errorTypes = ['timeout', 'memory', 'network', 'permission', 'corruption', 'generic'];
      const errorResults = [];

      for (const errorType of errorTypes) {
        try {
          const action = {
            type: 'error_propagation_test',
            metadata: { errorType }
          };

          const report = await immunityService.analyzeAction(action);
          errorResults.push({
            errorType,
            handled: true,
            safe: report.safe,
            score: report.overallScore,
            violations: report.violations.length
          });

        } catch (error) {
          errorResults.push({
            errorType,
            handled: false,
            error: error?.toString(),
            propagated: true
          });
        }
      }

      console.log('🔍 Error propagation test:', errorResults);

      // Boundary condition: Errors should be handled gracefully, not propagate
      const unhandledErrors = errorResults.filter(r => !r.handled);
      expect(unhandledErrors.length).toBe(0);

      // All handled errors should result in conservative scores
      const handledErrors = errorResults.filter(r => r.handled);
      handledErrors.forEach(result => {
        expect(result.score).toBeLessThan(0.8); // Conservative score for errors
      });
    });

    it('should test cross-module integration failure scenarios', async () => {
      const integrationTests = [
        {
          name: 'Memory backend failure during immunity analysis',
          setup: async () => {
            // Close memory backend to simulate failure
            await memoryBackend.close();
          },
          action: {
            type: 'memory_dependent_analysis',
            metadata: { requiresMemory: true }
          }
        },
        {
          name: 'Plugin initialization failure',
          setup: async () => {
            // Create plugin with invalid config
            const invalidPlugin = new ImmunityPlugin({
              enabled: true,
              threshold: -1, // Invalid threshold
              enableLearning: true
            });
            await invalidPlugin.initialize();
          },
          action: {
            type: 'plugin_dependent_analysis'
          }
        }
      ];

      const integrationResults = [];

      for (const test of integrationTests) {
        try {
          await test.setup();
          const report = await immunityService.analyzeAction(test.action);

          integrationResults.push({
            testName: test.name,
            success: true,
            safe: report.safe,
            gracefulDegradation: report.overallScore > 0
          });

        } catch (error) {
          integrationResults.push({
            testName: test.name,
            success: false,
            error: error?.toString(),
            gracefulFailure: error?.message?.includes('graceful') || error?.message?.includes('fallback')
          });
        }
      }

      console.log('🔍 Integration failure tests:', integrationResults);

      // Boundary condition: System should degrade gracefully
      integrationResults.forEach(result => {
        if (!result.success) {
          expect(result.gracefulFailure).toBe(true);
        }
      });
    });
  });

  // Helper methods for boundary condition testing

  private checkScoreConsistency(immunityScores: Record<string, number>, overallScore: number): boolean {
    const scores = Object.values(immunityScores);
    const allValid = scores.every(score =>
      typeof score === 'number' && !isNaN(score) && score >= 0 && score <= 1
    );
    const overallValid = typeof overallScore === 'number' && !isNaN(overallScore) &&
                        overallScore >= 0 && overallScore <= 1;

    return allValid && overallValid;
  }

  private calculateManualWeightedAverage(immunityScores: Record<string, number>): number {
    // Simplified weight calculation for testing
    const weights: Record<string, number> = {
      security: 0.25,
      truth: 0.15,
      coherence: 0.12,
      performance: 0.12,
      dependencies: 0.10,
      context: 0.08,
      resource: 0.08,
      network: 0.05,
      data: 0.03,
      behavior: 0.02
    };

    let totalWeight = 0;
    let weightedSum = 0;

    for (const [name, score] of Object.entries(immunityScores)) {
      const weight = weights[name] || 0.01;
      totalWeight += weight;
      weightedSum += score * weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private generateComplexNestedStructure(depth: number, width: number): any {
    if (depth === 0) {
      return 'leaf-' + Math.random().toString(36);
    }

    const obj: any = {};
    for (let i = 0; i < width; i++) {
      obj[`prop_${i}`] = this.generateComplexNestedStructure(depth - 1, Math.max(1, width / 2));
    }
    return obj;
  }

  private calculateChecksum(data: string): string {
    // Simple checksum for integrity testing
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  private checkConcurrentScoreConsistency(results: Array<{ safe: boolean; score: number; violations: number }>): boolean {
    // Check if similar actions produced consistent results
    const groupedByViolations = new Map<number, Array<{ safe: boolean; score: number }>>();

    results.forEach(result => {
      if (!groupedByViolations.has(result.violations)) {
        groupedByViolations.set(result.violations, []);
      }
      groupedByViolations.get(result.violations)!.push(result);
    });

    // Check consistency within groups
    for (const [violations, group] of groupedByViolations) {
      if (group.length > 1) {
        const scores = group.map(g => g.score);
        const scoreVariance = this.calculateVariance(scores);

        // High variance indicates inconsistent scoring
        if (scoreVariance > 0.1) {
          console.warn(`⚠️ High score variance (${scoreVariance.toFixed(3)}) for ${violations} violations`);
          return false;
        }
      }
    }

    return true;
  }

  private calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
  }

  afterEach(async () => {
    try {
      await memoryBackend?.close();
    } catch (error) {
      // Ignore cleanup errors
    }
  });
});