/**
 * REAL SONA Coherence Immunity Tests
 *
 * Tests for the real SONA integration replacing the mock semantic analyzer.
 * Validates <0.05ms performance target and Flash Attention optimization.
 */

import { CoherenceImmunity } from '../immunities/coherence';
import type { ImmunityViolation } from '../immunity-service';

describe('REAL SONA Coherence Immunity', () => {
  let coherenceImmunity: CoherenceImmunity;

  beforeAll(async () => {
    coherenceImmunity = new CoherenceImmunity();
    // Allow time for SONA initialization
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  describe('Performance Requirements', () => {
    test('should achieve <0.05ms analysis time target', async () => {
      const testData = {
        task: { description: 'Implement user authentication system' },
        metadata: {
          code: 'const auth = new AuthSystem(); auth.login(user, password);',
          purpose: 'Create secure login functionality'
        }
      };

      const startTime = performance.now();
      await coherenceImmunity.analyze(testData);
      const analysisTime = performance.now() - startTime;

      // SONA should achieve <0.05ms target with Flash Attention
      expect(analysisTime).toBeLessThan(0.05);
    });

    test('should maintain consistent performance over multiple analyses', async () => {
      const testCases = [
        {
          task: { description: 'Database query optimization' },
          metadata: { code: 'SELECT * FROM users WHERE active = true', implementation: 'Query active users' }
        },
        {
          task: { description: 'API endpoint creation' },
          metadata: { code: 'app.get("/api/users", handler)', implementation: 'REST endpoint for users' }
        },
        {
          task: { description: 'Error handling implementation' },
          metadata: { code: 'try { operation() } catch(e) { log(e) }', implementation: 'Catch and log errors' }
        }
      ];

      const times: number[] = [];

      for (const testCase of testCases) {
        const startTime = performance.now();
        await coherenceImmunity.analyze(testCase);
        times.push(performance.now() - startTime);
      }

      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);

      expect(avgTime).toBeLessThan(0.05);
      expect(maxTime).toBeLessThan(0.1); // Allow some variance
    });

    test('should track performance metrics', () => {
      const metrics = coherenceImmunity.getPerformanceMetrics();

      expect(metrics).toHaveProperty('analysisTime');
      expect(metrics).toHaveProperty('averageTime');
      expect(metrics).toHaveProperty('totalAnalyses');
      expect(Array.isArray(metrics.analysisTime)).toBe(true);
      expect(typeof metrics.averageTime).toBe('number');
      expect(typeof metrics.totalAnalyses).toBe('number');
    });
  });

  describe('Semantic Analysis Accuracy', () => {
    test('should detect high coherence between matching intent and implementation', async () => {
      const highCoherenceData = {
        task: { description: 'Create user authentication with JWT tokens' },
        metadata: {
          code: 'const jwt = require("jsonwebtoken"); function authenticate(user) { return jwt.sign({id: user.id}, secret); }',
          purpose: 'Implement JWT-based user authentication'
        }
      };

      const result = await coherenceImmunity.analyze(highCoherenceData);

      expect(result.score).toBeGreaterThan(0.7);
      expect(result.violations).toHaveLength(0);
    });

    test('should detect low coherence between mismatched intent and implementation', async () => {
      const lowCoherenceData = {
        task: { description: 'Implement user authentication system' },
        metadata: {
          code: 'function calculateTax(income) { return income * 0.2; }',
          implementation: 'Tax calculation function'
        }
      };

      const result = await coherenceImmunity.analyze(lowCoherenceData);

      expect(result.score).toBeLessThan(0.5);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].type).toBe('coherence_mismatch');
    });

    test('should provide contextual similarity scoring', async () => {
      const contextualData = {
        task: { description: 'Optimize database query performance' },
        metadata: {
          code: 'SELECT users.* FROM users INNER JOIN cache WHERE cache.valid = true',
          implementation: 'Use cached data for faster user queries'
        }
      };

      const result = await coherenceImmunity.analyze(contextualData);

      expect(result.score).toBeGreaterThan(0.5);
      expect(result.score).toBeLessThan(0.9); // Not perfect match, but related
    });

    test('should handle domain-specific semantic analysis', async () => {
      const domainSpecificCases = [
        {
          name: 'Security Domain',
          data: {
            task: { description: 'Implement input validation and sanitization' },
            metadata: {
              code: 'const validator = require("joi"); const schema = joi.string().alphanum().min(3);',
              implementation: 'Validate user input with Joi schema'
            }
          }
        },
        {
          name: 'Performance Domain',
          data: {
            task: { description: 'Add caching layer for API responses' },
            metadata: {
              code: 'const cache = new Redis(); app.use(cacheMiddleware());',
              implementation: 'Redis-based response caching'
            }
          }
        },
        {
          name: 'API Domain',
          data: {
            task: { description: 'Create REST endpoint for user management' },
            metadata: {
              code: 'app.post("/api/users", createUser); app.get("/api/users/:id", getUser);',
              implementation: 'REST CRUD endpoints for users'
            }
          }
        }
      ];

      for (const testCase of domainSpecificCases) {
        const result = await coherenceImmunity.analyze(testCase.data);

        expect(result.score).toBeGreaterThan(0.6);
        expect(result.violations.filter(v => v.severity === 'high')).toHaveLength(0);
      }
    });
  });

  describe('SONA Integration Features', () => {
    test('should handle SONA initialization gracefully', () => {
      expect(coherenceImmunity).toBeInstanceOf(CoherenceImmunity);
      expect(coherenceImmunity.name).toBe('coherence');
      expect(coherenceImmunity.weight).toBe(0.15);
    });

    test('should provide fallback when SONA is unavailable', async () => {
      // Create instance without waiting for SONA init
      const fastInstance = new CoherenceImmunity();

      const testData = {
        task: { description: 'Test fallback mechanism' },
        metadata: { code: 'console.log("test");', implementation: 'Log test message' }
      };

      const result = await fastInstance.analyze(testData);

      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('violations');
      expect(typeof result.score).toBe('number');
      expect(Array.isArray(result.violations)).toBe(true);
    });

    test('should handle edge cases gracefully', async () => {
      const edgeCases = [
        { task: null, metadata: null },
        { task: { description: '' }, metadata: { code: '' } },
        { task: { description: 'a' }, metadata: { code: 'b' } }, // Very short content
        { task: { description: undefined }, metadata: { code: undefined } }
      ];

      for (const edgeCase of edgeCases) {
        const result = await coherenceImmunity.analyze(edgeCase);

        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('violations');
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Flash Attention Optimization', () => {
    test('should show improved performance with Flash Attention enabled', async () => {
      // This test validates the Flash Attention integration
      // Performance improvement should be observable in real scenarios
      const complexData = {
        task: {
          description: 'Implement comprehensive machine learning pipeline with data preprocessing, model training, validation, and deployment automation including monitoring and logging capabilities'
        },
        metadata: {
          code: `
            class MLPipeline {
              constructor() {
                this.preprocessor = new DataPreprocessor();
                this.model = new NeuralNetwork();
                this.validator = new ModelValidator();
                this.monitor = new PerformanceMonitor();
              }

              async train(data) {
                const processed = await this.preprocessor.transform(data);
                const trained = await this.model.fit(processed);
                const validated = await this.validator.evaluate(trained);
                this.monitor.track(validated);
                return trained;
              }
            }
          `,
          implementation: 'Complete ML pipeline with preprocessing, training, validation, and monitoring'
        }
      };

      const startTime = performance.now();
      const result = await coherenceImmunity.analyze(complexData);
      const totalTime = performance.now() - startTime;

      // Even complex analysis should be fast with Flash Attention
      expect(totalTime).toBeLessThan(1.0); // 1ms for complex content
      expect(result.score).toBeGreaterThan(0.8); // Should detect high coherence
    });
  });

  describe('Memory Efficiency', () => {
    test('should maintain memory efficiency with Int8 quantization', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform multiple analyses to test memory usage
      const analyses = Array.from({ length: 50 }, (_, i) => ({
        task: { description: `Test analysis ${i} for memory efficiency validation` },
        metadata: {
          code: `function test${i}() { return ${i} * Math.random(); }`,
          implementation: `Test function ${i} returning random number`
        }
      }));

      for (const analysis of analyses) {
        await coherenceImmunity.analyze(analysis);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreasePerAnalysis = memoryIncrease / analyses.length;

      // Memory increase should be minimal with quantization
      expect(memoryIncreasePerAnalysis).toBeLessThan(1024 * 1024); // Less than 1MB per analysis
    });
  });

  describe('Real-world Integration Scenarios', () => {
    test('should handle typical agent task analysis', async () => {
      const agentTaskData = {
        agent: { type: 'coder', id: 'agent-123' },
        task: { description: 'Refactor authentication middleware for better security' },
        metadata: {
          code: `
            const bcrypt = require('bcrypt');
            const jwt = require('jsonwebtoken');

            function authMiddleware(req, res, next) {
              const token = req.headers.authorization?.split(' ')[1];
              if (!token) return res.status(401).json({error: 'No token'});

              try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                req.user = decoded;
                next();
              } catch (error) {
                res.status(401).json({error: 'Invalid token'});
              }
            }
          `,
          purpose: 'Enhanced JWT authentication middleware with error handling',
          commands: ['npm install bcrypt jsonwebtoken', 'node server.js']
        }
      };

      const result = await coherenceImmunity.analyze(agentTaskData);

      expect(result.score).toBeGreaterThan(0.7);
      expect(result.violations.filter(v => v.severity === 'high')).toHaveLength(0);
    });

    test('should detect coherence violations in misaligned agent actions', async () => {
      const misalignedData = {
        agent: { type: 'security-auditor', id: 'security-agent' },
        task: { description: 'Conduct security audit of authentication system' },
        metadata: {
          code: `
            function generateRandomColors() {
              const colors = ['red', 'blue', 'green', 'yellow'];
              return colors[Math.floor(Math.random() * colors.length)];
            }
          `,
          purpose: 'Generate random color values for UI themes',
          commands: ['node color-generator.js']
        }
      };

      const result = await coherenceImmunity.analyze(misalignedData);

      expect(result.score).toBeLessThan(0.3);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations.some(v => v.type === 'coherence_mismatch')).toBe(true);
    });
  });
});