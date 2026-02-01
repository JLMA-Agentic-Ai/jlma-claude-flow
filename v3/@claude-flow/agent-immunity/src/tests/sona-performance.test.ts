/**
 * SONA Performance Validation Tests
 *
 * Validates the <0.05ms performance target and Flash Attention optimization
 * Tests memory efficiency, throughput, and real-time analysis capabilities
 */

import { CoherenceImmunity } from '../immunities/coherence';

describe('SONA Performance Validation', () => {
  let coherenceImmunity: CoherenceImmunity;

  beforeAll(async () => {
    coherenceImmunity = new CoherenceImmunity();
    // Allow time for SONA initialization and model warm-up
    await new Promise(resolve => setTimeout(resolve, 3000));
  });

  describe('Latency Requirements', () => {
    test('should consistently achieve <0.05ms analysis time', async () => {
      const testCases = Array.from({ length: 100 }, (_, i) => ({
        task: { description: `Performance test case ${i} for latency validation` },
        metadata: {
          code: `function performanceTest${i}() { return "test-${i}"; }`,
          implementation: `Test function ${i} for performance measurement`
        }
      }));

      const analysisPromises = testCases.map(async (testCase) => {
        const startTime = performance.now();
        await coherenceImmunity.analyze(testCase);
        return performance.now() - startTime;
      });

      const analysisTimes = await Promise.all(analysisPromises);

      const averageTime = analysisTimes.reduce((sum, time) => sum + time, 0) / analysisTimes.length;
      const maxTime = Math.max(...analysisTimes);
      const minTime = Math.min(...analysisTimes);

      console.log(`Performance metrics: avg=${averageTime.toFixed(4)}ms, max=${maxTime.toFixed(4)}ms, min=${minTime.toFixed(4)}ms`);

      // 95% of analyses should be under target
      const underTarget = analysisTimes.filter(time => time < 0.05).length;
      const successRate = (underTarget / analysisTimes.length) * 100;

      expect(averageTime).toBeLessThan(0.05);
      expect(successRate).toBeGreaterThan(95); // 95% under target
    });

    test('should maintain low latency under concurrent load', async () => {
      const concurrentAnalyses = Array.from({ length: 20 }, (_, i) => ({
        task: { description: `Concurrent analysis ${i} for load testing` },
        metadata: {
          code: `async function concurrent${i}() { await Promise.resolve(${i}); }`,
          implementation: `Async function ${i} for concurrent testing`
        }
      }));

      const startTime = performance.now();

      // Run all analyses concurrently
      const results = await Promise.all(
        concurrentAnalyses.map(async (analysis) => {
          const analyzeStart = performance.now();
          const result = await coherenceImmunity.analyze(analysis);
          const analyzeTime = performance.now() - analyzeStart;
          return { result, analyzeTime };
        })
      );

      const totalTime = performance.now() - startTime;

      const individualTimes = results.map(r => r.analyzeTime);
      const maxConcurrentTime = Math.max(...individualTimes);
      const avgConcurrentTime = individualTimes.reduce((sum, time) => sum + time, 0) / individualTimes.length;

      console.log(`Concurrent performance: total=${totalTime.toFixed(4)}ms, max_individual=${maxConcurrentTime.toFixed(4)}ms, avg_individual=${avgConcurrentTime.toFixed(4)}ms`);

      // Individual analyses should still be fast under concurrent load
      expect(avgConcurrentTime).toBeLessThan(0.1); // Allow some variance under load
      expect(maxConcurrentTime).toBeLessThan(0.2);
    });
  });

  describe('Throughput Optimization', () => {
    test('should achieve high throughput with Flash Attention', async () => {
      const batchSize = 50;
      const testBatch = Array.from({ length: batchSize }, (_, i) => ({
        task: { description: `Throughput test ${i} measuring analyses per second` },
        metadata: {
          code: `function throughputTest${i}(data) { return data.map(x => x * ${i}); }`,
          implementation: `Data transformation function ${i} for throughput testing`
        }
      }));

      const startTime = performance.now();

      // Process batch sequentially to measure raw throughput
      for (const testCase of testBatch) {
        await coherenceImmunity.analyze(testCase);
      }

      const totalTime = performance.now() - startTime;
      const throughput = (batchSize / totalTime) * 1000; // analyses per second

      console.log(`Throughput: ${throughput.toFixed(2)} analyses/second (${batchSize} analyses in ${totalTime.toFixed(2)}ms)`);

      // Target: >1000 analyses/second with Flash Attention optimization
      expect(throughput).toBeGreaterThan(1000);
    });

    test('should scale efficiently with input size', async () => {
      const testSizes = [
        { size: 'small', content: 'function test() { return true; }' },
        { size: 'medium', content: 'function mediumTest(data) { return data.filter(x => x > 0).map(x => x * 2); }' },
        { size: 'large', content: `
          class LargeTestClass {
            constructor(data) {
              this.data = data;
              this.cache = new Map();
              this.processor = new DataProcessor();
            }

            async processData() {
              const results = [];
              for (const item of this.data) {
                if (this.cache.has(item.id)) {
                  results.push(this.cache.get(item.id));
                } else {
                  const processed = await this.processor.transform(item);
                  this.cache.set(item.id, processed);
                  results.push(processed);
                }
              }
              return results;
            }
          }
        ` }
      ];

      const scalingResults: Record<string, number> = {};

      for (const testSize of testSizes) {
        const testData = {
          task: { description: `Scaling test for ${testSize.size} input` },
          metadata: {
            code: testSize.content,
            implementation: `${testSize.size} implementation for scaling test`
          }
        };

        const startTime = performance.now();
        await coherenceImmunity.analyze(testData);
        scalingResults[testSize.size] = performance.now() - startTime;
      }

      console.log('Scaling results:', scalingResults);

      // Analysis time should scale sub-linearly with input size
      expect(scalingResults.small).toBeLessThan(0.05);
      expect(scalingResults.medium).toBeLessThan(0.1);
      expect(scalingResults.large).toBeLessThan(0.2);

      // Verify sub-linear scaling
      const scalingFactor = scalingResults.large / scalingResults.small;
      expect(scalingFactor).toBeLessThan(10); // Should not scale linearly
    });
  });

  describe('Memory Efficiency', () => {
    test('should maintain stable memory usage with Int8 quantization', async () => {
      const initialMemory = process.memoryUsage();

      // Perform sustained analysis to test memory leaks
      for (let i = 0; i < 200; i++) {
        await coherenceImmunity.analyze({
          task: { description: `Memory test ${i} for stability validation` },
          metadata: {
            code: `function memTest${i}() { return Array(100).fill(${i}); }`,
            implementation: `Memory test function ${i}`
          }
        });

        // Check memory every 50 iterations
        if (i % 50 === 0) {
          const currentMemory = process.memoryUsage();
          const heapGrowth = currentMemory.heapUsed - initialMemory.heapUsed;

          console.log(`Iteration ${i}: heap growth = ${(heapGrowth / 1024 / 1024).toFixed(2)}MB`);

          // Memory growth should be minimal and stable
          expect(heapGrowth).toBeLessThan(50 * 1024 * 1024); // Less than 50MB growth
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const totalGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(`Total memory growth: ${(totalGrowth / 1024 / 1024).toFixed(2)}MB`);

      // With quantization, memory growth should be minimal
      expect(totalGrowth).toBeLessThan(20 * 1024 * 1024); // Less than 20MB final growth
    });

    test('should efficiently handle large batch processing', async () => {
      const largeBatch = Array.from({ length: 100 }, (_, i) => ({
        task: { description: `Large batch item ${i} for memory efficiency testing` },
        metadata: {
          code: `
            function batchItem${i}(input) {
              const result = [];
              for (let j = 0; j < 100; j++) {
                result.push(input + j + ${i});
              }
              return result;
            }
          `,
          implementation: `Batch processing function ${i} with array operations`
        }
      }));

      const initialMemory = process.memoryUsage().heapUsed;
      const startTime = performance.now();

      // Process large batch
      const results = await Promise.all(
        largeBatch.map(item => coherenceImmunity.analyze(item))
      );

      const processingTime = performance.now() - startTime;
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      console.log(`Batch processing: ${results.length} items in ${processingTime.toFixed(2)}ms, memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

      // Efficient batch processing metrics
      expect(processingTime).toBeLessThan(5000); // 5 seconds for 100 items
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
      expect(results).toHaveLength(largeBatch.length);
    });
  });

  describe('Flash Attention Validation', () => {
    test('should demonstrate Flash Attention speedup on complex inputs', async () => {
      const complexInput = {
        task: {
          description: 'Implement a comprehensive microservices architecture with event-driven communication, distributed caching, load balancing, circuit breakers, monitoring, logging, and automated deployment pipelines including blue-green deployment strategies, canary releases, and rollback mechanisms'
        },
        metadata: {
          code: `
            class MicroserviceArchitecture {
              constructor() {
                this.services = new Map();
                this.eventBus = new EventBus();
                this.cache = new DistributedCache();
                this.loadBalancer = new LoadBalancer();
                this.circuitBreaker = new CircuitBreaker();
                this.monitor = new ServiceMonitor();
                this.logger = new StructuredLogger();
                this.deploymentManager = new DeploymentManager();
              }

              async deployService(service, strategy = 'blue-green') {
                try {
                  this.logger.info('Starting deployment', { service: service.name, strategy });

                  const healthCheck = await this.monitor.validateHealth(service);
                  if (!healthCheck.healthy) {
                    throw new Error('Service health check failed');
                  }

                  switch (strategy) {
                    case 'blue-green':
                      return await this.deploymentManager.blueGreenDeploy(service);
                    case 'canary':
                      return await this.deploymentManager.canaryDeploy(service);
                    default:
                      return await this.deploymentManager.standardDeploy(service);
                  }
                } catch (error) {
                  this.logger.error('Deployment failed', { error, service: service.name });
                  await this.deploymentManager.rollback(service);
                  throw error;
                }
              }

              async handleEvent(event) {
                const startTime = Date.now();

                try {
                  if (this.circuitBreaker.isOpen(event.target)) {
                    throw new Error('Circuit breaker open');
                  }

                  const cachedResult = await this.cache.get(event.cacheKey);
                  if (cachedResult) {
                    return cachedResult;
                  }

                  const result = await this.processEvent(event);
                  await this.cache.set(event.cacheKey, result);

                  this.circuitBreaker.onSuccess(event.target);
                  return result;
                } catch (error) {
                  this.circuitBreaker.onError(event.target);
                  this.logger.error('Event processing failed', { error, event });
                  throw error;
                } finally {
                  const duration = Date.now() - startTime;
                  this.monitor.recordLatency(event.target, duration);
                }
              }
            }
          `,
          implementation: 'Complete microservices architecture with event-driven communication, distributed caching, load balancing, circuit breakers, monitoring, structured logging, and automated deployment with blue-green, canary, and rollback strategies'
        }
      };

      // Test with complex input that benefits from Flash Attention
      const iterations = 10;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        const result = await coherenceImmunity.analyze(complexInput);
        const analysisTime = performance.now() - startTime;
        times.push(analysisTime);

        // Should still achieve good coherence score
        expect(result.score).toBeGreaterThan(0.8);
      }

      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);

      console.log(`Flash Attention performance on complex input: avg=${avgTime.toFixed(4)}ms, max=${maxTime.toFixed(4)}ms`);

      // Even complex analysis should benefit from Flash Attention optimization
      expect(avgTime).toBeLessThan(2.0); // 2ms for very complex content
      expect(maxTime).toBeLessThan(5.0); // Maximum 5ms even for worst case
    });

    test('should maintain accuracy with Flash Attention optimization', async () => {
      const accuracyTestCases = [
        {
          name: 'High coherence case',
          data: {
            task: { description: 'Implement Redis caching for database queries' },
            metadata: {
              code: 'const redis = require("redis"); const client = redis.createClient(); app.get("/api/data", async (req, res) => { const cached = await client.get("data"); if (cached) return res.json(JSON.parse(cached)); });',
              implementation: 'Redis-based caching layer for API endpoints'
            }
          },
          expectedRange: { min: 0.7, max: 1.0 }
        },
        {
          name: 'Medium coherence case',
          data: {
            task: { description: 'Add user authentication to API' },
            metadata: {
              code: 'const logger = require("winston"); logger.info("User logged in");',
              implementation: 'Logging user authentication events'
            }
          },
          expectedRange: { min: 0.3, max: 0.7 }
        },
        {
          name: 'Low coherence case',
          data: {
            task: { description: 'Implement secure password hashing' },
            metadata: {
              code: 'function sortNumbers(arr) { return arr.sort((a, b) => a - b); }',
              implementation: 'Sort array of numbers in ascending order'
            }
          },
          expectedRange: { min: 0.0, max: 0.4 }
        }
      ];

      for (const testCase of accuracyTestCases) {
        const result = await coherenceImmunity.analyze(testCase.data);

        console.log(`${testCase.name}: score=${result.score.toFixed(3)}`);

        expect(result.score).toBeGreaterThanOrEqual(testCase.expectedRange.min);
        expect(result.score).toBeLessThanOrEqual(testCase.expectedRange.max);
      }
    });
  });

  describe('Real-time Analysis Capabilities', () => {
    test('should support real-time streaming analysis', async () => {
      const streamingData = Array.from({ length: 20 }, (_, i) => ({
        task: { description: `Real-time analysis ${i} for streaming validation` },
        metadata: {
          code: `function streamProcessor${i}(chunk) { return chunk.map(x => x + ${i}); }`,
          implementation: `Stream processing function ${i}`
        }
      }));

      const results: Array<{ score: number; time: number }> = [];
      let totalTime = 0;

      // Simulate real-time streaming with minimal delays
      for (const data of streamingData) {
        await new Promise(resolve => setTimeout(resolve, 5)); // 5ms delay between analyses

        const startTime = performance.now();
        const result = await coherenceImmunity.analyze(data);
        const analysisTime = performance.now() - startTime;

        results.push({ score: result.score, time: analysisTime });
        totalTime += analysisTime;
      }

      const avgAnalysisTime = totalTime / streamingData.length;
      const maxAnalysisTime = Math.max(...results.map(r => r.time));

      console.log(`Streaming analysis: avg=${avgAnalysisTime.toFixed(4)}ms, max=${maxAnalysisTime.toFixed(4)}ms`);

      // Real-time analysis requirements
      expect(avgAnalysisTime).toBeLessThan(0.1); // 0.1ms average for real-time
      expect(maxAnalysisTime).toBeLessThan(1.0); // 1ms maximum for any analysis
      expect(results).toHaveLength(streamingData.length);
    });
  });
});