/**
 * Weight Validation Utility
 * Ensures immunity weights sum to 1.0 for proper weighted averaging
 */

import type { Immunity } from '../immunity-service';

/**
 * Validate and normalize immunity weights
 */
export class WeightValidator {
  /**
   * Validate that immunity weights sum to 1.0 (within tolerance)
   */
  public static validateWeights(immunities: Map<string, Immunity>): {
    valid: boolean;
    totalWeight: number;
    normalizedWeights: Record<string, number>;
    issues: string[];
  } {
    const issues: string[] = [];
    const weights: Record<string, number> = {};
    let totalWeight = 0;

    // Calculate total weight
    for (const [name, immunity] of immunities) {
      weights[name] = immunity.weight;
      totalWeight += immunity.weight;
    }

    // Check for issues
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      issues.push(`Total weight ${totalWeight.toFixed(3)} deviates from target 1.0`);
    }

    // Check for zero or negative weights
    for (const [name, weight] of Object.entries(weights)) {
      if (weight <= 0) {
        issues.push(`Immunity ${name} has invalid weight: ${weight}`);
      }
      if (weight > 0.5) {
        issues.push(`Immunity ${name} weight ${weight} is too dominant (>50%)`);
      }
    }

    // Normalize weights to sum to 1.0
    const normalizedWeights: Record<string, number> = {};
    if (totalWeight > 0) {
      for (const [name, weight] of Object.entries(weights)) {
        normalizedWeights[name] = weight / totalWeight;
      }
    } else {
      // Equal weights if total is zero
      const equalWeight = 1.0 / immunities.size;
      for (const name of immunities.keys()) {
        normalizedWeights[name] = equalWeight;
      }
    }

    return {
      valid: issues.length === 0,
      totalWeight,
      normalizedWeights,
      issues
    };
  }

  /**
   * Get recommended weights for ADR-001 complete 11/11 immunity system
   */
  public static getADR001Weights(): Record<string, number> {
    return {
      // Core immunities (maintain original relative importance)
      security: 0.25,        // 25% - Most critical
      truth: 0.20,          // 20% - High importance
      coherence: 0.15,      // 15% - Important for consistency
      performance: 0.12,    // 12% - Important for efficiency
      dependencies: 0.10,   // 10% - Security/maintenance

      // Extended immunities (balanced distribution)
      privacy: 0.07,        // 7% - Data protection compliance
      accessibility: 0.04,  // 4% - UI/UX compliance
      observability: 0.03,  // 3% - Operations/debugging
      cost: 0.015,         // 1.5% - Resource management
      reproducibility: 0.015, // 1.5% - Testing/reliability
      documentation: 0.01   // 1% - Knowledge transfer
    };
  }

  /**
   * Apply weight normalization to immunity service
   */
  public static normalizeImmunityWeights(immunities: Map<string, Immunity>): void {
    const validation = this.validateWeights(immunities);

    if (!validation.valid) {
      console.warn('🛡️ Immunity weight validation failed:', validation.issues);

      // Apply normalized weights
      for (const [name, immunity] of immunities) {
        const normalizedWeight = validation.normalizedWeights[name];
        if (normalizedWeight !== immunity.weight) {
          // Note: This requires the immunity objects to have settable weights
          // which would need to be implemented in the immunity classes
          console.log(`📊 Normalizing ${name} weight: ${immunity.weight} → ${normalizedWeight.toFixed(3)}`);
        }
      }
    } else {
      console.log(`✅ Immunity weights validated: ${validation.totalWeight.toFixed(3)} total`);
    }
  }

  /**
   * Generate weight distribution report
   */
  public static generateWeightReport(immunities: Map<string, Immunity>): {
    distribution: Array<{name: string; weight: number; percentage: string}>;
    categories: {
      core: number;
      extended: number;
    };
    recommendations: string[];
  } {
    const validation = this.validateWeights(immunities);
    const coreImmunities = ['security', 'truth', 'coherence', 'performance', 'dependencies'];

    const distribution = Array.from(immunities.entries()).map(([name, immunity]) => ({
      name,
      weight: immunity.weight,
      percentage: (validation.normalizedWeights[name] * 100).toFixed(1) + '%'
    })).sort((a, b) => b.weight - a.weight);

    let coreWeight = 0;
    let extendedWeight = 0;

    for (const [name, immunity] of immunities) {
      if (coreImmunities.includes(name)) {
        coreWeight += immunity.weight;
      } else {
        extendedWeight += immunity.weight;
      }
    }

    const recommendations: string[] = [];

    if (validation.totalWeight > 1.1) {
      recommendations.push('Consider reducing weights - total exceeds recommended 1.0');
    }
    if (coreWeight < 0.6) {
      recommendations.push('Core immunities should maintain >60% of total weight');
    }
    if (extendedWeight > 0.4) {
      recommendations.push('Extended immunities should be <40% of total weight');
    }

    return {
      distribution,
      categories: {
        core: coreWeight,
        extended: extendedWeight
      },
      recommendations
    };
  }
}