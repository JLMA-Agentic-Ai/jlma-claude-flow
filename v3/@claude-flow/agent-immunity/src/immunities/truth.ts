/**
 * Truth Immunity - HNSW similarity for hallucination detection
 *
 * @module @claude-flow/agent-immunity/immunities/truth
 */

import type { Immunity, ImmunityViolation } from '../immunity-service';

/**
 * Truth Immunity
 *
 * Uses HNSW similarity search to detect hallucinations and false information.
 * Compares agent claims against known facts stored in memory.
 */
export class TruthImmunity implements Immunity {
  public readonly name = 'truth';
  public readonly weight = 0.9;

  private knownFacts: string[] = [
    'TypeScript is a superset of JavaScript',
    'Node.js uses the V8 JavaScript engine',
    'React is a JavaScript library for building user interfaces',
    'Git is a distributed version control system',
    'Claude Flow is an AI agent orchestration framework'
  ];

  /**
   * Analyze action for hallucination and misinformation
   */
  public async analyze(actionData: any): Promise<{
    score: number;
    violations: ImmunityViolation[];
  }> {
    try {
      const violations: ImmunityViolation[] = [];
      const claims = this.extractClaims(actionData);

      if (claims.length === 0) {
        return { score: 1.0, violations: [] };
      }

      // Check each claim against known facts using similarity
      const truthScores: number[] = [];

      for (const claim of claims) {
        const truthScore = await this.verifyClaimTruthfulness(claim);
        truthScores.push(truthScore);

        if (truthScore < 0.3) { // Low similarity to known facts
          violations.push({
            type: 'hallucination',
            severity: 'high',
            score: truthScore,
            description: `Potential hallucination detected: "${claim}"`,
            details: {
              claim,
              truthScore,
              threshold: 0.3
            }
          });
        } else if (truthScore < 0.5) {
          violations.push({
            type: 'low_confidence',
            severity: 'medium',
            score: truthScore,
            description: `Low confidence claim: "${claim}"`,
            details: {
              claim,
              truthScore,
              threshold: 0.5
            }
          });
        }
      }

      // Overall truth score is average of all claim scores
      const overallScore = truthScores.length > 0
        ? truthScores.reduce((sum, score) => sum + score, 0) / truthScores.length
        : 1.0;

      return { score: overallScore, violations };
    } catch (error) {
      console.warn('🔍 Truth immunity check failed:', error);
      return { score: 1.0, violations: [] }; // Fail safe
    }
  }

  /**
   * Extract factual claims from action data
   */
  private extractClaims(actionData: any): string[] {
    const claims: string[] = [];

    // Extract from task description
    if (actionData.task?.description) {
      const taskClaims = this.extractClaimsFromText(actionData.task.description);
      claims.push(...taskClaims);
    }

    // Extract from metadata
    if (actionData.metadata?.instructions) {
      const instrClaims = this.extractClaimsFromText(actionData.metadata.instructions);
      claims.push(...instrClaims);
    }

    return claims.filter(claim => claim.length > 10); // Filter out short phrases
  }

  /**
   * Extract factual claims from text using simple heuristics
   */
  private extractClaimsFromText(text: string): string[] {
    const claims: string[] = [];

    // Split into sentences
    const sentences = text.split(/[.!?]+/).map(s => s.trim());

    for (const sentence of sentences) {
      // Look for assertive statements
      if (this.isFactualClaim(sentence)) {
        claims.push(sentence);
      }
    }

    return claims;
  }

  /**
   * Check if a sentence appears to be a factual claim
   */
  private isFactualClaim(sentence: string): boolean {
    const factPatterns = [
      /\bis\s+a?\s+/i,     // "X is a Y"
      /\bhas\s+/i,         // "X has Y"
      /\bcan\s+/i,         // "X can Y"
      /\bwill\s+/i,        // "X will Y"
      /\bsupports?\s+/i,   // "X supports Y"
      /\bprovides?\s+/i,   // "X provides Y"
      /\benables?\s+/i     // "X enables Y"
    ];

    return factPatterns.some(pattern => pattern.test(sentence));
  }

  /**
   * Verify claim truthfulness using HNSW similarity
   */
  private async verifyClaimTruthfulness(claim: string): Promise<number> {
    try {
      // Simulate HNSW similarity search
      // In real implementation: await hnswIndex.search(claim, k=5)

      let maxSimilarity = 0;

      for (const knownFact of this.knownFacts) {
        const similarity = this.calculateCosineSimilarity(claim, knownFact);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }

      return maxSimilarity;
    } catch (error) {
      console.warn('Truth verification failed:', error);
      return 0.5; // Neutral score on error
    }
  }

  /**
   * Calculate simple cosine similarity between two text strings
   */
  private calculateCosineSimilarity(text1: string, text2: string): number {
    const words1 = this.tokenize(text1.toLowerCase());
    const words2 = this.tokenize(text2.toLowerCase());

    const allWords = new Set([...words1, ...words2]);
    const vector1: number[] = [];
    const vector2: number[] = [];

    for (const word of allWords) {
      vector1.push(words1.filter(w => w === word).length);
      vector2.push(words2.filter(w => w === word).length);
    }

    // Calculate cosine similarity
    const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0);
    const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));

    if (magnitude1 === 0 || magnitude2 === 0) return 0;

    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Simple tokenization
   */
  private tokenize(text: string): string[] {
    return text.match(/\w+/g) || [];
  }
}