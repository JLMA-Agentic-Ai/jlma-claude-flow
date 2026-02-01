/**
 * Comprehensive Unit Tests for AgentImmunityCore
 * AQE Testing Suite - Evidence-Based Quality Engineering
 */

import { AgentImmunityCore } from '../../../src/ais-plugin/src/core/AgentImmunityCore';
import {
  ThreatType,
  ThreatSeverity,
  ImmunityStatus,
  MitigationStrategy,
  ThreatDetection,
  BehaviorProfile,
  AISEventType,
  AISConfig
} from '../../../src/ais-plugin/src/types';
import { v4 as uuidv4 } from 'uuid';

describe('AgentImmunityCore', () => {
  let immunityCore: AgentImmunityCore;

  beforeEach(() => {
    immunityCore = new AgentImmunityCore({
      detection: {
        realTimeScanning: true,
        maxLatency: 100,
        confidenceThreshold: 0.7
      },
      behavior: {
        profilingEnabled: true,
        anomalyThreshold: 0.8
      },
      mitigation: {
        autoQuarantine: true,
        quarantineDuration: 3600000
      }
    });
  });

  afterEach(() => {
    immunityCore.removeAllListeners();
  });

  describe('Agent Registration', () => {
    it('should register new agents successfully', async () => {
      const agentId = 'test-agent-001';

      await immunityCore.registerAgent(agentId);

      const status = immunityCore.getAgentStatus(agentId);

      expect(status).toBeDefined();
      expect(status?.agentId).toBe(agentId);
      expect(status?.status).toBe(ImmunityStatus.HEALTHY);
      expect(status?.threatScore).toBe(0);
      expect(status?.behaviorScore).toBe(1);
      expect(status?.recentThreats).toHaveLength(0);
    });

    it('should not duplicate registration for existing agents', async () => {
      const agentId = 'test-agent-duplicate';

      await immunityCore.registerAgent(agentId);
      const initialStatus = immunityCore.getAgentStatus(agentId);

      // Register again
      await immunityCore.registerAgent(agentId);
      const secondStatus = immunityCore.getAgentStatus(agentId);

      expect(initialStatus?.timestamp).toBe(secondStatus?.timestamp);
    });

    it('should update system metrics on agent registration', async () => {
      const initialMetrics = immunityCore.getSystemMetrics();

      await immunityCore.registerAgent('test-agent-metrics-1');
      await immunityCore.registerAgent('test-agent-metrics-2');

      const updatedMetrics = immunityCore.getSystemMetrics();

      expect(updatedMetrics.totalAgents).toBe(initialMetrics.totalAgents + 2);
      expect(updatedMetrics.healthyAgents).toBe(initialMetrics.healthyAgents + 2);
    });
  });

  describe('Threat Detection Processing', () => {
    beforeEach(async () => {
      await immunityCore.registerAgent('test-agent-threats');
    });

    it('should process threat detections and update agent status', async () => {
      const agentId = 'test-agent-threats';

      const threat: ThreatDetection = {
        id: uuidv4(),
        timestamp: Date.now(),
        agentId,
        threatType: ThreatType.PROMPT_INJECTION,
        severity: ThreatSeverity.HIGH,
        confidence: 0.9,
        description: 'Test threat detection',
        evidence: { pattern: 'ignore instructions' },
        mitigation: MitigationStrategy.WARN,
        blocked: false
      };

      await immunityCore.processThreatDetection(threat);

      const status = immunityCore.getAgentStatus(agentId);

      expect(status?.recentThreats).toContain(threat);
      expect(status?.threatScore).toBeGreaterThan(0);
    });

    it('should calculate threat scores correctly', async () => {
      const agentId = 'test-agent-threat-score';
      await immunityCore.registerAgent(agentId);

      // Add critical threat
      const criticalThreat: ThreatDetection = {
        id: uuidv4(),
        timestamp: Date.now(),
        agentId,
        threatType: ThreatType.JAILBREAK,
        severity: ThreatSeverity.CRITICAL,
        confidence: 1.0,
        description: 'Critical threat',
        evidence: {},
        mitigation: MitigationStrategy.BLOCK,
        blocked: true
      };

      await immunityCore.processThreatDetection(criticalThreat);

      const status = immunityCore.getAgentStatus(agentId);

      expect(status?.threatScore).toBeGreaterThan(0.8);
      expect(status?.status).toBe(ImmunityStatus.COMPROMISED);
    });

    it('should emit threat detected events', async (done) => {
      const agentId = 'test-agent-events';
      await immunityCore.registerAgent(agentId);

      immunityCore.once(AISEventType.THREAT_DETECTED, (event) => {
        expect(event.agentId).toBe(agentId);
        expect(event.data.detection).toBeDefined();
        done();
      });

      const threat: ThreatDetection = {
        id: uuidv4(),
        timestamp: Date.now(),
        agentId,
        threatType: ThreatType.ROLE_MANIPULATION,
        severity: ThreatSeverity.MEDIUM,
        confidence: 0.8,
        description: 'Test event emission',
        evidence: {},
        mitigation: MitigationStrategy.MONITOR,
        blocked: false
      };

      await immunityCore.processThreatDetection(threat);
    });

    it('should trigger auto-mitigation for critical threats', async (done) => {
      const agentId = 'test-agent-auto-mitigation';
      await immunityCore.registerAgent(agentId);

      immunityCore.once(AISEventType.AGENT_QUARANTINED, (event) => {
        expect(event.agentId).toBe(agentId);
        done();
      });

      const criticalThreat: ThreatDetection = {
        id: uuidv4(),
        timestamp: Date.now(),
        agentId,
        threatType: ThreatType.CONTEXT_POISONING,
        severity: ThreatSeverity.CRITICAL,
        confidence: 0.95,
        description: 'Auto-mitigation test',
        evidence: {},
        mitigation: MitigationStrategy.QUARANTINE,
        blocked: true
      };

      await immunityCore.processThreatDetection(criticalThreat);
    });
  });

  describe('Behavioral Analysis', () => {
    beforeEach(async () => {
      await immunityCore.registerAgent('test-agent-behavior');
    });

    it('should update behavioral profiles', async () => {
      const agentId = 'test-agent-behavior';

      const normalProfile: BehaviorProfile = {
        agentId,
        timestamp: Date.now(),
        requestPattern: {
          frequency: 1.0,
          avgResponseTime: 500,
          errorRate: 0.02,
          resourceUsage: 0.3
        },
        communicationPattern: {
          recipientDistribution: { 'user': 0.8, 'system': 0.2 },
          messageComplexity: 0.5,
          sentiment: 0.1
        },
        outputPattern: {
          contentSimilarity: 0.7,
          lengthVariance: 0.3,
          novelty: 0.6
        }
      };

      await immunityCore.updateBehaviorProfile(agentId, normalProfile);

      const status = immunityCore.getAgentStatus(agentId);

      expect(status?.behaviorScore).toBeGreaterThan(0.5);
      expect(status?.status).toBe(ImmunityStatus.HEALTHY);
    });

    it('should detect behavioral anomalies', async () => {
      const agentId = 'test-agent-anomaly';
      await immunityCore.registerAgent(agentId);

      const anomalousProfile: BehaviorProfile = {
        agentId,
        timestamp: Date.now(),
        requestPattern: {
          frequency: 10.0, // Very high frequency
          avgResponseTime: 100,
          errorRate: 0.5, // High error rate
          resourceUsage: 0.9
        },
        communicationPattern: {
          recipientDistribution: { 'suspicious': 1.0 },
          messageComplexity: 3.0, // Very high complexity
          sentiment: -0.9 // Very negative sentiment
        },
        outputPattern: {
          contentSimilarity: 0.1,
          lengthVariance: 2.0,
          novelty: 0.1
        }
      };

      await immunityCore.updateBehaviorProfile(agentId, anomalousProfile);

      const status = immunityCore.getAgentStatus(agentId);

      expect(status?.behaviorScore).toBeLessThan(0.5);
      expect(status?.status).not.toBe(ImmunityStatus.HEALTHY);
    });
  });

  describe('Quarantine Management', () => {
    beforeEach(async () => {
      await immunityCore.registerAgent('test-agent-quarantine');
    });

    it('should quarantine agents successfully', async () => {
      const agentId = 'test-agent-quarantine';
      const reason = 'Test quarantine';
      const duration = 60000; // 1 minute

      await immunityCore.quarantineAgent(agentId, reason, duration);

      const status = immunityCore.getAgentStatus(agentId);

      expect(status?.status).toBe(ImmunityStatus.QUARANTINED);
      expect(status?.quarantineUntil).toBeDefined();
      expect(status?.quarantineUntil).toBeGreaterThan(Date.now());
    });

    it('should emit quarantine events', async (done) => {
      const agentId = 'test-agent-quarantine-events';
      await immunityCore.registerAgent(agentId);

      immunityCore.once(AISEventType.AGENT_QUARANTINED, (event) => {
        expect(event.agentId).toBe(agentId);
        expect(event.data.reason).toBe('Test event');
        done();
      });

      await immunityCore.quarantineAgent(agentId, 'Test event');
    });

    it('should auto-release from quarantine after duration', async (done) => {
      const agentId = 'test-agent-auto-release';
      await immunityCore.registerAgent(agentId);

      const shortDuration = 100; // 100ms

      immunityCore.once(AISEventType.STATUS_CHANGED, (event) => {
        if (event.data.action === 'released_from_quarantine') {
          expect(event.agentId).toBe(agentId);
          const status = immunityCore.getAgentStatus(agentId);
          expect(status?.status).toBe(ImmunityStatus.HEALTHY);
          done();
        }
      });

      await immunityCore.quarantineAgent(agentId, 'Auto-release test', shortDuration);
    }, 1000);

    it('should release from quarantine manually', async () => {
      const agentId = 'test-agent-manual-release';
      await immunityCore.registerAgent(agentId);

      await immunityCore.quarantineAgent(agentId, 'Manual release test');

      // Agent should be quarantined
      let status = immunityCore.getAgentStatus(agentId);
      expect(status?.status).toBe(ImmunityStatus.QUARANTINED);

      // Manually release
      await immunityCore.releaseFromQuarantine(agentId);

      status = immunityCore.getAgentStatus(agentId);
      expect(status?.status).toBe(ImmunityStatus.HEALTHY);
    });
  });

  describe('System Health Checks', () => {
    it('should perform system-wide health checks', async () => {
      await immunityCore.registerAgent('health-check-1');
      await immunityCore.registerAgent('health-check-2');

      // Quarantine one agent
      await immunityCore.quarantineAgent('health-check-2', 'Health check test', 100);

      await immunityCore.performSystemHealthCheck();

      // After health check, quarantine should be released (100ms duration)
      await new Promise(resolve => setTimeout(resolve, 150));
      await immunityCore.performSystemHealthCheck();

      const status = immunityCore.getAgentStatus('health-check-2');
      expect(status?.status).toBe(ImmunityStatus.HEALTHY);
    });

    it('should update health check timestamps', async () => {
      await immunityCore.registerAgent('timestamp-test');

      const initialStatus = immunityCore.getAgentStatus('timestamp-test');
      const initialTimestamp = initialStatus?.lastHealthCheck;

      await new Promise(resolve => setTimeout(resolve, 10));
      await immunityCore.performSystemHealthCheck();

      const updatedStatus = immunityCore.getAgentStatus('timestamp-test');
      const updatedTimestamp = updatedStatus?.lastHealthCheck;

      expect(updatedTimestamp).toBeGreaterThan(initialTimestamp!);
    });
  });

  describe('System Metrics', () => {
    it('should provide accurate system metrics', async () => {
      await immunityCore.registerAgent('metrics-1');
      await immunityCore.registerAgent('metrics-2');
      await immunityCore.registerAgent('metrics-3');

      // Add some threats
      const threat: ThreatDetection = {
        id: uuidv4(),
        timestamp: Date.now(),
        agentId: 'metrics-1',
        threatType: ThreatType.PROMPT_INJECTION,
        severity: ThreatSeverity.MEDIUM,
        confidence: 0.7,
        description: 'Metrics test',
        evidence: {},
        mitigation: MitigationStrategy.MONITOR,
        blocked: false
      };

      await immunityCore.processThreatDetection(threat);

      // Quarantine one agent
      await immunityCore.quarantineAgent('metrics-2', 'Metrics test');

      const metrics = immunityCore.getSystemMetrics();

      expect(metrics.totalAgents).toBe(3);
      expect(metrics.healthyAgents).toBe(2);
      expect(metrics.quarantinedAgents).toBe(1);
      expect(metrics.threatsDetected).toBeGreaterThan(0);
      expect(metrics.uptime).toBeGreaterThan(0);
      expect(metrics.memoryUsage).toBeGreaterThan(0);
    });

    it('should track threats across multiple agents', async () => {
      const agents = ['threat-track-1', 'threat-track-2', 'threat-track-3'];

      for (const agentId of agents) {
        await immunityCore.registerAgent(agentId);

        const threat: ThreatDetection = {
          id: uuidv4(),
          timestamp: Date.now(),
          agentId,
          threatType: ThreatType.JAILBREAK,
          severity: ThreatSeverity.HIGH,
          confidence: 0.8,
          description: 'Multi-agent threat tracking',
          evidence: {},
          mitigation: MitigationStrategy.WARN,
          blocked: false
        };

        await immunityCore.processThreatDetection(threat);
      }

      const metrics = immunityCore.getSystemMetrics();

      expect(metrics.threatsDetected).toBe(3);
      expect(metrics.totalAgents).toBe(3);
    });
  });

  describe('Recent Threats Retrieval', () => {
    beforeEach(async () => {
      await immunityCore.registerAgent('recent-threats-test');
    });

    it('should retrieve recent threats for an agent', async () => {
      const agentId = 'recent-threats-test';

      // Add multiple threats
      const threats: ThreatDetection[] = [];
      for (let i = 0; i < 5; i++) {
        const threat: ThreatDetection = {
          id: uuidv4(),
          timestamp: Date.now() + i,
          agentId,
          threatType: ThreatType.PROMPT_INJECTION,
          severity: ThreatSeverity.LOW,
          confidence: 0.6,
          description: `Test threat ${i}`,
          evidence: { index: i },
          mitigation: MitigationStrategy.MONITOR,
          blocked: false
        };

        threats.push(threat);
        await immunityCore.processThreatDetection(threat);
      }

      const recentThreats = immunityCore.getRecentThreats(agentId, 3);

      expect(recentThreats).toHaveLength(3);
      // Should be sorted by timestamp (most recent first)
      expect(recentThreats[0].timestamp).toBeGreaterThan(recentThreats[1].timestamp);
      expect(recentThreats[1].timestamp).toBeGreaterThan(recentThreats[2].timestamp);
    });

    it('should handle agents with no threats', async () => {
      const agentId = 'no-threats-test';
      await immunityCore.registerAgent(agentId);

      const recentThreats = immunityCore.getRecentThreats(agentId);

      expect(recentThreats).toHaveLength(0);
    });

    it('should handle unregistered agents', async () => {
      const recentThreats = immunityCore.getRecentThreats('nonexistent-agent');

      expect(recentThreats).toHaveLength(0);
    });
  });

  describe('Configuration and Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultCore = new AgentImmunityCore();

      expect(defaultCore).toBeDefined();

      const metrics = defaultCore.getSystemMetrics();
      expect(metrics.totalAgents).toBe(0);
    });

    it('should initialize with custom configuration', () => {
      const customConfig: Partial<AISConfig> = {
        detection: {
          realTimeScanning: false,
          maxLatency: 200,
          confidenceThreshold: 0.9
        },
        mitigation: {
          autoQuarantine: false
        }
      };

      const customCore = new AgentImmunityCore(customConfig);

      expect(customCore).toBeDefined();
    });

    it('should validate configuration schema', () => {
      const invalidConfig = {
        detection: {
          maxLatency: -100, // Invalid negative latency
          confidenceThreshold: 2.0 // Invalid confidence > 1
        }
      };

      expect(() => {
        new AgentImmunityCore(invalidConfig as any);
      }).toThrow();
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle high-frequency threat processing', async () => {
      const agentCount = 50;
      const threatsPerAgent = 20;

      // Register many agents
      for (let i = 0; i < agentCount; i++) {
        await immunityCore.registerAgent(`stress-test-${i}`);
      }

      const startTime = Date.now();

      // Process many threats in parallel
      const promises: Promise<void>[] = [];
      for (let i = 0; i < agentCount; i++) {
        for (let j = 0; j < threatsPerAgent; j++) {
          const threat: ThreatDetection = {
            id: uuidv4(),
            timestamp: Date.now(),
            agentId: `stress-test-${i}`,
            threatType: ThreatType.BEHAVIORAL_ANOMALY,
            severity: ThreatSeverity.LOW,
            confidence: 0.5,
            description: `Stress test threat ${j}`,
            evidence: {},
            mitigation: MitigationStrategy.MONITOR,
            blocked: false
          };

          promises.push(immunityCore.processThreatDetection(threat));
        }
      }

      await Promise.all(promises);

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const averageTimePerThreat = totalTime / (agentCount * threatsPerAgent);

      // Should process threats efficiently
      expect(averageTimePerThreat).toBeLessThan(10); // Less than 10ms per threat

      const metrics = immunityCore.getSystemMetrics();
      expect(metrics.totalAgents).toBe(agentCount);
      expect(metrics.threatsDetected).toBe(agentCount * threatsPerAgent);
    });

    it('should maintain performance under memory pressure', async () => {
      // Simulate memory pressure by creating many agents and threats
      const largeAgentCount = 100;

      for (let i = 0; i < largeAgentCount; i++) {
        await immunityCore.registerAgent(`memory-test-${i}`);

        // Add multiple threats to create memory usage
        for (let j = 0; j < 10; j++) {
          const threat: ThreatDetection = {
            id: uuidv4(),
            timestamp: Date.now(),
            agentId: `memory-test-${i}`,
            threatType: ThreatType.PROMPT_INJECTION,
            severity: ThreatSeverity.MEDIUM,
            confidence: 0.7,
            description: 'Memory pressure test',
            evidence: { largeData: 'x'.repeat(1000) }, // Large evidence
            mitigation: MitigationStrategy.MONITOR,
            blocked: false
          };

          await immunityCore.processThreatDetection(threat);
        }
      }

      // Should still respond quickly to new operations
      const startTime = Date.now();
      await immunityCore.registerAgent('final-test-agent');
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(50); // Should be fast even under memory pressure

      const metrics = immunityCore.getSystemMetrics();
      expect(metrics.memoryUsage).toBeGreaterThan(0);
    });
  });
});