/**
 * Unit Tests for Core Immunity Service
 * Tests the central immunity coordination, analyzer management, and decision making
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { ImmunityService } from '../../../src/immunity/core/ImmunityService';
import { ImmunityContext, ImmunityResult, ImmunityAnalyzer } from '../../../src/immunity/types';
import { SecurityImmunityAnalyzer } from '../../../src/immunity/analyzers/SecurityImmunityAnalyzer';
import { TruthImmunityAnalyzer } from '../../../src/immunity/analyzers/TruthImmunityAnalyzer';

describe('ImmunityService', () => {
  let immunityService: ImmunityService;
  let mockSecurityAnalyzer: MockedFunction<SecurityImmunityAnalyzer>;
  let mockTruthAnalyzer: MockedFunction<TruthImmunityAnalyzer>;
  let mockContext: ImmunityContext;

  beforeEach(() => {
    // Create mocked analyzers
    mockSecurityAnalyzer = vi.fn() as any;
    mockSecurityAnalyzer.analyze = vi.fn();
    mockSecurityAnalyzer.getType = vi.fn().mockReturnValue('security');
    mockSecurityAnalyzer.getPriority = vi.fn().mockReturnValue(1);

    mockTruthAnalyzer = vi.fn() as any;
    mockTruthAnalyzer.analyze = vi.fn();
    mockTruthAnalyzer.getType = vi.fn().mockReturnValue('truth');
    mockTruthAnalyzer.getPriority = vi.fn().mockReturnValue(2);

    // Initialize service with mocked analyzers
    immunityService = new ImmunityService();
    immunityService.registerAnalyzer(mockSecurityAnalyzer as any);
    immunityService.registerAnalyzer(mockTruthAnalyzer as any);

    mockContext = {
      agentId: 'test-agent-123',
      action: 'execute_code',
      payload: { code: 'console.log("test");' },
      trajectory: [],
      timestamp: Date.now()
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Analyzer Registration and Management', () => {
    it('should register analyzers correctly', () => {
      const newService = new ImmunityService();
      const customAnalyzer = {
        analyze: vi.fn(),
        getType: vi.fn().mockReturnValue('custom'),
        getPriority: vi.fn().mockReturnValue(5)
      } as any;

      newService.registerAnalyzer(customAnalyzer);
      const analyzers = newService.getRegisteredAnalyzers();

      expect(analyzers).toHaveLength(1);
      expect(analyzers[0].getType()).toBe('custom');
    });

    it('should prevent duplicate analyzer registration', () => {
      const duplicateAnalyzer = {
        analyze: vi.fn(),
        getType: vi.fn().mockReturnValue('security'),
        getPriority: vi.fn().mockReturnValue(1)
      } as any;

      expect(() => {
        immunityService.registerAnalyzer(duplicateAnalyzer);
      }).toThrow('Analyzer of type "security" is already registered');
    });

    it('should unregister analyzers', () => {
      immunityService.unregisterAnalyzer('truth');
      const analyzers = immunityService.getRegisteredAnalyzers();

      expect(analyzers).toHaveLength(1);
      expect(analyzers[0].getType()).toBe('security');
    });

    it('should sort analyzers by priority', () => {
      const highPriorityAnalyzer = {
        analyze: vi.fn(),
        getType: vi.fn().mockReturnValue('critical'),
        getPriority: vi.fn().mockReturnValue(0)
      } as any;

      immunityService.registerAnalyzer(highPriorityAnalyzer);
      const analyzers = immunityService.getRegisteredAnalyzers();

      expect(analyzers[0].getType()).toBe('critical'); // Priority 0 (highest)
      expect(analyzers[1].getType()).toBe('security'); // Priority 1
      expect(analyzers[2].getType()).toBe('truth'); // Priority 2
    });
  });

  describe('Core Analysis Workflow', () => {
    it('should execute all analyzers and aggregate results', async () => {
      mockSecurityAnalyzer.analyze.mockResolvedValue({
        blocked: true,
        confidence: 0.8,
        reason: 'SQL injection detected',
        type: 'security',
        analysisTimeMs: 15
      });

      mockTruthAnalyzer.analyze.mockResolvedValue({
        blocked: false,
        confidence: 0.2,
        reason: 'Factual accuracy verified',
        type: 'truth',
        analysisTimeMs: 12
      });

      const result = await immunityService.analyzeAction(mockContext);

      expect(mockSecurityAnalyzer.analyze).toHaveBeenCalledWith(mockContext);
      expect(mockTruthAnalyzer.analyze).toHaveBeenCalledWith(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.highestConfidence).toBe(0.8);
      expect(result.blockingAnalyzer).toBe('security');
      expect(result.totalAnalysisTimeMs).toBe(27);
      expect(result.results).toHaveLength(2);
    });

    it('should stop on first high-confidence block when configured', async () => {
      const fastService = new ImmunityService({
        stopOnFirstBlock: true,
        fastFailThreshold: 0.7
      });

      fastService.registerAnalyzer(mockSecurityAnalyzer as any);
      fastService.registerAnalyzer(mockTruthAnalyzer as any);

      mockSecurityAnalyzer.analyze.mockResolvedValue({
        blocked: true,
        confidence: 0.9,
        reason: 'Critical security violation',
        type: 'security',
        analysisTimeMs: 10
      });

      const result = await fastService.analyzeAction(mockContext);

      expect(mockSecurityAnalyzer.analyze).toHaveBeenCalled();
      expect(mockTruthAnalyzer.analyze).not.toHaveBeenCalled();
      expect(result.blocked).toBe(true);
      expect(result.earlyTermination).toBe(true);
    });

    it('should handle analyzer failures gracefully', async () => {
      mockSecurityAnalyzer.analyze.mockRejectedValue(new Error('Analyzer crashed'));
      mockTruthAnalyzer.analyze.mockResolvedValue({
        blocked: false,
        confidence: 0.3,
        reason: 'No truth issues',
        type: 'truth',
        analysisTimeMs: 8
      });

      const result = await immunityService.analyzeAction(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].error).toBeDefined();
      expect(result.results[1].blocked).toBe(false);
      expect(result.analyzerFailures).toBe(1);
    });

    it('should respect confidence thresholds', async () => {
      const thresholdService = new ImmunityService({ globalConfidenceThreshold: 0.8 });
      thresholdService.registerAnalyzer(mockSecurityAnalyzer as any);

      mockSecurityAnalyzer.analyze.mockResolvedValue({
        blocked: true,
        confidence: 0.6,  // Below threshold
        reason: 'Low confidence security issue',
        type: 'security',
        analysisTimeMs: 10
      });

      const result = await thresholdService.analyzeAction(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.thresholdOverride).toBe(true);
      expect(result.originallyBlocked).toBe(true);
    });
  });

  describe('Performance and Latency Requirements', () => {
    it('should complete analysis within 30ms target', async () => {
      mockSecurityAnalyzer.analyze.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 8));
        return {
          blocked: false,
          confidence: 0.1,
          reason: 'No issues',
          type: 'security',
          analysisTimeMs: 8
        };
      });

      mockTruthAnalyzer.analyze.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 6));
        return {
          blocked: false,
          confidence: 0.1,
          reason: 'No issues',
          type: 'truth',
          analysisTimeMs: 6
        };
      });

      const startTime = performance.now();
      const result = await immunityService.analyzeAction(mockContext);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(30);
      expect(result.totalAnalysisTimeMs).toBeLessThan(30);
    });

    it('should timeout long-running analyzers', async () => {
      const timeoutService = new ImmunityService({ analyzerTimeout: 20 });
      timeoutService.registerAnalyzer(mockSecurityAnalyzer as any);

      mockSecurityAnalyzer.analyze.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50)); // Exceeds timeout
        return { blocked: false, confidence: 0, reason: 'timeout test' };
      });

      const result = await timeoutService.analyzeAction(mockContext);

      expect(result.results[0].error).toContain('timeout');
      expect(result.results[0].timedOut).toBe(true);
    });

    it('should handle concurrent analyzer execution', async () => {
      const concurrentService = new ImmunityService({
        parallelExecution: true,
        maxConcurrency: 5
      });

      // Add multiple analyzers
      for (let i = 0; i < 5; i++) {
        const analyzer = {
          analyze: vi.fn().mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            return {
              blocked: false,
              confidence: 0.1,
              reason: `Analyzer ${i} result`,
              type: `analyzer_${i}`,
              analysisTimeMs: 10
            };
          }),
          getType: vi.fn().mockReturnValue(`analyzer_${i}`),
          getPriority: vi.fn().mockReturnValue(i)
        } as any;

        concurrentService.registerAnalyzer(analyzer);
      }

      const startTime = performance.now();
      const result = await concurrentService.analyzeAction(mockContext);
      const endTime = performance.now();

      // Should complete faster than sequential (5 * 10ms = 50ms)
      expect(endTime - startTime).toBeLessThan(25);
      expect(result.results).toHaveLength(5);
      expect(result.executionMode).toBe('concurrent');
    });
  });

  describe('Context and Trajectory Analysis', () => {
    it('should provide trajectory context to analyzers', async () => {
      const contextWithTrajectory = {
        ...mockContext,
        trajectory: [
          {
            type: 'thought',
            content: 'Planning to implement security measures',
            timestamp: Date.now() - 2000
          },
          {
            type: 'action',
            content: 'Installing security dependencies',
            timestamp: Date.now() - 1000
          }
        ]
      };

      mockSecurityAnalyzer.analyze.mockResolvedValue({
        blocked: false,
        confidence: 0.2,
        reason: 'Security context noted',
        type: 'security',
        analysisTimeMs: 10,
        trajectoryInfluence: 0.3
      });

      const result = await immunityService.analyzeAction(contextWithTrajectory);

      expect(mockSecurityAnalyzer.analyze).toHaveBeenCalledWith(contextWithTrajectory);
      expect(result.results[0].trajectoryInfluence).toBeDefined();
    });

    it('should track agent behavior patterns', async () => {
      const agentId = 'pattern-test-agent';

      // Simulate multiple actions from same agent
      for (let i = 0; i < 3; i++) {
        mockSecurityAnalyzer.analyze.mockResolvedValue({
          blocked: i === 2, // Block on third attempt
          confidence: 0.3 + (i * 0.3),
          reason: `Attempt ${i + 1}`,
          type: 'security',
          analysisTimeMs: 5
        });

        await immunityService.analyzeAction({
          ...mockContext,
          agentId,
          action: `action_${i}`
        });
      }

      const agentStats = immunityService.getAgentStats(agentId);

      expect(agentStats.totalActions).toBe(3);
      expect(agentStats.blockedActions).toBe(1);
      expect(agentStats.averageConfidence).toBeCloseTo(0.6, 1);
      expect(agentStats.riskTrend).toBe('increasing');
    });

    it('should maintain analyzer performance metrics', async () => {
      mockSecurityAnalyzer.analyze.mockResolvedValue({
        blocked: false,
        confidence: 0.2,
        reason: 'Normal operation',
        type: 'security',
        analysisTimeMs: 12
      });

      // Run multiple analyses
      for (let i = 0; i < 5; i++) {
        await immunityService.analyzeAction(mockContext);
      }

      const metrics = immunityService.getAnalyzerMetrics('security');

      expect(metrics.totalAnalyses).toBe(5);
      expect(metrics.averageLatency).toBeCloseTo(12, 1);
      expect(metrics.successRate).toBe(1.0);
      expect(metrics.averageConfidence).toBeCloseTo(0.2, 1);
    });
  });

  describe('Fleet Communication and Broadcasting', () => {
    it('should broadcast high-confidence blocks to fleet', async () => {
      const broadcastSpy = vi.spyOn(immunityService, 'broadcastToFleet');

      mockSecurityAnalyzer.analyze.mockResolvedValue({
        blocked: true,
        confidence: 0.95,
        reason: 'Critical security violation',
        type: 'security',
        analysisTimeMs: 8,
        severity: 'critical'
      });

      const result = await immunityService.analyzeAction(mockContext);

      expect(broadcastSpy).toHaveBeenCalledWith({
        type: 'immunity_alert',
        agentId: mockContext.agentId,
        blockReason: 'Critical security violation',
        confidence: 0.95,
        analyzerType: 'security',
        severity: 'critical',
        timestamp: expect.any(Number)
      });
    });

    it('should handle fleet pattern updates', async () => {
      const fleetPattern = {
        type: 'security_vulnerability',
        pattern: 'eval(userInput)',
        confidence: 0.9,
        source: 'fleet-agent-456',
        timestamp: Date.now()
      };

      immunityService.receiveFleetPattern(fleetPattern);

      mockSecurityAnalyzer.analyze.mockImplementation(async (context) => {
        const hasPattern = JSON.stringify(context.payload).includes('eval(');
        return {
          blocked: hasPattern,
          confidence: hasPattern ? 0.9 : 0.1,
          reason: hasPattern ? 'Fleet pattern match' : 'No issues',
          type: 'security',
          analysisTimeMs: 5,
          fleetPatternMatch: hasPattern
        };
      });

      const maliciousContext = {
        ...mockContext,
        payload: { code: 'eval(userInput)' }
      };

      const result = await immunityService.analyzeAction(maliciousContext);

      expect(result.blocked).toBe(true);
      expect(result.results[0].fleetPatternMatch).toBe(true);
      expect(result.fleetLearningApplied).toBe(true);
    });
  });

  describe('Custom Immunity Registration', () => {
    it('should support runtime analyzer registration', async () => {
      const customAnalyzer = {
        analyze: vi.fn().mockResolvedValue({
          blocked: true,
          confidence: 0.7,
          reason: 'Custom rule violation',
          type: 'custom_rule',
          analysisTimeMs: 5
        }),
        getType: vi.fn().mockReturnValue('custom_rule'),
        getPriority: vi.fn().mockReturnValue(3)
      };

      immunityService.registerAnalyzer(customAnalyzer as any);

      const result = await immunityService.analyzeAction(mockContext);

      expect(result.results).toHaveLength(3); // Original 2 + custom
      expect(result.blocked).toBe(true);
      expect(result.blockingAnalyzer).toBe('security'); // Security has higher priority
    });

    it('should support analyzer configuration updates', async () => {
      immunityService.updateAnalyzerConfig('security', {
        confidenceThreshold: 0.5,
        strictMode: false
      });

      const config = immunityService.getAnalyzerConfig('security');

      expect(config.confidenceThreshold).toBe(0.5);
      expect(config.strictMode).toBe(false);
    });

    it('should validate analyzer interface compliance', () => {
      const invalidAnalyzer = {
        // Missing required methods
        getType: vi.fn().mockReturnValue('invalid')
      };

      expect(() => {
        immunityService.registerAnalyzer(invalidAnalyzer as any);
      }).toThrow('Analyzer must implement required interface methods');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should continue operation when all analyzers fail', async () => {
      mockSecurityAnalyzer.analyze.mockRejectedValue(new Error('Security analyzer failed'));
      mockTruthAnalyzer.analyze.mockRejectedValue(new Error('Truth analyzer failed'));

      const result = await immunityService.analyzeAction(mockContext);

      expect(result.blocked).toBe(false); // Fail safe - allow action
      expect(result.analyzerFailures).toBe(2);
      expect(result.failSafeMode).toBe(true);
      expect(result.results.every(r => r.error)).toBe(true);
    });

    it('should provide detailed error information', async () => {
      mockSecurityAnalyzer.analyze.mockRejectedValue(new Error('Network timeout'));

      const result = await immunityService.analyzeAction(mockContext);

      expect(result.results[0].error).toBe('Network timeout');
      expect(result.results[0].errorType).toBe('analyzer_error');
      expect(result.results[0].stackTrace).toBeDefined();
    });

    it('should implement circuit breaker for failing analyzers', async () => {
      const circuitService = new ImmunityService({
        circuitBreakerThreshold: 3,
        circuitBreakerWindow: 60000
      });

      circuitService.registerAnalyzer(mockSecurityAnalyzer as any);

      // Simulate multiple failures
      mockSecurityAnalyzer.analyze.mockRejectedValue(new Error('Persistent failure'));

      for (let i = 0; i < 4; i++) {
        await circuitService.analyzeAction(mockContext);
      }

      const circuitStatus = circuitService.getCircuitBreakerStatus('security');

      expect(circuitStatus.state).toBe('open');
      expect(circuitStatus.failureCount).toBe(4);
    });
  });
});