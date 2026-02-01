/**
 * Performance Benchmarks for Agent Immunity System
 * Tests latency requirements, throughput, and performance under load
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { performance } from 'perf_hooks';
import { ImmunityService } from '../../src/immunity/core/ImmunityService';
import { TrajectoryBlockingSystem } from '../../src/immunity/integration/TrajectoryBlockingSystem';
import { SecurityImmunityAnalyzer } from '../../src/immunity/analyzers/SecurityImmunityAnalyzer';
import { TruthImmunityAnalyzer } from '../../src/immunity/analyzers/TruthImmunityAnalyzer';
import { CoherenceImmunityAnalyzer } from '../../src/immunity/analyzers/CoherenceImmunityAnalyzer';

describe('Immunity System Performance Benchmarks', () => {
  let immunityService: ImmunityService;
  let blockingSystem: TrajectoryBlockingSystem;
  let testContext: any;

  beforeEach(async () => {
    // Initialize with all analyzers for comprehensive testing
    immunityService = new ImmunityService({
      parallelExecution: true,
      analyzerTimeout: 50,
      globalConfidenceThreshold: 0.7
    });

    // Register all immunity analyzers
    immunityService.registerAnalyzer(new SecurityImmunityAnalyzer());
    immunityService.registerAnalyzer(new TruthImmunityAnalyzer());
    immunityService.registerAnalyzer(new CoherenceImmunityAnalyzer());

    // Mock trajectory manager and fleet comms for isolation
    const mockTrajectoryManager = {
      getAgentTrajectory: vi.fn().mockResolvedValue([]),
      addTrajectoryStep: vi.fn(),
      updateTrajectoryOutcome: vi.fn()
    };

    const mockFleetComms = {
      broadcast: vi.fn(),
      subscribe: vi.fn(),
      getActiveAgents: vi.fn().mockResolvedValue(['agent-1', 'agent-2'])
    };

    blockingSystem = new TrajectoryBlockingSystem({
      immunityService,
      trajectoryManager: mockTrajectoryManager as any,
      fleetComms: mockFleetComms as any,
      blockingThreshold: 0.7
    });

    await blockingSystem.initialize();

    testContext = {
      agentId: 'benchmark-agent',
      action: 'execute_code',
      payload: { code: 'console.log("test");' },
      trajectory: [],
      timestamp: Date.now()
    };
  });

  afterEach(async () => {
    await blockingSystem.shutdown();
    vi.clearAllMocks();
  });

  describe('Latency Requirements (<30ms)', () => {
    it('should analyze simple safe code within 30ms', async () => {
      const simpleCode = 'const x = 5; const y = 10; console.log(x + y);';
      testContext.payload.code = simpleCode;

      const measurements: number[] = [];

      // Run multiple measurements for statistical accuracy
      for (let i = 0; i < 100; i++) {
        const startTime = performance.now();
        await immunityService.analyzeAction(testContext);
        const endTime = performance.now();
        measurements.push(endTime - startTime);
      }

      const avgLatency = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const p95Latency = measurements.sort((a, b) => a - b)[Math.floor(measurements.length * 0.95)];
      const p99Latency = measurements.sort((a, b) => a - b)[Math.floor(measurements.length * 0.99)];

      expect(avgLatency).toBeLessThan(30);
      expect(p95Latency).toBeLessThan(40);
      expect(p99Latency).toBeLessThan(50);

      console.log(`Simple Code Analysis - Avg: ${avgLatency.toFixed(2)}ms, P95: ${p95Latency.toFixed(2)}ms, P99: ${p99Latency.toFixed(2)}ms`);
    });

    it('should analyze complex code within latency bounds', async () => {
      const complexCode = `
        class DatabaseManager {
          constructor(config) {
            this.connection = this.createConnection(config);
            this.queryBuilder = new QueryBuilder();
          }

          async fetchUser(userId) {
            const query = this.queryBuilder
              .select(['id', 'name', 'email'])
              .from('users')
              .where('id', '=', userId)
              .build();

            return await this.connection.query(query);
          }

          createConnection(config) {
            return new Connection(config);
          }
        }
      `;

      testContext.payload.code = complexCode;

      const measurements: number[] = [];

      for (let i = 0; i < 50; i++) {
        const startTime = performance.now();
        await immunityService.analyzeAction(testContext);
        const endTime = performance.now();
        measurements.push(endTime - startTime);
      }

      const avgLatency = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const maxLatency = Math.max(...measurements);

      expect(avgLatency).toBeLessThan(30);
      expect(maxLatency).toBeLessThan(60); // Allow some variance for complex code

      console.log(`Complex Code Analysis - Avg: ${avgLatency.toFixed(2)}ms, Max: ${maxLatency.toFixed(2)}ms`);
    });

    it('should handle malicious code detection within latency bounds', async () => {
      const maliciousCode = `
        const userInput = req.body.input;
        const command = "ls -la " + userInput + "; cat /etc/passwd";
        exec(command);

        const query = "SELECT * FROM users WHERE id = '" + userInput + "'";
        db.query(query);

        eval("return " + userInput);
      `;

      testContext.payload.code = maliciousCode;

      const measurements: number[] = [];

      for (let i = 0; i < 50; i++) {
        const startTime = performance.now();
        const result = await immunityService.analyzeAction(testContext);
        const endTime = performance.now();

        measurements.push(endTime - startTime);
        expect(result.blocked).toBe(true); // Should detect threats
      }

      const avgLatency = measurements.reduce((a, b) => a + b, 0) / measurements.length;

      expect(avgLatency).toBeLessThan(30);

      console.log(`Malicious Code Detection - Avg: ${avgLatency.toFixed(2)}ms`);
    });

    it('should meet latency requirements with full trajectory blocking system', async () => {
      const action = {
        agentId: 'benchmark-agent',
        actionId: 'benchmark-action',
        type: 'execute_code',
        payload: { code: 'const data = processUserInput(input);' },
        timestamp: Date.now()
      };

      const measurements: number[] = [];

      for (let i = 0; i < 50; i++) {
        const startTime = performance.now();
        await blockingSystem.evaluateAction(action);
        const endTime = performance.now();
        measurements.push(endTime - startTime);
      }

      const avgLatency = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const p95Latency = measurements.sort((a, b) => a - b)[Math.floor(measurements.length * 0.95)];

      expect(avgLatency).toBeLessThan(30);
      expect(p95Latency).toBeLessThan(40);

      console.log(`Full System Latency - Avg: ${avgLatency.toFixed(2)}ms, P95: ${p95Latency.toFixed(2)}ms`);
    });
  });

  describe('Throughput Benchmarks', () => {
    it('should handle high sequential throughput', async () => {
      const codeVariants = [
        'console.log("test1");',
        'const x = Math.random();',
        'function helper() { return true; }',
        'const data = { key: "value" };',
        'if (condition) { doSomething(); }'
      ];

      const actionsPerSecond = 100;
      const testDuration = 5000; // 5 seconds
      const totalActions = (actionsPerSecond * testDuration) / 1000;

      const startTime = performance.now();
      let completedActions = 0;

      for (let i = 0; i < totalActions; i++) {
        testContext.payload.code = codeVariants[i % codeVariants.length];
        await immunityService.analyzeAction(testContext);
        completedActions++;
      }

      const endTime = performance.now();
      const actualDuration = endTime - startTime;
      const actualThroughput = (completedActions / actualDuration) * 1000;

      expect(actualThroughput).toBeGreaterThan(80); // Should handle 80+ actions per second
      console.log(`Sequential Throughput: ${actualThroughput.toFixed(2)} actions/second`);
    });

    it('should handle concurrent request load', async () => {
      const concurrencyLevel = 20;
      const actionsPerBatch = 50;

      const generateBatch = () => Array.from({ length: actionsPerBatch }, (_, i) => ({
        ...testContext,
        payload: { code: `const test${i} = ${Math.random()};` }
      }));

      const batches = Array.from({ length: 10 }, generateBatch);

      const startTime = performance.now();

      const results = await Promise.all(
        batches.map(async (batch) => {
          const batchPromises = batch.map(context =>
            immunityService.analyzeAction(context)
          );
          return Promise.all(batchPromises);
        })
      );

      const endTime = performance.now();
      const totalActions = batches.length * actionsPerBatch;
      const duration = endTime - startTime;
      const throughput = (totalActions / duration) * 1000;

      expect(results.flat()).toHaveLength(totalActions);
      expect(throughput).toBeGreaterThan(100); // Should handle 100+ concurrent actions per second

      console.log(`Concurrent Throughput: ${throughput.toFixed(2)} actions/second with ${concurrencyLevel} concurrent batches`);
    });

    it('should maintain performance with trajectory context', async () => {
      // Add substantial trajectory context
      const largeTrajectory = Array.from({ length: 50 }, (_, i) => ({
        type: i % 2 === 0 ? 'thought' : 'action',
        content: `Step ${i}: ${Math.random().toString(36).substring(7)}`,
        timestamp: Date.now() - (50 - i) * 1000
      }));

      testContext.trajectory = largeTrajectory;

      const measurements: number[] = [];

      for (let i = 0; i < 50; i++) {
        testContext.payload.code = `console.log("trajectory test ${i}");`;

        const startTime = performance.now();
        await immunityService.analyzeAction(testContext);
        const endTime = performance.now();

        measurements.push(endTime - startTime);
      }

      const avgLatency = measurements.reduce((a, b) => a + b, 0) / measurements.length;

      // Should still meet latency requirements with large trajectory
      expect(avgLatency).toBeLessThan(40); // Allow slightly more for trajectory processing

      console.log(`Trajectory Context Performance - Avg: ${avgLatency.toFixed(2)}ms with ${largeTrajectory.length} trajectory steps`);
    });
  });

  describe('Memory Usage and Efficiency', () => {
    it('should maintain stable memory usage under load', async () => {
      const initialMemory = process.memoryUsage();

      // Process many actions to test memory stability
      for (let batch = 0; batch < 20; batch++) {
        const batchActions = Array.from({ length: 100 }, (_, i) => ({
          ...testContext,
          payload: { code: `const var${batch}_${i} = "test data ${Math.random()}";` }
        }));

        await Promise.all(
          batchActions.map(context => immunityService.analyzeAction(context))
        );

        // Force garbage collection every 5 batches
        if (batch % 5 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;

      // Memory increase should be reasonable
      expect(memoryIncreasePercent).toBeLessThan(50); // Less than 50% increase
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB

      console.log(`Memory Usage - Initial: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB, Final: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB, Increase: ${memoryIncreasePercent.toFixed(2)}%`);
    });

    it('should efficiently handle large code analysis', async () => {
      // Generate large code file
      const largeCode = `
        ${Array.from({ length: 1000 }, (_, i) => `
          function generatedFunction${i}() {
            const data${i} = {
              id: ${i},
              name: "Function ${i}",
              execute: function() {
                return Math.random() * ${i};
              }
            };
            return data${i};
          }
        `).join('\n')}
      `;

      testContext.payload.code = largeCode;

      const startMemory = process.memoryUsage().heapUsed;
      const startTime = performance.now();

      const result = await immunityService.analyzeAction(testContext);

      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;

      const analysisTime = endTime - startTime;
      const memoryUsed = endMemory - startMemory;

      expect(analysisTime).toBeLessThan(100); // Should handle large code reasonably
      expect(memoryUsed).toBeLessThan(50 * 1024 * 1024); // Less than 50MB for analysis
      expect(result).toBeDefined();

      console.log(`Large Code Analysis - Time: ${analysisTime.toFixed(2)}ms, Memory: ${(memoryUsed / 1024 / 1024).toFixed(2)}MB, Code Size: ${largeCode.length} characters`);
    });

    it('should demonstrate memory leak detection capability', async () => {
      let memoryReadings: number[] = [];

      // Take baseline reading
      if (global.gc) global.gc();
      memoryReadings.push(process.memoryUsage().heapUsed);

      // Simulate potential memory leak scenario
      for (let iteration = 0; iteration < 10; iteration++) {
        // Process batch of actions
        for (let i = 0; i < 100; i++) {
          testContext.payload.code = `const leak${iteration}_${i} = new Array(1000).fill("data");`;
          await immunityService.analyzeAction(testContext);
        }

        // Take memory reading
        if (global.gc) global.gc();
        memoryReadings.push(process.memoryUsage().heapUsed);
      }

      // Analyze memory trend
      const memoryIncreases = [];
      for (let i = 1; i < memoryReadings.length; i++) {
        memoryIncreases.push(memoryReadings[i] - memoryReadings[i - 1]);
      }

      const avgIncrease = memoryIncreases.reduce((a, b) => a + b, 0) / memoryIncreases.length;
      const maxIncrease = Math.max(...memoryIncreases);

      // Memory should stabilize (not continuously increase)
      expect(avgIncrease).toBeLessThan(5 * 1024 * 1024); // Less than 5MB average increase per iteration
      expect(maxIncrease).toBeLessThan(20 * 1024 * 1024); // Less than 20MB max increase

      console.log(`Memory Leak Test - Avg increase: ${(avgIncrease / 1024 / 1024).toFixed(2)}MB/iteration, Max: ${(maxIncrease / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Scalability and Load Testing', () => {
    it('should maintain performance with multiple analyzers', async () => {
      // Add more analyzers to test scalability
      const additionalAnalyzers = Array.from({ length: 5 }, (_, i) => ({
        analyze: vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 2)); // 2ms processing
          return {
            blocked: false,
            confidence: 0.1,
            reason: `Analyzer ${i} - no issues`,
            type: `custom_${i}`,
            analysisTimeMs: 2
          };
        }),
        getType: vi.fn().mockReturnValue(`custom_${i}`),
        getPriority: vi.fn().mockReturnValue(10 + i)
      }));

      additionalAnalyzers.forEach(analyzer => {
        immunityService.registerAnalyzer(analyzer as any);
      });

      const measurements: number[] = [];

      for (let i = 0; i < 30; i++) {
        const startTime = performance.now();
        await immunityService.analyzeAction(testContext);
        const endTime = performance.now();
        measurements.push(endTime - startTime);
      }

      const avgLatency = measurements.reduce((a, b) => a + b, 0) / measurements.length;

      // Should still meet requirements with 8 analyzers total
      expect(avgLatency).toBeLessThan(40);

      console.log(`Multiple Analyzers Performance - ${additionalAnalyzers.length + 3} analyzers, Avg: ${avgLatency.toFixed(2)}ms`);
    });

    it('should handle peak load scenarios', async () => {
      const peakLoad = 200; // 200 concurrent actions
      const actionVariants = [
        'console.log("peak test");',
        'const x = process.env.NODE_ENV;',
        'if (user.isAdmin()) { /* admin code */ }',
        'const query = "SELECT * FROM logs LIMIT 10";',
        'function helper() { return Math.random(); }'
      ];

      const peakActions = Array.from({ length: peakLoad }, (_, i) => ({
        ...testContext,
        actionId: `peak-${i}`,
        payload: { code: actionVariants[i % actionVariants.length] }
      }));

      const startTime = performance.now();

      const results = await Promise.all(
        peakActions.map(action => blockingSystem.evaluateAction(action))
      );

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgLatency = totalTime / peakLoad;

      expect(results).toHaveLength(peakLoad);
      expect(results.every(r => r.allowed !== undefined)).toBe(true);
      expect(avgLatency).toBeLessThan(50); // Allow higher latency under peak load

      const throughput = (peakLoad / totalTime) * 1000;
      console.log(`Peak Load Test - ${peakLoad} concurrent actions, Avg latency: ${avgLatency.toFixed(2)}ms, Throughput: ${throughput.toFixed(2)} actions/second`);
    });

    it('should demonstrate graceful degradation under extreme load', async () => {
      const extremeLoad = 500;
      const timeouts: number[] = [];
      const successes: number[] = [];

      // Configure with shorter timeout for extreme load test
      const extremeLoadService = new ImmunityService({
        parallelExecution: true,
        analyzerTimeout: 20, // Reduced timeout
        maxConcurrency: 50
      });

      extremeLoadService.registerAnalyzer(new SecurityImmunityAnalyzer());

      const extremeActions = Array.from({ length: extremeLoad }, (_, i) => ({
        ...testContext,
        payload: { code: `const extreme${i} = "test";` }
      }));

      const startTime = performance.now();

      const results = await Promise.allSettled(
        extremeActions.map(async (action, index) => {
          const actionStart = performance.now();
          try {
            const result = await extremeLoadService.analyzeAction(action);
            successes.push(performance.now() - actionStart);
            return result;
          } catch (error) {
            timeouts.push(performance.now() - actionStart);
            throw error;
          }
        })
      );

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      const successRate = (successCount / extremeLoad) * 100;

      console.log(`Extreme Load Test - ${extremeLoad} actions, Success rate: ${successRate.toFixed(2)}%, Total time: ${totalTime.toFixed(2)}ms`);

      // Should maintain reasonable success rate even under extreme load
      expect(successRate).toBeGreaterThan(70); // At least 70% success under extreme conditions

      if (successes.length > 0) {
        const avgSuccessTime = successes.reduce((a, b) => a + b, 0) / successes.length;
        expect(avgSuccessTime).toBeLessThan(100); // Successful operations should be reasonably fast
      }
    });
  });
});