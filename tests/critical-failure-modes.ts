/**
 * Critical Failure Modes - AIS Integration Boundary Testing
 *
 * Focuses on the most dangerous boundary conditions where AIS components
 * appear to work individually but fail catastrophically when integrated.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ImmunityService } from '../v3/@claude-flow/agent-immunity/src';

describe('Critical AIS Failure Modes', () => {
  let immunityService: ImmunityService;

  beforeEach(async () => {
    immunityService = new ImmunityService({
      threshold: 0.7,
      enableLearning: true,
      customImmunities: {}
    });
    await immunityService.initialize();
  });

  describe('Silent Immunity Scoring Failures', () => {
    it('should detect when weighted averaging produces incorrect results due to floating point precision', async () => {
      // Create action that triggers all immunities with edge case scores
      const precisionTestAction = {
        type: 'precision_test',
        task: {
          description: 'eval(userInput) + readFileSync("/etc/passwd") + while(true){}'
        },
        metadata: {
          code: 'function test() { return 0.1 + 0.2 === 0.3; }', // Classic floating point issue
          largeNumbers: [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Math.PI],
          edgeCaseValues: [0.30000000000000004, 1e-16, 1e16]
        }
      };

      const report = await immunityService.analyzeAction(precisionTestAction);

      console.log('🔍 Floating point precision test:', {
        overallScore: report.overallScore,
        immunityScores: report.immunityScores,
        precisionIssues: this.detectPrecisionIssues(report.immunityScores, report.overallScore)
      });

      // Critical boundary: Floating point errors should not cause incorrect safety assessments
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(1);
      expect(Number.isFinite(report.overallScore)).toBe(true);

      // Manual verification of weighted average
      const manualScore = this.calculateManualWeightedScore(report.immunityScores);
      const precisionDiff = Math.abs(report.overallScore - manualScore);

      console.log('🔍 Score verification:', {
        reported: report.overallScore,
        manual: manualScore,
        difference: precisionDiff,
        withinTolerance: precisionDiff < 0.001
      });

      expect(precisionDiff).toBeLessThan(0.001); // 0.1% tolerance for floating point
    });

    it('should detect immunity scoring race conditions that cause inconsistent results', async () => {
      const raceConditionAction = {
        type: 'race_condition_test',
        task: {
          description: 'setTimeout(() => eval(dangerousCode), 0)'
        },
        metadata: {
          asyncPatterns: [
            'Promise.all([...])',
            'await Promise.race([...])',
            'setInterval(...)',
            'process.nextTick(...)'
          ]
        }
      };

      // Run the same analysis multiple times concurrently to detect race conditions
      const concurrentRuns = 10;
      const analysisPromises = Array.from({ length: concurrentRuns }, () =>
        immunityService.analyzeAction(raceConditionAction)
      );

      const results = await Promise.all(analysisPromises);

      // Analyze result consistency
      const scores = results.map(r => r.overallScore);
      const scoreVariance = this.calculateVariance(scores);
      const scoreRange = Math.max(...scores) - Math.min(...scores);

      console.log('🔍 Race condition analysis:', {
        runs: concurrentRuns,
        scores: scores.map(s => Number(s.toFixed(4))),
        variance: scoreVariance,
        range: scoreRange,
        consistent: scoreVariance < 0.0001
      });

      // Critical boundary: Concurrent analysis should produce consistent results
      expect(scoreVariance).toBeLessThan(0.0001); // Very low variance tolerance
      expect(scoreRange).toBeLessThan(0.001); // Very low range tolerance
    });

    it('should detect when immunity weights sum to incorrect values causing score drift', async () => {
      // Test that explores weight normalization edge cases
      const weightTestAction = {
        type: 'weight_validation',
        task: { description: 'Standard test action' },
        metadata: { testWeights: true }
      };

      const report = await immunityService.analyzeAction(weightTestAction);

      // Extract and validate weight distribution
      const stats = await immunityService.getStatistics();
      const activeImmunities = stats.activeImmunities;

      console.log('🔍 Active immunities:', activeImmunities);

      // Critical boundary: Weights should be properly normalized
      // Note: We can't directly access weights, so we test through behavior
      const multipleReports = await Promise.all(
        Array.from({ length: 5 }, () => immunityService.analyzeAction(weightTestAction))
      );

      const scoreStability = multipleReports.every(r =>
        Math.abs(r.overallScore - report.overallScore) < 0.0001
      );

      console.log('🔍 Weight normalization test:', {
        baselineScore: report.overallScore,
        scoreStability,
        allScores: multipleReports.map(r => r.overallScore)
      });

      expect(scoreStability).toBe(true);
    });
  });

  describe('Resource Exhaustion Leading to Silent Failures', () => {
    it('should detect memory leaks in immunity analysis under sustained load', async () => {
      const initialMemory = process.memoryUsage();
      const sustainedLoadActions = Array.from({ length: 1000 }, (_, i) => ({
        type: 'memory_leak_test',
        id: `sustained-${i}`,
        task: {
          description: `Complex analysis ${i} with nested eval(${JSON.stringify(Array.from({ length: 100 }, (_, j) => `var${j}`))})`
        },
        metadata: {
          largeObject: this.createLargeObject(1000), // 1KB object
          timestamp: Date.now(),
          sequence: i
        }
      }));

      const memoryCheckpoints = [];
      const batchSize = 100;

      for (let i = 0; i < sustainedLoadActions.length; i += batchSize) {
        const batch = sustainedLoadActions.slice(i, i + batchSize);

        // Process batch
        await Promise.all(batch.map(action => immunityService.analyzeAction(action)));

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        // Record memory usage
        const currentMemory = process.memoryUsage();
        memoryCheckpoints.push({
          batch: Math.floor(i / batchSize),
          heapUsed: currentMemory.heapUsed,
          heapTotal: currentMemory.heapTotal,
          external: currentMemory.external
        });

        // Brief pause to allow cleanup
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const finalMemory = process.memoryUsage();
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryGrowthMB = memoryGrowth / 1024 / 1024;

      console.log('🔍 Memory leak detection:', {
        initialMemoryMB: Math.round(initialMemory.heapUsed / 1024 / 1024),
        finalMemoryMB: Math.round(finalMemory.heapUsed / 1024 / 1024),
        memoryGrowthMB: Math.round(memoryGrowthMB),
        actionsProcessed: sustainedLoadActions.length,
        memoryPerAction: Math.round(memoryGrowth / sustainedLoadActions.length),
        checkpoints: memoryCheckpoints.length
      });

      // Critical boundary: Memory growth should be bounded
      expect(memoryGrowthMB).toBeLessThan(100); // Less than 100MB growth

      // Check for linear memory growth (potential leak indicator)
      const growthTrend = this.analyzeMemoryTrend(memoryCheckpoints);
      expect(growthTrend.isLinearGrowth).toBe(false);
    });

    it('should detect CPU starvation causing immunity timeouts', async () => {
      const cpuIntensiveAction = {
        type: 'cpu_starvation_test',
        task: {
          description: 'Complex computational task'
        },
        metadata: {
          cpuIntensiveCode: this.generateCpuIntensiveCode(),
          complexRegexes: [
            '(a+)+$',
            '^(a|a)*$',
            '(a|a)*b',
            '((a*)*)*$'
          ],
          largeDataStructure: this.createComplexNestedStructure(8, 50)
        }
      };

      const concurrentCpuTasks = Array.from({ length: 20 }, () => cpuIntensiveAction);
      const startTime = Date.now();
      const startCpuUsage = process.cpuUsage();

      // Run CPU-intensive tasks concurrently
      const results = await Promise.allSettled(
        concurrentCpuTasks.map(action =>
          Promise.race([
            immunityService.analyzeAction(action),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Analysis timeout')), 10000)
            )
          ])
        )
      );

      const endTime = Date.now();
      const endCpuUsage = process.cpuUsage(startCpuUsage);

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const timedOut = results.filter(r => r.status === 'rejected').length;

      console.log('🔍 CPU starvation test:', {
        totalTasks: concurrentCpuTasks.length,
        successful,
        timedOut,
        executionTimeMs: endTime - startTime,
        cpuTimeMs: (endCpuUsage.user + endCpuUsage.system) / 1000,
        avgLatencyMs: (endTime - startTime) / successful
      });

      // Critical boundary: CPU starvation should not cause total failure
      expect(successful).toBeGreaterThan(concurrentCpuTasks.length * 0.7); // 70% success rate
      expect(timedOut).toBeLessThan(concurrentCpuTasks.length * 0.3); // Less than 30% timeout
    });

    it('should detect I/O blocking that prevents immunity analysis completion', async () => {
      // Simulate I/O heavy action data
      const ioHeavyAction = {
        type: 'io_blocking_test',
        task: {
          description: 'File system intensive operations'
        },
        metadata: {
          fileOperations: [
            'readFileSync("/etc/passwd")',
            'writeFileSync("/tmp/test", data)',
            'readdirSync("/proc")',
            'statSync("/var/log")'
          ],
          networkOperations: [
            'http.get("http://malicious.com")',
            'dns.lookup("suspicious.domain")',
            'net.connect(port, host)'
          ]
        }
      };

      const concurrentIoTasks = Array.from({ length: 50 }, () => ioHeavyAction);
      const ioResults = [];
      const batchSize = 10;

      for (let i = 0; i < concurrentIoTasks.length; i += batchSize) {
        const batch = concurrentIoTasks.slice(i, i + batchSize);
        const batchStartTime = Date.now();

        const batchResults = await Promise.allSettled(
          batch.map(action => immunityService.analyzeAction(action))
        );

        const batchEndTime = Date.now();
        const batchTime = batchEndTime - batchStartTime;

        ioResults.push({
          batchNumber: Math.floor(i / batchSize),
          batchTime,
          successful: batchResults.filter(r => r.status === 'fulfilled').length,
          failed: batchResults.filter(r => r.status === 'rejected').length
        });

        console.log(`I/O batch ${Math.floor(i / batchSize)}: ${batchTime}ms`);
      }

      const totalSuccessful = ioResults.reduce((sum, batch) => sum + batch.successful, 0);
      const totalFailed = ioResults.reduce((sum, batch) => sum + batch.failed, 0);
      const avgBatchTime = ioResults.reduce((sum, batch) => sum + batch.batchTime, 0) / ioResults.length;

      console.log('🔍 I/O blocking test:', {
        totalBatches: ioResults.length,
        totalSuccessful,
        totalFailed,
        avgBatchTimeMs: Math.round(avgBatchTime),
        successRate: totalSuccessful / (totalSuccessful + totalFailed),
        performanceDegradation: avgBatchTime > 1000 // More than 1 second per batch
      });

      // Critical boundary: I/O should not block immunity analysis
      expect(totalSuccessful).toBeGreaterThan(concurrentIoTasks.length * 0.8); // 80% success
      expect(avgBatchTime).toBeLessThan(5000); // Less than 5 seconds per batch
    });
  });

  describe('Error Propagation Cascade Failures', () => {
    it('should detect when immunity errors cascade through the system causing total failure', async () => {
      // Create a mock immunity that fails in different ways based on context
      class CascadingFailureImmunity {
        name = 'cascade_test';
        weight = 0.2;
        private failureCount = 0;

        async analyze(actionData: any) {
          this.failureCount++;

          // Different failure modes based on call count
          if (this.failureCount % 5 === 0) {
            throw new Error('Critical system failure');
          } else if (this.failureCount % 3 === 0) {
            return { score: NaN, violations: [] }; // Invalid score
          } else if (this.failureCount % 2 === 0) {
            return { score: -1, violations: [] }; // Out of range score
          }

          return { score: 0.5, violations: [] };
        }
      }

      immunityService.registerImmunity('cascade_test', new CascadingFailureImmunity() as any);

      const cascadeTestActions = Array.from({ length: 20 }, (_, i) => ({
        type: 'cascade_failure_test',
        id: `cascade-${i}`,
        task: { description: `Cascade test ${i}` }
      }));

      const cascadeResults = [];
      let systemStillFunctional = true;

      for (const [index, action] of cascadeTestActions.entries()) {
        try {
          const report = await immunityService.analyzeAction(action);

          cascadeResults.push({
            index,
            success: true,
            safe: report.safe,
            score: report.overallScore,
            hasValidScore: Number.isFinite(report.overallScore) &&
                          report.overallScore >= 0 &&
                          report.overallScore <= 1
          });

          // Check if system is still functional despite individual immunity failures
          if (!Number.isFinite(report.overallScore) ||
              report.overallScore < 0 ||
              report.overallScore > 1) {
            systemStillFunctional = false;
          }

        } catch (error) {
          cascadeResults.push({
            index,
            success: false,
            error: error?.toString(),
            systemCrash: true
          });
          systemStillFunctional = false;
        }
      }

      const successfulAnalyses = cascadeResults.filter(r => r.success);
      const failedAnalyses = cascadeResults.filter(r => !r.success);
      const invalidScores = successfulAnalyses.filter(r => !r.hasValidScore);

      console.log('🔍 Cascade failure test:', {
        totalTests: cascadeTestActions.length,
        successful: successfulAnalyses.length,
        failed: failedAnalyses.length,
        invalidScores: invalidScores.length,
        systemStillFunctional,
        cascadeContained: systemStillFunctional && successfulAnalyses.length > 0
      });

      // Critical boundary: Individual immunity failures should not cascade
      expect(systemStillFunctional).toBe(true);
      expect(successfulAnalyses.length).toBeGreaterThan(cascadeTestActions.length * 0.5);
      expect(invalidScores.length).toBe(0);
    });

    it('should detect error propagation from memory layer to immunity analysis', async () => {
      // Test how immunity system handles memory layer failures
      const memoryErrorActions = [
        {
          type: 'memory_error_corruption',
          task: { description: 'Test with corrupted memory references' },
          metadata: { memoryCorruption: true }
        },
        {
          type: 'memory_error_exhaustion',
          task: { description: 'Test with memory exhaustion' },
          metadata: { memoryExhaustion: true }
        },
        {
          type: 'memory_error_deadlock',
          task: { description: 'Test with memory deadlock' },
          metadata: { memoryDeadlock: true }
        }
      ];

      const memoryErrorResults = [];

      for (const action of memoryErrorActions) {
        try {
          // Simulate memory stress before analysis
          const stressMemory = this.createLargeObject(10000); // 10KB object

          const report = await immunityService.analyzeAction(action);

          memoryErrorResults.push({
            actionType: action.type,
            success: true,
            gracefulHandling: report.overallScore >= 0,
            reportValid: typeof report.overallScore === 'number'
          });

          // Cleanup
          // @ts-ignore
          stressMemory.cleanup = null;

        } catch (error) {
          memoryErrorResults.push({
            actionType: action.type,
            success: false,
            error: error?.toString(),
            errorType: error?.name || 'Unknown'
          });
        }
      }

      console.log('🔍 Memory error propagation:', memoryErrorResults);

      // Critical boundary: Memory errors should not break immunity analysis
      const successfulHandling = memoryErrorResults.filter(r => r.success);
      expect(successfulHandling.length).toBe(memoryErrorActions.length);
    });
  });

  describe('Timing and Synchronization Issues', () => {
    it('should detect race conditions between immunity checks and learning updates', async () => {
      const raceConditionAction = {
        type: 'race_condition_learning',
        task: {
          description: 'eval(userInput) - should trigger security learning'
        },
        metadata: {
          triggerLearning: true,
          maliciousPatterns: ['eval', 'Function', 'setTimeout']
        }
      };

      // Simulate concurrent analysis and learning
      const concurrentOperations = Array.from({ length: 50 }, async (_, i) => {
        try {
          const report = await immunityService.analyzeAction({
            ...raceConditionAction,
            id: `race-${i}`,
            metadata: {
              ...raceConditionAction.metadata,
              sequence: i
            }
          });

          return {
            index: i,
            success: true,
            safe: report.safe,
            score: report.overallScore,
            learningTriggered: !report.safe // Unsafe actions should trigger learning
          };
        } catch (error) {
          return {
            index: i,
            success: false,
            error: error?.toString()
          };
        }
      });

      const raceResults = await Promise.all(concurrentOperations);
      const successful = raceResults.filter(r => r.success);
      const failed = raceResults.filter(r => !r.success);

      // Analyze result patterns for race conditions
      const scoreVariations = successful.map(r => r.score);
      const scoreConsistency = this.checkScoreConsistency(scoreVariations);

      console.log('🔍 Race condition detection:', {
        totalOperations: concurrentOperations.length,
        successful: successful.length,
        failed: failed.length,
        scoreConsistency,
        scoreRange: scoreVariations.length > 0 ?
          Math.max(...scoreVariations) - Math.min(...scoreVariations) : 0,
        learningActivated: successful.filter(r => r.learningTriggered).length
      });

      // Critical boundary: Race conditions should not cause inconsistent results
      expect(failed.length).toBe(0);
      expect(scoreConsistency).toBe(true);
    });
  });

  // Helper methods
  private calculateVariance(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
  }

  private detectPrecisionIssues(immunityScores: Record<string, number>, overallScore: number): boolean {
    const allScores = [...Object.values(immunityScores), overallScore];
    return allScores.some(score => !Number.isFinite(score) || score < 0 || score > 1);
  }

  private calculateManualWeightedScore(immunityScores: Record<string, number>): number {
    const weights: Record<string, number> = {
      security: 0.25, truth: 0.15, coherence: 0.12, performance: 0.12,
      dependencies: 0.10, context: 0.08, resource: 0.08, network: 0.05,
      data: 0.03, behavior: 0.02, consensus: 0.02
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

  private createLargeObject(sizeKB: number): any {
    const obj: any = {};
    const targetSize = sizeKB * 1024;
    let currentSize = 0;
    let counter = 0;

    while (currentSize < targetSize) {
      const key = `prop_${counter}`;
      const value = 'x'.repeat(Math.min(100, targetSize - currentSize));
      obj[key] = value;
      currentSize += value.length + key.length;
      counter++;
    }

    return obj;
  }

  private analyzeMemoryTrend(checkpoints: Array<{ heapUsed: number }>): { isLinearGrowth: boolean; growthRate: number } {
    if (checkpoints.length < 3) return { isLinearGrowth: false, growthRate: 0 };

    const growthRates = [];
    for (let i = 1; i < checkpoints.length; i++) {
      const growth = checkpoints[i].heapUsed - checkpoints[i - 1].heapUsed;
      growthRates.push(growth);
    }

    const avgGrowthRate = growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;
    const growthVariance = this.calculateVariance(growthRates);

    // Linear growth if low variance and positive average growth
    const isLinearGrowth = growthVariance < 1000000 && avgGrowthRate > 10000; // 10KB threshold

    return { isLinearGrowth, growthRate: avgGrowthRate };
  }

  private generateCpuIntensiveCode(): string {
    return Array.from({ length: 50 }, (_, i) =>
      `function cpu${i}() {
        let result = 0;
        for(let x = 0; x < 10000; x++) {
          for(let y = 0; y < 100; y++) {
            result += Math.sin(x) * Math.cos(y) * Math.sqrt(x * y + 1);
          }
        }
        return result;
      }`
    ).join('\n');
  }

  private createComplexNestedStructure(depth: number, width: number): any {
    if (depth === 0) {
      return { value: Math.random(), timestamp: Date.now() };
    }

    const obj: any = {};
    for (let i = 0; i < width; i++) {
      obj[`branch_${i}`] = this.createComplexNestedStructure(depth - 1, Math.max(1, width / 2));
    }
    return obj;
  }

  private checkScoreConsistency(scores: number[]): boolean {
    if (scores.length < 2) return true;

    const variance = this.calculateVariance(scores);
    return variance < 0.01; // 1% variance tolerance
  }
});