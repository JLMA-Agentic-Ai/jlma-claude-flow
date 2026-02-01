/**
 * Unit Tests for Truth Immunity Analyzer
 * Tests fact verification, misinformation detection, and accuracy validation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TruthImmunityAnalyzer } from '../../../src/immunity/analyzers/TruthImmunityAnalyzer';
import { ImmunityContext, ImmunityResult } from '../../../src/immunity/types';

describe('TruthImmunityAnalyzer', () => {
  let analyzer: TruthImmunityAnalyzer;
  let mockContext: ImmunityContext;

  beforeEach(() => {
    analyzer = new TruthImmunityAnalyzer();
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

  describe('Factual Claim Detection', () => {
    it('should detect factually incorrect statements', async () => {
      const falseStatement = `
        The Earth is flat and gravity is just a theory that has been debunked by modern science.
        Water boils at 50°C at sea level.
      `;

      mockContext.payload = { response: falseStatement };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.reason).toContain('factual inaccuracy');
      expect(result.falseClaimsDetected).toBeGreaterThan(0);
    });

    it('should verify scientific facts', async () => {
      const scientificClaim = `
        According to quantum mechanics, electrons exist in probability clouds rather than fixed orbits.
        The speed of light in vacuum is approximately 299,792,458 meters per second.
      `;

      mockContext.payload = { response: scientificClaim };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.confidence).toBeLessThan(0.3);
      expect(result.factualAccuracy).toBeGreaterThan(0.8);
    });

    it('should handle historical facts correctly', async () => {
      const historicalStatement = `
        World War II ended in 1945 when Japan surrendered after the atomic bombings.
        The Berlin Wall fell in 1989, leading to German reunification.
      `;

      mockContext.payload = { response: historicalStatement };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.factualAccuracy).toBeGreaterThan(0.9);
      expect(result.verifiedFacts).toBeGreaterThan(1);
    });
  });

  describe('Misinformation Pattern Recognition', () => {
    it('should detect conspiracy theory patterns', async () => {
      const conspiracyText = `
        The moon landing was clearly staged by NASA in a Hollywood studio.
        All the evidence proves it was fake, including the flag waving in space where there's no wind.
      `;

      mockContext.payload = { response: conspiracyText };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.misinformationPatterns).toContain('CONSPIRACY_THEORY');
      expect(result.reason).toContain('conspiracy theory');
    });

    it('should detect health misinformation', async () => {
      const healthMisinfo = `
        Vaccines contain microchips for government tracking.
        Essential oils can cure cancer better than chemotherapy.
        COVID-19 is just a common cold that was exaggerated.
      `;

      mockContext.payload = { response: healthMisinfo };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.85);
      expect(result.misinformationPatterns).toContain('MEDICAL_MISINFORMATION');
      expect(result.severity).toBe('high');
    });

    it('should allow balanced health information', async () => {
      const balancedHealth = `
        Vaccines have been proven effective in preventing various diseases, though like all medical interventions, they can have side effects.
        It's important to consult with healthcare professionals for medical advice.
      `;

      mockContext.payload = { response: balancedHealth };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.confidence).toBeLessThan(0.3);
      expect(result.factualAccuracy).toBeGreaterThan(0.7);
    });
  });

  describe('Source Verification', () => {
    it('should flag unsupported bold claims', async () => {
      const unsupportedClaim = `
        Scientists have discovered that drinking coffee backwards prevents aging.
        This revolutionary breakthrough will change medicine forever.
        Studies show 99.9% effectiveness in reversing cellular damage.
      `;

      mockContext.payload = { response: unsupportedClaim };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.issueTypes).toContain('UNSUPPORTED_CLAIM');
      expect(result.reason).toContain('unsupported');
    });

    it('should verify claims with proper attribution', async () => {
      const properlyAttributed = `
        According to a 2023 study published in Nature, researchers found evidence of water on Mars.
        The peer-reviewed research involved analyzing spectroscopic data from the Mars rover.
      `;

      mockContext.payload = { response: properlyAttributed };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.confidence).toBeLessThan(0.4);
      expect(result.sourcesVerified).toBeGreaterThan(0);
    });

    it('should detect fake news patterns', async () => {
      const fakeNews = `
        BREAKING: Government officials admit aliens have been living among us for decades!
        Shocking photos reveal secret alien bases in major cities.
        Click here to see what THEY don't want you to know!
      `;

      mockContext.payload = { response: fakeNews };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.misinformationPatterns).toContain('FAKE_NEWS_CLICKBAIT');
    });
  });

  describe('Statistical and Mathematical Claims', () => {
    it('should verify mathematical calculations', async () => {
      const mathClaim = `
        The probability of getting heads in a fair coin flip is 50%.
        The area of a circle with radius 5 units is 25π square units.
      `;

      mockContext.payload = { response: mathClaim };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.factualAccuracy).toBeGreaterThan(0.9);
      expect(result.mathematicalAccuracy).toBeGreaterThan(0.9);
    });

    it('should detect statistical manipulation', async () => {
      const manipulatedStats = `
        100% of people who drink water eventually die, proving water is deadly.
        Crime rates increased by 500% in areas with more streetlights, proving lights cause crime.
      `;

      mockContext.payload = { response: manipulatedStats };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.issueTypes).toContain('STATISTICAL_MANIPULATION');
    });

    it('should detect correlation vs causation errors', async () => {
      const correlationError = `
        Ice cream sales and drowning deaths both increase in summer,
        therefore ice cream consumption causes drowning deaths.
      `;

      mockContext.payload = { response: correlationError };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.6);
      expect(result.logicalFallacies).toContain('CORRELATION_CAUSATION');
    });
  });

  describe('Opinion vs Fact Distinction', () => {
    it('should allow clearly marked opinions', async () => {
      const opinion = `
        In my opinion, chocolate ice cream tastes better than vanilla.
        I believe that reading books is more enjoyable than watching TV.
        Personally, I prefer cats over dogs as pets.
      `;

      mockContext.payload = { response: opinion };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.confidence).toBeLessThan(0.2);
      expect(result.contentType).toBe('OPINION');
    });

    it('should flag opinions presented as facts', async () => {
      const misleadingOpinion = `
        Chocolate ice cream is scientifically proven to be superior to vanilla.
        Studies show that reading books is objectively better than watching TV.
        Cats are factually better pets than dogs in every measurable way.
      `;

      mockContext.payload = { response: misleadingOpinion };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.6);
      expect(result.issueTypes).toContain('OPINION_AS_FACT');
    });

    it('should handle subjective topics appropriately', async () => {
      const subjectiveTopic = `
        Art appreciation varies greatly among individuals.
        What constitutes beautiful music is largely subjective.
        Personal preferences for food are influenced by cultural background.
      `;

      mockContext.payload = { response: subjectiveTopic };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.confidence).toBeLessThan(0.3);
      expect(result.contentType).toBe('SUBJECTIVE');
    });
  });

  describe('Edge Cases and Complex Scenarios', () => {
    it('should handle hypothetical scenarios', async () => {
      const hypothetical = `
        If aliens were to visit Earth, they might be interested in our scientific achievements.
        In a hypothetical world where gravity worked differently, building design would be completely different.
      `;

      mockContext.payload = { response: hypothetical };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.confidence).toBeLessThan(0.3);
      expect(result.contentType).toBe('HYPOTHETICAL');
    });

    it('should handle uncertainty and caveats', async () => {
      const uncertainStatement = `
        While the evidence suggests that climate change is accelerating,
        scientists continue to study the exact mechanisms and timeline.
        More research is needed to fully understand all the implications.
      `;

      mockContext.payload = { response: uncertainStatement };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.confidence).toBeLessThan(0.4);
      expect(result.uncertaintyAcknowledged).toBe(true);
    });

    it('should handle mixed content with facts and opinions', async () => {
      const mixedContent = `
        The Earth orbits the Sun (fact), and I think sunsets are beautiful (opinion).
        Water freezes at 0°C (fact), though I prefer it cold rather than frozen (opinion).
      `;

      mockContext.payload = { response: mixedContent };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.factualAccuracy).toBeGreaterThan(0.8);
      expect(result.contentType).toBe('MIXED');
    });
  });

  describe('Performance and Context Integration', () => {
    it('should complete analysis within latency requirements', async () => {
      const longText = 'This is a factual statement about science. '.repeat(100);
      mockContext.payload = { response: longText };

      const startTime = performance.now();
      const result = await analyzer.analyze(mockContext);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(30);
      expect(result.analysisTimeMs).toBeLessThan(30);
    });

    it('should consider trajectory context for fact-checking', async () => {
      mockContext.trajectory = [
        {
          type: 'thought',
          content: 'User is asking about historical events, need to be accurate',
          timestamp: Date.now() - 1000
        }
      ];

      const historicalClaim = `
        Napoleon Bonaparte was Emperor of France from 1804 to 1814.
      `;

      mockContext.payload = { response: historicalClaim };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.contextualFactors).toContain('HISTORICAL_ACCURACY_INTENT');
      expect(result.factualAccuracy).toBeGreaterThan(0.9);
    });

    it('should handle empty or minimal content', async () => {
      mockContext.payload = { response: '' };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.contentType).toBe('EMPTY');
    });
  });

  describe('Configuration and Thresholds', () => {
    it('should respect custom confidence thresholds', async () => {
      const strictAnalyzer = new TruthImmunityAnalyzer({
        confidenceThreshold: 0.9,
        strictFactChecking: true
      });

      const borderlineClaim = `
        Some researchers suggest that moderate coffee consumption may have health benefits.
      `;

      mockContext.payload = { response: borderlineClaim };
      const result = await strictAnalyzer.analyze(mockContext);

      expect(result.confidence).toBeLessThan(0.9);
      expect(result.blocked).toBe(false);
    });

    it('should handle different severity levels for misinformation', async () => {
      const dangerousMisinfo = `
        Drinking bleach cures all diseases and the government is hiding this fact.
      `;

      mockContext.payload = { response: dangerousMisinfo };
      const result = await analyzer.analyze(mockContext);

      expect(result.blocked).toBe(true);
      expect(result.severity).toBe('critical');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.harmPotential).toBe('high');
    });
  });
});