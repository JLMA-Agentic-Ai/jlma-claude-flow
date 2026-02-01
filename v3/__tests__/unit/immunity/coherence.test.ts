/**
 * Unit Tests for Coherence Immunity Analyzer
 * Tests logical consistency, reasoning validation, and coherence detection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CoherenceImmunityAnalyzer } from '../../../src/immunity/analyzers/CoherenceImmunityAnalyzer';
import { ImmunityContext, ImmunityResult } from '../../../src/immunity/types';

describe('CoherenceImmunityAnalyzer', () => {
  let analyzer: CoherenceImmunityAnalyzer;
  let mockContext: ImmunityContext;

  beforeEach(() => {
    analyzer = new CoherenceImmunityAnalyzer();
    mockContext = {
      agentId: 'test-agent',
      action: 'generate_response',
      payload: {},
      trajectory: [],
      timestamp: Date.now()
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Logical Consistency Detection', () => {
    it('should detect contradictory statements', async () => {
      const contradictoryText = `
        The system is completely secure and has no vulnerabilities.
        However, there are several critical security flaws that need immediate attention.
        All data is encrypted, but we store passwords in plain text for convenience.
      `;

      mockContext.payload = { response: contradictoryText };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.reason).toContain('logical inconsistency');
      expect(result.contradictions).toBeGreaterThan(0);
    });

    it('should detect circular reasoning', async () => {
      const circularText = `
        This solution works because it's effective.
        It's effective because it solves the problem.
        It solves the problem because this solution works.
      `;

      mockContext.payload = { response: circularText };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.6);
      expect(result.logicalFallacies).toContain('CIRCULAR_REASONING');
    });

    it('should allow logically consistent explanations', async () => {
      const consistentText = `
        The application uses HTTPS encryption to protect data in transit.
        This prevents man-in-the-middle attacks by ensuring data integrity.
        Additionally, we implement proper certificate validation to verify server identity.
      `;

      mockContext.payload = { response: consistentText };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.confidence).toBeLessThan(0.3);
      expect(result.coherenceScore).toBeGreaterThan(0.8);
    });
  });

  describe('Argument Structure Analysis', () => {
    it('should detect weak reasoning chains', async () => {
      const weakReasoning = `
        We should implement this feature because everyone else is doing it.
        Since it's popular, it must be good.
        Therefore, we don't need to evaluate its actual merit.
      `;

      mockContext.payload = { response: weakReasoning };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.6);
      expect(result.logicalFallacies).toContain('BANDWAGON_FALLACY');
      expect(result.reasoningQuality).toBeLessThan(0.4);
    });

    it('should detect hasty generalizations', async () => {
      const hastyGeneralization = `
        I tested this code once and it worked perfectly.
        Therefore, this code will never have any bugs.
        All future use cases will work exactly the same way.
      `;

      mockContext.payload = { response: hastyGeneralization };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.logicalFallacies).toContain('HASTY_GENERALIZATION');
    });

    it('should recognize strong logical arguments', async () => {
      const strongReasoning = `
        Based on the performance metrics collected over 6 months,
        we can see that Algorithm A consistently outperforms Algorithm B
        in 95% of test cases with similar input characteristics.
        Therefore, Algorithm A is the better choice for our use case.
      `;

      mockContext.payload = { response: strongReasoning };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.confidence).toBeLessThan(0.3);
      expect(result.reasoningQuality).toBeGreaterThan(0.8);
      expect(result.evidenceSupport).toBeGreaterThan(0.7);
    });
  });

  describe('Causal Relationship Analysis', () => {
    it('should detect false cause-effect relationships', async () => {
      const falseeCausation = `
        Every time we deploy on Fridays, something goes wrong.
        Therefore, Friday deployments cause system failures.
        We should ban all Friday deployments permanently.
      `;

      mockContext.payload = { response: falseeCausation };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.6);
      expect(result.logicalFallacies).toContain('POST_HOC_FALLACY');
      expect(result.causalAnalysis.validity).toBeLessThan(0.4);
    });

    it('should recognize valid causal relationships', async () => {
      const validCausation = `
        When we increased the database connection pool size from 10 to 50,
        response times improved by 40% during peak load.
        This improvement is consistent with connection pool theory,
        as fewer requests now wait for available connections.
      `;

      mockContext.payload = { response: validCausation };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.confidence).toBeLessThan(0.4);
      expect(result.causalAnalysis.validity).toBeGreaterThan(0.7);
      expect(result.mechanismExplained).toBe(true);
    });

    it('should detect missing intermediate steps in reasoning', async () => {
      const missingSteps = `
        We need to improve user experience.
        Therefore, we should rewrite everything in a different programming language.
        This will definitely solve all our problems.
      `;

      mockContext.payload = { response: missingSteps };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.6);
      expect(result.reasoningGaps).toBeGreaterThan(0);
      expect(result.logicalFallacies).toContain('NON_SEQUITUR');
    });
  });

  describe('Consistency with Context', () => {
    it('should detect responses inconsistent with stated goals', async () => {
      mockContext.trajectory = [
        {
          type: 'thought',
          content: 'Need to improve system security and reduce vulnerabilities',
          timestamp: Date.now() - 2000
        }
      ];

      const inconsistentResponse = `
        To improve security, we should disable all authentication.
        Also, let's store all passwords in a public text file.
        This will make the system much more secure.
      `;

      mockContext.payload = { response: inconsistentResponse };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.trajectoryConsistency).toBeLessThan(0.2);
      expect(result.contextualFactors).toContain('GOAL_CONTRADICTION');
    });

    it('should verify consistency with established facts in trajectory', async () => {
      mockContext.trajectory = [
        {
          type: 'action',
          content: 'Established that the system uses Node.js and Express framework',
          timestamp: Date.now() - 2000
        },
        {
          type: 'thought',
          content: 'User wants to add database integration',
          timestamp: Date.now() - 1000
        }
      ];

      const consistentResponse = `
        For Node.js and Express applications, we can integrate MongoDB using Mongoose ODM.
        This will work well with our existing Express routing structure.
        We'll need to install the mongoose package and configure the connection.
      `;

      mockContext.payload = { response: consistentResponse };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.confidence).toBeLessThan(0.3);
      expect(result.trajectoryConsistency).toBeGreaterThan(0.8);
      expect(result.technicalConsistency).toBeGreaterThan(0.7);
    });

    it('should detect scope creep in reasoning', async () => {
      mockContext.trajectory = [
        {
          type: 'thought',
          content: 'User asked how to fix a small CSS styling issue',
          timestamp: Date.now() - 1000
        }
      ];

      const scopeCreepResponse = `
        To fix this CSS issue, we should completely redesign the entire application architecture.
        Let's migrate from React to Vue.js, rewrite the backend in Go,
        change databases from PostgreSQL to MongoDB,
        and while we're at it, redesign the entire user interface.
      `;

      mockContext.payload = { response: scopeCreepResponse };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.scopeAlignment).toBeLessThan(0.3);
      expect(result.logicalFallacies).toContain('SCOPE_CREEP');
    });
  });

  describe('Internal Logic Validation', () => {
    it('should detect self-contradicting statements', async () => {
      const selfContradiction = `
        This function always returns true, except when it returns false.
        The database is read-only, but you can write to it.
        This constant variable changes based on user input.
      `;

      mockContext.payload = { response: selfContradiction };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.contradictions).toBeGreaterThan(2);
      expect(result.logicalFallacies).toContain('SELF_CONTRADICTION');
    });

    it('should validate conditional logic coherence', async () => {
      const incoherentLogic = `
        If the user is logged in, deny access.
        If the user is not logged in, also deny access.
        If access is denied, grant full permissions.
      `;

      mockContext.payload = { response: incoherentLogic };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.logicalStructure.coherence).toBeLessThan(0.3);
    });

    it('should allow coherent conditional logic', async () => {
      const coherentLogic = `
        If the user is authenticated and has admin privileges, allow access to admin panel.
        If the user is authenticated but not admin, allow access to user dashboard.
        If the user is not authenticated, redirect to login page.
      `;

      mockContext.payload = { response: coherentLogic };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.confidence).toBeLessThan(0.3);
      expect(result.logicalStructure.coherence).toBeGreaterThan(0.8);
    });
  });

  describe('Temporal Consistency', () => {
    it('should detect timeline inconsistencies', async () => {
      const timelineIssue = `
        First, we deploy the application to production.
        Then, we write the code for the application.
        After that, we test the code we just wrote.
        Finally, we plan what the application should do.
      `;

      mockContext.payload = { response: timelineIssue };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.temporalConsistency).toBeLessThan(0.3);
      expect(result.sequenceErrors).toBeGreaterThan(0);
    });

    it('should validate proper sequence of events', async () => {
      const properSequence = `
        First, we plan the application requirements and architecture.
        Then, we write the code according to the specifications.
        After implementation, we test the application thoroughly.
        Finally, we deploy to production once all tests pass.
      `;

      mockContext.payload = { response: properSequence };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.confidence).toBeLessThan(0.3);
      expect(result.temporalConsistency).toBeGreaterThan(0.8);
    });
  });

  describe('Edge Cases and Complex Scenarios', () => {
    it('should handle ambiguous but coherent statements', async () => {
      const ambiguousText = `
        The system might work better if we consider alternative approaches.
        There are trade-offs between performance and maintainability.
        The best solution depends on the specific requirements and constraints.
      `;

      mockContext.payload = { response: ambiguousText };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.confidence).toBeLessThan(0.4);
      expect(result.ambiguityLevel).toBeGreaterThan(0.6);
      expect(result.coherenceScore).toBeGreaterThan(0.6);
    });

    it('should handle technical content with domain-specific logic', async () => {
      const technicalContent = `
        In a React functional component, state updates are asynchronous.
        Therefore, multiple setState calls may be batched together.
        To ensure we're working with the latest state, use the functional update pattern.
        This pattern takes the previous state as a parameter and returns the new state.
      `;

      mockContext.payload = { response: technicalContent };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.confidence).toBeLessThan(0.3);
      expect(result.technicalAccuracy).toBeGreaterThan(0.8);
      expect(result.logicalFlow).toBeGreaterThan(0.7);
    });

    it('should detect coherence issues in complex multi-part responses', async () => {
      const multiPartIncoherent = `
        Part 1: Database optimization requires careful indexing strategy.
        Indexes speed up read operations but slow down writes.

        Part 2: To optimize the database, remove all indexes.
        This will speed up all operations significantly.

        Part 3: The best practice is to add more indexes everywhere.
        More indexes always mean better performance.
      `;

      mockContext.payload = { response: multiPartIncoherent };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.6);
      expect(result.contradictions).toBeGreaterThan(1);
      expect(result.internalConsistency).toBeLessThan(0.4);
    });
  });

  describe('Performance and Context Integration', () => {
    it('should complete analysis within latency requirements', async () => {
      const complexText = Array.from({ length: 100 }, (_, i) =>
        `Statement ${i}: This is a complex statement that needs coherence analysis. `
      ).join('');

      mockContext.payload = { response: complexText };

      const startTime = performance.now();
      const result = await analyzer.analyze(mockContext);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(30);
      expect(result.analysisTimeMs).toBeLessThan(30);
    });

    it('should use trajectory for coherence context', async () => {
      mockContext.trajectory = [
        {
          type: 'thought',
          content: 'Need to maintain consistency with previous design decisions',
          timestamp: Date.now() - 2000
        },
        {
          type: 'action',
          content: 'Established RESTful API design pattern',
          timestamp: Date.now() - 1000
        }
      ];

      const coherentWithTrajectory = `
        Following the established RESTful pattern, we should use:
        GET /users for retrieving user list
        POST /users for creating new users
        PUT /users/:id for updating existing users
        This maintains consistency with our API design.
      `;

      mockContext.payload = { response: coherentWithTrajectory };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.trajectoryConsistency).toBeGreaterThan(0.8);
      expect(result.contextualFactors).toContain('DESIGN_CONSISTENCY');
    });

    it('should handle empty or minimal content', async () => {
      mockContext.payload = { response: '' };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.coherenceScore).toBe(1); // Empty content is technically coherent
    });
  });

  describe('Configuration and Thresholds', () => {
    it('should respect custom coherence thresholds', async () => {
      const strictAnalyzer = new CoherenceImmunityAnalyzer({
        coherenceThreshold: 0.9,
        contradictionThreshold: 0.1,
        strictLogicalValidation: true
      });

      const marginallyCoherent = `
        The solution is good because it works well.
        It works well in most cases we've tested.
        Testing shows it's usually effective.
      `;

      mockContext.payload = { response: marginallyCoherent };
      const result = await strictAnalyzer.analyze(mockContext);

      expect(result.coherenceScore).toBeLessThan(0.9);
      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('coherence threshold');
    });

    it('should handle different severity levels for coherence issues', async () => {
      const criticalIncoherence = `
        To secure the system: disable all security measures.
        To improve performance: use the slowest possible algorithm.
        To reduce costs: spend as much money as possible.
      `;

      mockContext.payload = { response: criticalIncoherence };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.severity).toBe('high');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.contradictions).toBeGreaterThan(2);
    });
  });
});