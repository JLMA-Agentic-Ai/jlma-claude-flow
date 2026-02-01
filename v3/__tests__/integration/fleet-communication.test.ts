/**
 * Integration Tests for Fleet Communication and cf_hive Pattern Broadcasting
 * Tests multi-agent communication, pattern sharing, and coordinated immunity responses
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FleetCommunicationService } from '../../src/communication/application/FleetCommunicationService';
import { ImmunityService } from '../../src/immunity/core/ImmunityService';
import { AntibodySystem } from '../../src/immunity/core/AntibodySystem';
import { PatternMatcher } from '../../src/immunity/core/PatternMatcher';

describe('Fleet Communication Integration', () => {
  let fleetComms: FleetCommunicationService;
  let immunityServices: Map<string, ImmunityService>;
  let antibodySystems: Map<string, AntibodySystem>;
  let mockEventEmitters: Map<string, any>;

  const agentIds = ['agent-alpha', 'agent-beta', 'agent-gamma', 'agent-delta'];

  beforeEach(async () => {
    // Initialize fleet communication service
    fleetComms = new FleetCommunicationService({
      protocol: 'cf_hive',
      encryptionEnabled: true,
      byzantineFaultTolerance: true,
      quorumSize: 3,
      heartbeatInterval: 1000
    });

    immunityServices = new Map();
    antibodySystems = new Map();
    mockEventEmitters = new Map();

    // Initialize agents with immunity systems
    for (const agentId of agentIds) {
      const eventEmitter = {
        on: vi.fn(),
        emit: vi.fn(),
        off: vi.fn()
      };
      mockEventEmitters.set(agentId, eventEmitter);

      // Create immunity service for each agent
      const immunityService = new ImmunityService({
        parallelExecution: true,
        fleetIntegration: true,
        agentId
      });

      // Create antibody system for pattern management
      const antibodySystem = new AntibodySystem({
        patternMatcher: new PatternMatcher(),
        agentId,
        fleetSharingEnabled: true
      });

      immunityServices.set(agentId, immunityService);
      antibodySystems.set(agentId, antibodySystem);

      await fleetComms.registerAgent(agentId, {
        capabilities: ['immunity', 'pattern_matching'],
        priority: agentIds.indexOf(agentId),
        eventEmitter
      });
    }

    await fleetComms.initialize();
  });

  afterEach(async () => {
    await fleetComms.shutdown();
    vi.clearAllMocks();
  });

  describe('cf_hive Pattern Broadcasting', () => {
    it('should broadcast critical security patterns to all fleet agents', async () => {
      const discoveryAgent = 'agent-alpha';
      const criticalPattern = {
        type: 'security_vulnerability',
        pattern: {
          id: 'crit-sec-001',
          type: 'security' as const,
          name: 'Remote Code Execution',
          pattern: /eval\s*\(\s*req\.(body|query|params)\./gi,
          confidence: 0.95,
          severity: 'critical' as const,
          description: 'Direct eval() of user input - RCE vulnerability'
        },
        discoveredBy: discoveryAgent,
        timestamp: Date.now(),
        cf_hive_signature: 'cf_hive_crit_001'
      };

      // Agent Alpha discovers a critical pattern
      const broadcastResult = await fleetComms.broadcastPattern(criticalPattern, {
        priority: 'critical',
        requireAcknowledgment: true,
        targetAgents: agentIds.filter(id => id !== discoveryAgent)
      });

      expect(broadcastResult.success).toBe(true);
      expect(broadcastResult.deliveredTo).toHaveLength(3);
      expect(broadcastResult.acknowledgments).toHaveLength(3);

      // Verify other agents received and integrated the pattern
      for (const agentId of agentIds) {
        if (agentId !== discoveryAgent) {
          const antibodySystem = antibodySystems.get(agentId)!;
          const hasPattern = await antibodySystem.hasPattern('crit-sec-001');
          expect(hasPattern).toBe(true);

          const pattern = await antibodySystem.getPattern('crit-sec-001');
          expect(pattern?.metadata?.cf_hive_signature).toBe('cf_hive_crit_001');
          expect(pattern?.metadata?.receivedFrom).toBe(discoveryAgent);
        }
      }
    });

    it('should implement Byzantine fault tolerance for pattern consensus', async () => {
      const suspiciousPattern = {
        type: 'potential_threat',
        pattern: {
          id: 'suspicious-001',
          type: 'security' as const,
          name: 'Potential XSS',
          pattern: /<script.*>.*<\/script>/gi,
          confidence: 0.6, // Lower confidence requires consensus
          severity: 'medium' as const
        },
        discoveredBy: 'agent-alpha',
        timestamp: Date.now()
      };

      // Multiple agents need to validate the pattern
      const consensusResult = await fleetComms.requestPatternConsensus(suspiciousPattern, {
        requiredVotes: 3,
        votingTimeout: 5000,
        consensusThreshold: 0.75
      });

      expect(consensusResult.consensusReached).toBe(true);
      expect(consensusResult.votes.length).toBeGreaterThanOrEqual(3);
      expect(consensusResult.finalConfidence).toBeGreaterThan(0.6);

      // Pattern should be adopted only after consensus
      if (consensusResult.consensusReached) {
        for (const agentId of agentIds) {
          const antibodySystem = antibodySystems.get(agentId)!;
          const hasPattern = await antibodySystem.hasPattern('suspicious-001');
          expect(hasPattern).toBe(true);
        }
      }
    });

    it('should coordinate distributed immunity response to active threats', async () => {
      const activeThreats = [
        {
          agentId: 'agent-beta',
          threatType: 'sql_injection',
          code: 'SELECT * FROM users WHERE id = \'' + userInput + '\'',
          confidence: 0.9,
          timestamp: Date.now()
        },
        {
          agentId: 'agent-gamma',
          threatType: 'sql_injection',
          code: 'DELETE FROM logs WHERE user_id = \'' + userId + '\'',
          confidence: 0.85,
          timestamp: Date.now() - 1000
        }
      ];

      // Coordinate fleet response to multiple related threats
      const coordinatedResponse = await fleetComms.coordinateImmunityResponse(activeThreats, {
        emergencyProtocol: true,
        isolateAffectedAgents: true,
        sharePatterns: true
      });

      expect(coordinatedResponse.success).toBe(true);
      expect(coordinatedResponse.emergencyMode).toBe(true);
      expect(coordinatedResponse.patternsShared).toBeGreaterThan(0);
      expect(coordinatedResponse.agentsIsolated.length).toBe(2);

      // Verify fleet-wide pattern updates
      for (const agentId of agentIds) {
        const antibodySystem = antibodySystems.get(agentId)!;
        const sqlPatterns = await antibodySystem.getPatternsByType('security');
        const sqlInjectionPatterns = sqlPatterns.filter(p =>
          p.name.toLowerCase().includes('sql') ||
          p.description?.toLowerCase().includes('sql')
        );
        expect(sqlInjectionPatterns.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Pattern Learning and Propagation', () => {
    it('should propagate learned patterns across the fleet', async () => {
      const learningAgent = 'agent-beta';
      const antibodySystem = antibodySystems.get(learningAgent)!;

      // Simulate learning from a new threat type
      const newThreatData = {
        code: 'process.env.SECRET_KEY = userControlledValue;',
        threatType: 'environment_pollution',
        severity: 'high',
        confidence: 0.8,
        context: 'environment_variable_manipulation'
      };

      await antibodySystem.learnFromThreat(newThreatData);

      // Trigger fleet synchronization
      const syncResult = await fleetComms.synchronizePatterns({
        sourceAgent: learningAgent,
        propagationMode: 'selective',
        minConfidence: 0.7
      });

      expect(syncResult.success).toBe(true);
      expect(syncResult.patternsShared).toBeGreaterThan(0);

      // Verify other agents received the learned pattern
      for (const agentId of agentIds) {
        if (agentId !== learningAgent) {
          const targetAntibodySystem = antibodySystems.get(agentId)!;
          const patterns = await targetAntibodySystem.getPatternsByType('security');

          const envPollutionPattern = patterns.find(p =>
            p.description?.includes('environment') ||
            p.name.includes('environment')
          );
          expect(envPollutionPattern).toBeDefined();
        }
      }
    });

    it('should handle pattern versioning and updates across fleet', async () => {
      const originalPattern = {
        id: 'versioned-pattern-001',
        type: 'security' as const,
        name: 'Versioned Security Pattern',
        pattern: /password\s*=\s*["'].*["']/gi,
        confidence: 0.7,
        version: '1.0.0'
      };

      // All agents start with version 1.0.0
      for (const agentId of agentIds) {
        const antibodySystem = antibodySystems.get(agentId)!;
        await antibodySystem.registerPattern(originalPattern);
      }

      // Agent Alpha improves the pattern
      const improvedPattern = {
        ...originalPattern,
        pattern: /(?:password|secret|key)\s*[=:]\s*["'](?!placeholder|example|test).*["']/gi,
        confidence: 0.85,
        version: '2.0.0',
        improvementReason: 'Enhanced to catch more secret patterns and reduce false positives'
      };

      const updateAgent = 'agent-alpha';
      const antibodySystem = antibodySystems.get(updateAgent)!;
      await antibodySystem.updatePattern('versioned-pattern-001', improvedPattern);

      // Propagate update to fleet
      const updateResult = await fleetComms.propagatePatternUpdate({
        patternId: 'versioned-pattern-001',
        sourceAgent: updateAgent,
        updateType: 'enhancement',
        backwardsCompatible: true
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.agentsUpdated).toHaveLength(3);

      // Verify all agents have the updated pattern
      for (const agentId of agentIds) {
        const targetAntibodySystem = antibodySystems.get(agentId)!;
        const pattern = await targetAntibodySystem.getPattern('versioned-pattern-001');
        expect(pattern?.version).toBe('2.0.0');
        expect(pattern?.confidence).toBe(0.85);
      }
    });

    it('should implement conflict resolution for concurrent pattern updates', async () => {
      const basePattern = {
        id: 'concurrent-pattern',
        type: 'security' as const,
        name: 'Concurrent Update Test',
        pattern: /base.*pattern/gi,
        confidence: 0.6,
        version: '1.0.0'
      };

      // All agents start with base pattern
      for (const agentId of agentIds) {
        const antibodySystem = antibodySystems.get(agentId)!;
        await antibodySystem.registerPattern(basePattern);
      }

      // Two agents concurrently update the pattern
      const update1 = {
        ...basePattern,
        pattern: /enhanced.*pattern.*v1/gi,
        confidence: 0.8,
        version: '1.1.0',
        updatedBy: 'agent-alpha'
      };

      const update2 = {
        ...basePattern,
        pattern: /improved.*pattern.*v2/gi,
        confidence: 0.75,
        version: '1.2.0',
        updatedBy: 'agent-beta'
      };

      // Simulate concurrent updates
      const [result1, result2] = await Promise.all([
        fleetComms.requestPatternUpdate('concurrent-pattern', update1, {
          conflictResolution: 'merge',
          requireConsensus: true
        }),
        fleetComms.requestPatternUpdate('concurrent-pattern', update2, {
          conflictResolution: 'merge',
          requireConsensus: true
        })
      ]);

      // One update should succeed, the other should be merged or rejected
      expect(result1.success || result2.success).toBe(true);

      // Verify conflict resolution resulted in consistent state across fleet
      let finalVersions = new Set();
      for (const agentId of agentIds) {
        const antibodySystem = antibodySystems.get(agentId)!;
        const pattern = await antibodySystem.getPattern('concurrent-pattern');
        finalVersions.add(pattern?.version);
      }

      expect(finalVersions.size).toBe(1); // All agents should have same version
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-frequency pattern broadcasting efficiently', async () => {
      const patternCount = 50;
      const patterns = Array.from({ length: patternCount }, (_, i) => ({
        type: 'security_pattern',
        pattern: {
          id: `perf-pattern-${i}`,
          type: 'security' as const,
          name: `Performance Test Pattern ${i}`,
          pattern: new RegExp(`perftest${i}`, 'gi'),
          confidence: 0.6 + (i % 40) / 100
        },
        discoveredBy: 'agent-alpha',
        timestamp: Date.now() + i
      }));

      const startTime = performance.now();

      // Broadcast all patterns
      const results = await Promise.all(
        patterns.map(pattern =>
          fleetComms.broadcastPattern(pattern, { priority: 'normal' })
        )
      );

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerPattern = totalTime / patternCount;

      expect(avgTimePerPattern).toBeLessThan(50); // < 50ms per pattern
      expect(results.every(r => r.success)).toBe(true);

      // Verify all patterns were received by all agents
      for (const agentId of agentIds.slice(1)) { // Exclude sender
        const antibodySystem = antibodySystems.get(agentId)!;
        for (let i = 0; i < patternCount; i++) {
          const hasPattern = await antibodySystem.hasPattern(`perf-pattern-${i}`);
          expect(hasPattern).toBe(true);
        }
      }
    });

    it('should implement efficient pattern deduplication across fleet', async () => {
      // Multiple agents discover the same vulnerability pattern
      const commonPattern = {
        type: 'security' as const,
        name: 'Common XSS Pattern',
        pattern: /<script[^>]*>.*?<\/script>/gis,
        confidence: 0.8,
        severity: 'high' as const
      };

      const discoveries = agentIds.map((agentId, index) => ({
        ...commonPattern,
        id: `common-xss-${index}`, // Different IDs but same pattern
        discoveredBy: agentId,
        timestamp: Date.now() + index * 100
      }));

      // Broadcast all discoveries
      const broadcastPromises = discoveries.map((discovery, index) =>
        fleetComms.broadcastPattern({
          type: 'security_vulnerability',
          pattern: discovery,
          discoveredBy: agentIds[index],
          timestamp: Date.now()
        })
      );

      await Promise.all(broadcastPromises);

      // Enable deduplication
      const deduplicationResult = await fleetComms.performPatternDeduplication({
        similarityThreshold: 0.9,
        mergeStrategy: 'highest_confidence',
        preserveHistory: true
      });

      expect(deduplicationResult.duplicatesFound).toBeGreaterThan(0);
      expect(deduplicationResult.patternsRemoved).toBeGreaterThan(0);
      expect(deduplicationResult.patternsMerged).toBeGreaterThan(0);

      // Verify each agent has only one merged pattern
      for (const agentId of agentIds) {
        const antibodySystem = antibodySystems.get(agentId)!;
        const xssPatterns = await antibodySystem.searchPatterns('script.*script');

        // Should have only one deduplicated pattern
        expect(xssPatterns.length).toBe(1);
        expect(xssPatterns[0].metadata?.mergedFrom).toBeDefined();
      }
    });

    it('should handle network partitions and reconnection gracefully', async () => {
      // Simulate network partition - split fleet in half
      const partition1 = ['agent-alpha', 'agent-beta'];
      const partition2 = ['agent-gamma', 'agent-delta'];

      await fleetComms.simulateNetworkPartition({
        partitions: [partition1, partition2],
        duration: 2000 // 2 seconds
      });

      // Each partition develops patterns independently
      const partition1Pattern = {
        type: 'security_vulnerability',
        pattern: {
          id: 'partition-1-pattern',
          type: 'security' as const,
          name: 'Partition 1 Discovery',
          pattern: /partition.*1.*vuln/gi,
          confidence: 0.8
        },
        discoveredBy: 'agent-alpha',
        timestamp: Date.now()
      };

      const partition2Pattern = {
        type: 'security_vulnerability',
        pattern: {
          id: 'partition-2-pattern',
          type: 'security' as const,
          name: 'Partition 2 Discovery',
          pattern: /partition.*2.*vuln/gi,
          confidence: 0.7
        },
        discoveredBy: 'agent-gamma',
        timestamp: Date.now()
      };

      // Broadcast within partitions
      await fleetComms.broadcastPatternToPartition(partition1Pattern, partition1);
      await fleetComms.broadcastPatternToPartition(partition2Pattern, partition2);

      // Heal network partition
      await fleetComms.healNetworkPartition();

      // Trigger reconciliation
      const reconciliationResult = await fleetComms.performPartitionReconciliation({
        conflictResolution: 'merge',
        syncTimeout: 5000
      });

      expect(reconciliationResult.success).toBe(true);
      expect(reconciliationResult.patternsSynced).toBe(2);

      // Verify all agents have both patterns after reconciliation
      for (const agentId of agentIds) {
        const antibodySystem = antibodySystems.get(agentId)!;

        const hasPattern1 = await antibodySystem.hasPattern('partition-1-pattern');
        const hasPattern2 = await antibodySystem.hasPattern('partition-2-pattern');

        expect(hasPattern1).toBe(true);
        expect(hasPattern2).toBe(true);
      }
    });
  });

  describe('Security and Authentication', () => {
    it('should authenticate pattern sources and verify integrity', async () => {
      const authenticatedPattern = {
        type: 'security_vulnerability',
        pattern: {
          id: 'authenticated-pattern',
          type: 'security' as const,
          name: 'Authenticated Discovery',
          pattern: /auth.*pattern/gi,
          confidence: 0.9
        },
        discoveredBy: 'agent-alpha',
        timestamp: Date.now(),
        signature: 'mock-digital-signature',
        hash: 'mock-content-hash'
      };

      const broadcastResult = await fleetComms.broadcastPattern(authenticatedPattern, {
        requireAuthentication: true,
        verifyIntegrity: true
      });

      expect(broadcastResult.success).toBe(true);
      expect(broadcastResult.authenticated).toBe(true);

      // Verify pattern was accepted with authentication metadata
      for (const agentId of agentIds.slice(1)) {
        const antibodySystem = antibodySystems.get(agentId)!;
        const pattern = await antibodySystem.getPattern('authenticated-pattern');

        expect(pattern?.metadata?.authenticated).toBe(true);
        expect(pattern?.metadata?.verifiedSignature).toBeDefined();
        expect(pattern?.metadata?.sourceAgent).toBe('agent-alpha');
      }
    });

    it('should reject patterns from untrusted sources', async () => {
      const untrustedPattern = {
        type: 'security_vulnerability',
        pattern: {
          id: 'untrusted-pattern',
          type: 'security' as const,
          name: 'Untrusted Pattern',
          pattern: /malicious.*pattern/gi,
          confidence: 0.8
        },
        discoveredBy: 'unknown-agent', // Not in trusted fleet
        timestamp: Date.now()
      };

      const broadcastResult = await fleetComms.broadcastPattern(untrustedPattern, {
        requireAuthentication: true,
        trustLevel: 'high'
      });

      expect(broadcastResult.success).toBe(false);
      expect(broadcastResult.reason).toContain('untrusted source');

      // Verify no agents accepted the untrusted pattern
      for (const agentId of agentIds) {
        const antibodySystem = antibodySystems.get(agentId)!;
        const hasPattern = await antibodySystem.hasPattern('untrusted-pattern');
        expect(hasPattern).toBe(false);
      }
    });

    it('should implement encrypted pattern communication', async () => {
      const sensitivePattern = {
        type: 'security_vulnerability',
        pattern: {
          id: 'sensitive-pattern',
          type: 'security' as const,
          name: 'Sensitive Security Pattern',
          pattern: /sensitive.*info/gi,
          confidence: 0.9,
          classification: 'confidential'
        },
        discoveredBy: 'agent-alpha',
        timestamp: Date.now()
      };

      const encryptedBroadcast = await fleetComms.broadcastPattern(sensitivePattern, {
        encryption: 'aes-256-gcm',
        keyRotation: true,
        auditLog: true
      });

      expect(encryptedBroadcast.success).toBe(true);
      expect(encryptedBroadcast.encrypted).toBe(true);
      expect(encryptedBroadcast.auditEntryId).toBeDefined();

      // Verify pattern was received and decrypted correctly
      for (const agentId of agentIds.slice(1)) {
        const antibodySystem = antibodySystems.get(agentId)!;
        const pattern = await antibodySystem.getPattern('sensitive-pattern');

        expect(pattern).toBeDefined();
        expect(pattern?.classification).toBe('confidential');
        expect(pattern?.metadata?.encryptedTransmission).toBe(true);
      }
    });
  });
});