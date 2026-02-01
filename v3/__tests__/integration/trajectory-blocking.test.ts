/**
 * Integration Tests for Agent Trajectory Blocking System
 * Tests end-to-end workflow: agent action → immunity analysis → blocking decision → fleet broadcast
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TrajectoryBlockingSystem } from '../../src/immunity/integration/TrajectoryBlockingSystem';
import { ImmunityService } from '../../src/immunity/core/ImmunityService';
import { AgentTrajectoryManager } from '../../src/agent-lifecycle/application/AgentTrajectoryManager';
import { FleetCommunicationService } from '../../src/communication/application/FleetCommunicationService';
import { SecurityImmunityAnalyzer } from '../../src/immunity/analyzers/SecurityImmunityAnalyzer';
import { TruthImmunityAnalyzer } from '../../src/immunity/analyzers/TruthImmunityAnalyzer';

describe('Trajectory Blocking Integration', () => {
  let blockingSystem: TrajectoryBlockingSystem;
  let immunityService: ImmunityService;
  let trajectoryManager: AgentTrajectoryManager;
  let fleetComms: FleetCommunicationService;
  let mockAgentAction: any;

  beforeEach(async () => {
    // Initialize mock services
    trajectoryManager = {
      getAgentTrajectory: vi.fn(),
      addTrajectoryStep: vi.fn(),
      updateTrajectoryOutcome: vi.fn()
    } as any;

    fleetComms = {
      broadcast: vi.fn(),
      subscribe: vi.fn(),
      getActiveAgents: vi.fn().mockResolvedValue(['agent-1', 'agent-2', 'agent-3'])
    } as any;

    // Initialize immunity service with real analyzers
    immunityService = new ImmunityService({
      globalConfidenceThreshold: 0.7,
      parallelExecution: true,
      stopOnFirstBlock: false
    });

    immunityService.registerAnalyzer(new SecurityImmunityAnalyzer());
    immunityService.registerAnalyzer(new TruthImmunityAnalyzer());

    // Initialize blocking system
    blockingSystem = new TrajectoryBlockingSystem({
      immunityService,
      trajectoryManager,
      fleetComms,
      blockingThreshold: 0.7,
      fleetBroadcastThreshold: 0.8
    });

    await blockingSystem.initialize();

    mockAgentAction = {
      agentId: 'test-agent-123',
      actionId: 'action-456',
      type: 'execute_code',
      payload: {
        code: 'console.log("Hello, World!");'
      },
      timestamp: Date.now(),
      context: {
        sessionId: 'session-789',
        taskId: 'task-101'
      }
    };
  });

  afterEach(async () => {
    await blockingSystem.shutdown();
    vi.clearAllMocks();
  });

  describe('End-to-End Blocking Workflow', () => {
    it('should allow safe actions through complete pipeline', async () => {
      // Mock trajectory with good intentions
      const safeTrajectory = [
        {
          type: 'thought',
          content: 'User wants to log a greeting message',
          timestamp: Date.now() - 2000
        },
        {
          type: 'action',
          content: 'Planning to use console.log for output',
          timestamp: Date.now() - 1000
        }
      ];

      trajectoryManager.getAgentTrajectory = vi.fn().mockResolvedValue(safeTrajectory);

      const result = await blockingSystem.evaluateAction(mockAgentAction);

      expect(result.allowed).toBe(true);
      expect(result.confidence).toBeLessThan(0.7);
      expect(result.analyzerResults).toBeDefined();
      expect(result.executionTimeMs).toBeLessThan(30);

      // Verify trajectory was updated
      expect(trajectoryManager.addTrajectoryStep).toHaveBeenCalledWith(
        mockAgentAction.agentId,
        expect.objectContaining({
          type: 'immunity_check',
          content: expect.any(String),
          result: 'allowed'
        })
      );

      // Verify no fleet broadcast for safe actions
      expect(fleetComms.broadcast).not.toHaveBeenCalled();
    });

    it('should block malicious actions and broadcast to fleet', async () => {
      const maliciousAction = {
        ...mockAgentAction,
        payload: {
          code: `
            const userInput = req.body.data;
            const query = "SELECT * FROM users WHERE id = '" + userInput + "'";
            db.query(query);
          `
        }
      };

      const suspiciousTrajectory = [
        {
          type: 'thought',
          content: 'Need to query user database directly',
          timestamp: Date.now() - 1000
        }
      ];

      trajectoryManager.getAgentTrajectory = vi.fn().mockResolvedValue(suspiciousTrajectory);

      const result = await blockingSystem.evaluateAction(maliciousAction);

      expect(result.allowed).toBe(false);
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.blockingReason).toContain('SQL injection');
      expect(result.blockedBy).toContain('security');

      // Verify trajectory was updated with block
      expect(trajectoryManager.updateTrajectoryOutcome).toHaveBeenCalledWith(
        maliciousAction.agentId,
        maliciousAction.actionId,
        'blocked',
        expect.objectContaining({
          reason: expect.stringContaining('SQL injection'),
          confidence: expect.any(Number)
        })
      );

      // Verify fleet broadcast
      expect(fleetComms.broadcast).toHaveBeenCalledWith({
        type: 'immunity_alert',
        agentId: maliciousAction.agentId,
        actionId: maliciousAction.actionId,
        blockReason: expect.stringContaining('SQL injection'),
        confidence: expect.any(Number),
        pattern: expect.any(String),
        timestamp: expect.any(Number)
      });
    });

    it('should handle partial blocks with mixed analyzer results', async () => {
      const mixedAction = {
        ...mockAgentAction,
        payload: {
          code: `
            // This code has minor security concerns but is mostly factual
            const tableName = userInput.replace(/[^a-zA-Z0-9_]/g, ''); // Basic sanitization
            const query = "SELECT * FROM " + tableName + " WHERE active = 1";
            // The Earth is round and gravity exists at 9.8 m/s²
          `
        }
      };

      const result = await blockingSystem.evaluateAction(mixedAction);

      expect(result.analyzerResults).toHaveLength(2);

      // Should have mixed results
      const securityResult = result.analyzerResults.find(r => r.type === 'security');
      const truthResult = result.analyzerResults.find(r => r.type === 'truth');

      expect(securityResult?.confidence).toBeGreaterThan(0.3);
      expect(securityResult?.confidence).toBeLessThan(0.7);
      expect(truthResult?.confidence).toBeLessThan(0.3);

      // Overall should be allowed since highest confidence < threshold
      expect(result.allowed).toBe(true);
      expect(result.confidence).toBeLessThan(0.7);
    });
  });

  describe('Fleet Communication Patterns', () => {
    it('should implement cf_hive pattern broadcasting', async () => {
      const criticalThreatAction = {
        ...mockAgentAction,
        payload: {
          code: 'exec("rm -rf / --no-preserve-root");'
        }
      };

      const result = await blockingSystem.evaluateAction(criticalThreatAction);

      expect(result.allowed).toBe(false);

      // Verify cf_hive pattern broadcast
      const broadcastCall = (fleetComms.broadcast as any).mock.calls[0][0];
      expect(broadcastCall.type).toBe('immunity_alert');
      expect(broadcastCall.severity).toBe('critical');
      expect(broadcastCall.pattern).toBeDefined();
      expect(broadcastCall.cf_hive_signature).toBeDefined();

      // Should include pattern for other agents to learn
      expect(broadcastCall.pattern).toContain('rm -rf');
    });

    it('should receive and apply fleet immunity patterns', async () => {
      // Simulate receiving fleet pattern
      const fleetPattern = {
        type: 'fleet_immunity_update',
        source: 'fleet-agent-456',
        pattern: {
          type: 'security_vulnerability',
          signature: /eval\s*\(\s*.*userInput.*\)/,
          confidence: 0.9,
          description: 'User input in eval() detected by fleet'
        },
        timestamp: Date.now(),
        cf_hive_id: 'pattern-789'
      };

      blockingSystem.receiveFleetPattern(fleetPattern);

      // Test action that matches fleet pattern
      const evalAction = {
        ...mockAgentAction,
        payload: {
          code: 'eval(userInput);'
        }
      };

      const result = await blockingSystem.evaluateAction(evalAction);

      expect(result.allowed).toBe(false);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.fleetPatternMatched).toBe(true);
      expect(result.matchedPatternId).toBe('pattern-789');
    });

    it('should coordinate with multiple fleet agents', async () => {
      fleetComms.getActiveAgents = vi.fn().mockResolvedValue([
        'agent-security-1',
        'agent-security-2',
        'agent-analysis-1'
      ]);

      const suspiciousAction = {
        ...mockAgentAction,
        payload: {
          code: 'subprocess.call(["cat", "/etc/passwd"]);'
        }
      };

      const result = await blockingSystem.evaluateAction(suspiciousAction);

      expect(result.allowed).toBe(false);

      // Verify broadcast includes fleet coordination info
      const broadcast = (fleetComms.broadcast as any).mock.calls[0][0];
      expect(broadcast.targetAgents).toEqual([
        'agent-security-1',
        'agent-security-2',
        'agent-analysis-1'
      ]);
      expect(broadcast.coordinationMode).toBe('cf_hive');
    });
  });

  describe('Performance and Scalability', () => {
    it('should meet <30ms latency requirement under normal load', async () => {
      const actions = Array.from({ length: 10 }, (_, i) => ({
        ...mockAgentAction,
        actionId: `action-${i}`,
        payload: { code: `console.log("Test ${i}");` }
      }));

      const startTime = performance.now();
      const results = await Promise.all(
        actions.map(action => blockingSystem.evaluateAction(action))
      );
      const endTime = performance.now();

      const avgTime = (endTime - startTime) / actions.length;
      expect(avgTime).toBeLessThan(30);

      expect(results).toHaveLength(10);
      expect(results.every(r => r.executionTimeMs < 30)).toBe(true);
    });

    it('should handle high concurrency with rate limiting', async () => {
      // Configure rate limiting
      blockingSystem.configureRateLimit({
        maxConcurrentEvaluations: 5,
        queueMaxSize: 20,
        timeoutMs: 100
      });

      // Generate 15 concurrent actions
      const actions = Array.from({ length: 15 }, (_, i) => ({
        ...mockAgentAction,
        agentId: `agent-${i}`,
        actionId: `action-${i}`,
        payload: { code: `console.log("Concurrent test ${i}");` }
      }));

      const startTime = performance.now();
      const results = await Promise.all(
        actions.map(action => blockingSystem.evaluateAction(action))
      );
      const endTime = performance.now();

      expect(results).toHaveLength(15);
      expect(results.every(r => r.allowed !== undefined)).toBe(true);

      // Should complete within reasonable time despite queuing
      expect(endTime - startTime).toBeLessThan(200);

      // Check rate limiting stats
      const stats = blockingSystem.getRateLimitStats();
      expect(stats.totalProcessed).toBe(15);
      expect(stats.maxConcurrency).toBeLessThanOrEqual(5);
    });

    it('should handle memory efficiently during extended operation', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Process many actions to test memory management
      for (let batch = 0; batch < 10; batch++) {
        const batchActions = Array.from({ length: 50 }, (_, i) => ({
          ...mockAgentAction,
          actionId: `batch-${batch}-action-${i}`,
          payload: { code: `var x${i} = ${Math.random()};` }
        }));

        await Promise.all(
          batchActions.map(action => blockingSystem.evaluateAction(action))
        );

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

      // Check for memory leaks in internal caches
      const cacheStats = blockingSystem.getCacheStats();
      expect(cacheStats.trajectoryCache.size).toBeLessThan(1000);
      expect(cacheStats.analysisCache.size).toBeLessThan(500);
    });
  });

  describe('Trajectory Context Integration', () => {
    it('should use trajectory context to improve accuracy', async () => {
      const contextualTrajectory = [
        {
          type: 'thought',
          content: 'User requested help with database security best practices',
          timestamp: Date.now() - 3000
        },
        {
          type: 'action',
          content: 'Researching parameterized queries',
          timestamp: Date.now() - 2000
        },
        {
          type: 'thought',
          content: 'Will demonstrate both good and bad examples',
          timestamp: Date.now() - 1000
        }
      ];

      trajectoryManager.getAgentTrajectory = vi.fn().mockResolvedValue(contextualTrajectory);

      // Code that would normally be flagged but is educational in context
      const educationalAction = {
        ...mockAgentAction,
        payload: {
          code: `
            // BAD EXAMPLE - SQL Injection vulnerability:
            // const query = "SELECT * FROM users WHERE id = '" + userInput + "'";

            // GOOD EXAMPLE - Parameterized query:
            const query = "SELECT * FROM users WHERE id = ?";
            db.query(query, [userInput]);
          `
        }
      };

      const result = await blockingSystem.evaluateAction(educationalAction);

      expect(result.allowed).toBe(true);
      expect(result.trajectoryInfluence).toBeGreaterThan(0);
      expect(result.contextualFactors).toContain('EDUCATIONAL_INTENT');

      // Confidence should be reduced due to positive trajectory context
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should escalate confidence for agents with bad trajectory patterns', async () => {
      const suspiciousTrajectory = [
        {
          type: 'thought',
          content: 'Looking for ways to bypass security',
          timestamp: Date.now() - 2000
        },
        {
          type: 'action',
          content: 'Searching for SQL injection techniques',
          timestamp: Date.now() - 1000
        }
      ];

      trajectoryManager.getAgentTrajectory = vi.fn().mockResolvedValue(suspiciousTrajectory);

      // Borderline code that becomes suspicious with trajectory
      const borderlineAction = {
        ...mockAgentAction,
        payload: {
          code: `
            const input = req.body.search;
            const query = "SELECT * FROM products WHERE name LIKE '%" + input + "%'";
          `
        }
      };

      const result = await blockingSystem.evaluateAction(borderlineAction);

      expect(result.allowed).toBe(false);
      expect(result.trajectoryInfluence).toBeLessThan(0);
      expect(result.contextualFactors).toContain('MALICIOUS_INTENT_PATTERN');

      // Confidence should be escalated due to negative trajectory
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle trajectory manager failures gracefully', async () => {
      trajectoryManager.getAgentTrajectory = vi.fn().mockRejectedValue(
        new Error('Trajectory service unavailable')
      );

      const result = await blockingSystem.evaluateAction(mockAgentAction);

      expect(result.allowed).toBeDefined(); // Should still return a decision
      expect(result.trajectoryError).toBe('Trajectory service unavailable');
      expect(result.fallbackMode).toBe(true);

      // Should still perform immunity analysis without trajectory context
      expect(result.analyzerResults.length).toBeGreaterThan(0);
    });

    it('should handle fleet communication failures', async () => {
      fleetComms.broadcast = vi.fn().mockRejectedValue(
        new Error('Fleet network unreachable')
      );

      const maliciousAction = {
        ...mockAgentAction,
        payload: { code: 'eval(userInput);' }
      };

      const result = await blockingSystem.evaluateAction(maliciousAction);

      expect(result.allowed).toBe(false); // Should still block
      expect(result.fleetBroadcastError).toBe('Fleet network unreachable');
      expect(result.localOnlyMode).toBe(true);

      // Verify action was still blocked locally
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should implement circuit breaker for failing services', async () => {
      // Configure circuit breaker
      blockingSystem.configureCircuitBreaker({
        failureThreshold: 3,
        recoveryTimeout: 5000
      });

      // Simulate repeated failures
      trajectoryManager.getAgentTrajectory = vi.fn().mockRejectedValue(
        new Error('Persistent failure')
      );

      // Trigger circuit breaker
      for (let i = 0; i < 4; i++) {
        await blockingSystem.evaluateAction(mockAgentAction);
      }

      const circuitStatus = blockingSystem.getCircuitBreakerStatus();
      expect(circuitStatus.trajectoryService).toBe('open');

      // Next call should fail fast
      const startTime = performance.now();
      const result = await blockingSystem.evaluateAction(mockAgentAction);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(5); // Fail fast
      expect(result.circuitBreakerTriggered).toBe(true);
    });
  });

  describe('Configuration and Extensibility', () => {
    it('should support custom blocking thresholds per analyzer', async () => {
      blockingSystem.configureAnalyzerThresholds({
        security: 0.6,  // Lower threshold for security
        truth: 0.9      // Higher threshold for truth
      });

      const mixedAction = {
        ...mockAgentAction,
        payload: {
          code: `
            // Moderate security concern
            const sql = "UPDATE users SET name = '" + userName + "' WHERE id = " + userId;
            // But contains accurate information
            console.log("Water boils at 100°C at sea level");
          `
        }
      };

      const result = await blockingSystem.evaluateAction(mixedAction);

      // Should be blocked by security despite truth being accurate
      expect(result.allowed).toBe(false);
      expect(result.blockedBy).toContain('security');

      const securityResult = result.analyzerResults.find(r => r.type === 'security');
      expect(securityResult?.confidence).toBeGreaterThan(0.6);
      expect(securityResult?.confidence).toBeLessThan(0.9);
    });

    it('should support runtime configuration updates', async () => {
      // Update configuration during runtime
      blockingSystem.updateConfiguration({
        blockingThreshold: 0.5,
        fleetBroadcastThreshold: 0.6,
        parallelAnalysis: false
      });

      const config = blockingSystem.getCurrentConfiguration();
      expect(config.blockingThreshold).toBe(0.5);
      expect(config.fleetBroadcastThreshold).toBe(0.6);
      expect(config.parallelAnalysis).toBe(false);

      // Test with new threshold
      const borderlineAction = {
        ...mockAgentAction,
        payload: {
          code: 'const query = "SELECT * FROM table_" + input;'
        }
      };

      const result = await blockingSystem.evaluateAction(borderlineAction);
      // Should be more likely to block with lower threshold
      expect(result.confidence).toBeGreaterThan(0.3);
    });
  });
});