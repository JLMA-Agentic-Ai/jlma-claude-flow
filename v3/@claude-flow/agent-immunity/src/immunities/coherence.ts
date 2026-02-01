/**
 * Coherence Immunity - SONA semantic diff: cosine(intent, code)
 *
 * @module @claude-flow/agent-immunity/immunities/coherence
 */

import type { Immunity, ImmunityViolation } from '../immunity-service';

/**
 * Coherence Immunity
 *
 * Uses SONA semantic analysis to ensure agent actions align with stated intent.
 * Calculates cosine similarity between intended purpose and actual implementation.
 */
export class CoherenceImmunity implements Immunity {
  public readonly name = 'coherence';
  public readonly weight = 0.8;

  private semanticModel = new SemanticAnalyzer();

  /**
   * Analyze action for coherence between intent and implementation
   */
  public async analyze(actionData: any): Promise<{
    score: number;
    violations: ImmunityViolation[];
  }> {
    try {
      const violations: ImmunityViolation[] = [];

      const intent = this.extractIntent(actionData);
      const implementation = this.extractImplementation(actionData);

      if (!intent || !implementation) {
        return { score: 1.0, violations: [] }; // No coherence check needed
      }

      // Calculate semantic similarity using SONA-inspired approach
      const coherenceScore = await this.calculateSemanticSimilarity(intent, implementation);

      console.log(`🔗 Coherence analysis: intent="${intent.substring(0, 50)}..." impl="${implementation.substring(0, 50)}..." score=${coherenceScore.toFixed(3)}`);

      // Check for coherence violations
      if (coherenceScore < 0.3) {
        violations.push({
          type: 'coherence_mismatch',
          severity: 'high',
          score: coherenceScore,
          description: `Significant mismatch between intent and implementation (${(coherenceScore * 100).toFixed(1)}% similarity)`,
          details: {
            intent: intent.substring(0, 200),
            implementation: implementation.substring(0, 200),
            coherenceScore,
            threshold: 0.3
          }
        });
      } else if (coherenceScore < 0.5) {
        violations.push({
          type: 'low_coherence',
          severity: 'medium',
          score: coherenceScore,
          description: `Moderate coherence issue between intent and implementation (${(coherenceScore * 100).toFixed(1)}% similarity)`,
          details: {
            intent: intent.substring(0, 100),
            implementation: implementation.substring(0, 100),
            coherenceScore,
            threshold: 0.5
          }
        });
      } else if (coherenceScore < 0.7) {
        violations.push({
          type: 'coherence_warning',
          severity: 'low',
          score: coherenceScore,
          description: `Minor coherence concern (${(coherenceScore * 100).toFixed(1)}% similarity)`,
          details: {
            coherenceScore,
            threshold: 0.7
          }
        });
      }

      return { score: coherenceScore, violations };
    } catch (error) {
      console.warn('🔗 Coherence immunity check failed:', error);
      return { score: 1.0, violations: [] }; // Fail safe
    }
  }

  /**
   * Extract intent from action data
   */
  private extractIntent(actionData: any): string | null {
    // Try multiple sources for intent
    const intentSources = [
      actionData.task?.description,
      actionData.metadata?.purpose,
      actionData.metadata?.goal,
      actionData.agent?.type
    ];

    for (const source of intentSources) {
      if (source && typeof source === 'string' && source.length > 5) {
        return source;
      }
    }

    return null;
  }

  /**
   * Extract implementation details from action data
   */
  private extractImplementation(actionData: any): string | null {
    // Try multiple sources for implementation
    const implSources = [
      actionData.metadata?.code,
      actionData.metadata?.implementation,
      actionData.metadata?.commands,
      actionData.agent?.config,
      JSON.stringify(actionData.metadata || {})
    ];

    for (const source of implSources) {
      if (source && typeof source === 'string' && source.length > 5) {
        return source;
      }
    }

    return null;
  }

  /**
   * Calculate semantic similarity using SONA-inspired approach
   */
  private async calculateSemanticSimilarity(intent: string, implementation: string): Promise<number> {
    try {
      // Extract semantic concepts from both intent and implementation
      const intentConcepts = await this.semanticModel.extractConcepts(intent);
      const implConcepts = await this.semanticModel.extractConcepts(implementation);

      // Calculate cosine similarity between concept vectors
      return this.calculateConceptSimilarity(intentConcepts, implConcepts);
    } catch (error) {
      console.warn('Semantic similarity calculation failed:', error);
      return 0.5; // Neutral score on error
    }
  }

  /**
   * Calculate similarity between concept vectors
   */
  private calculateConceptSimilarity(concepts1: ConceptVector, concepts2: ConceptVector): number {
    const allConcepts = new Set([...Object.keys(concepts1), ...Object.keys(concepts2)]);

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (const concept of allConcepts) {
      const weight1 = concepts1[concept] || 0;
      const weight2 = concepts2[concept] || 0;

      dotProduct += weight1 * weight2;
      magnitude1 += weight1 * weight1;
      magnitude2 += weight2 * weight2;
    }

    if (magnitude1 === 0 || magnitude2 === 0) return 0;

    return dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
  }
}

/**
 * Concept vector - maps concepts to weights
 */
type ConceptVector = Record<string, number>;

/**
 * Simple semantic analyzer
 * In production, this would use SONA or similar advanced semantic models
 */
class SemanticAnalyzer {
  private conceptDictionary: Record<string, string[]> = {
    'data': ['database', 'store', 'save', 'retrieve', 'query', 'fetch'],
    'security': ['auth', 'token', 'encrypt', 'secure', 'validate', 'permission'],
    'performance': ['fast', 'optimize', 'cache', 'speed', 'efficient', 'async'],
    'user_interface': ['ui', 'interface', 'display', 'render', 'view', 'component'],
    'api': ['endpoint', 'route', 'service', 'request', 'response', 'rest'],
    'test': ['test', 'spec', 'verify', 'check', 'assert', 'validate'],
    'configuration': ['config', 'setting', 'option', 'parameter', 'environment'],
    'file_operation': ['file', 'read', 'write', 'create', 'delete', 'modify'],
    'network': ['http', 'request', 'response', 'client', 'server', 'connection'],
    'error_handling': ['error', 'exception', 'try', 'catch', 'handle', 'throw']
  };

  /**
   * Extract semantic concepts from text
   */
  public async extractConcepts(text: string): Promise<ConceptVector> {
    const concepts: ConceptVector = {};
    const normalizedText = text.toLowerCase();

    // Count concept-related words
    for (const [concept, keywords] of Object.entries(this.conceptDictionary)) {
      let conceptScore = 0;

      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = normalizedText.match(regex);
        if (matches) {
          conceptScore += matches.length;
        }
      }

      if (conceptScore > 0) {
        concepts[concept] = conceptScore / keywords.length; // Normalize by keyword count
      }
    }

    // Add direct keyword matching
    const words = normalizedText.match(/\w+/g) || [];
    for (const word of words) {
      if (word.length > 3) { // Ignore short words
        concepts[`word_${word}`] = (concepts[`word_${word}`] || 0) + 0.1;
      }
    }

    return concepts;
  }
}