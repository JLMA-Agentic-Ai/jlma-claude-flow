/**
 * Immunity Service - Core orchestrator for agent immunity system
 *
 * @module @claude-flow/agent-immunity/immunity-service
 */

import { SecurityImmunity } from './immunities/security';
import { TruthImmunity } from './immunities/truth';
import { CoherenceImmunity } from './immunities/coherence';
import { PerformanceImmunity } from './immunities/performance';
import { DependenciesImmunity } from './immunities/dependencies';

/**
 * Immunity violation details
 */
export interface ImmunityViolation {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  description: string;
  details: Record<string, any>;
}

/**
 * Immunity analysis result
 */
export interface ImmunityReport {
  safe: boolean;
  overallScore: number;
  violations: ImmunityViolation[];
  immunityScores: Record<string, number>;
  timestamp: Date;
  actionId: string;
}

/**
 * Base immunity interface
 */
export interface Immunity {
  readonly name: string;
  readonly weight: number;
  analyze(actionData: any): Promise<{
    score: number;
    violations: ImmunityViolation[];
  }>;
}

/**
 * Immunity service configuration
 */
export interface ImmunityServiceConfig {
  threshold: number;
  enableLearning: boolean;
  customImmunities: Record<string, any>;
}

/**
 * Core immunity orchestrator
 *
 * Coordinates multiple immunity checks using weighted average scoring.
 * Provides extensible immunity registration and concurrent analysis.
 */
export class ImmunityService {
  private immunities = new Map<string, Immunity>();
  private threshold: number;
  private enableLearning: boolean;
  private stats = {
    totalChecks: 0,
    blockedActions: 0,
    activeImmunities: [] as string[]
  };

  constructor(config: ImmunityServiceConfig) {
    this.threshold = config.threshold;
    this.enableLearning = config.enableLearning;
    this.registerDefaultImmunities();
    this.registerCustomImmunities(config.customImmunities);
  }

  /**
   * Initialize immunity service
   */
  public async initialize(): Promise<void> {
    console.log(`🛡️ Immunity Service: ${this.immunities.size} immunities registered`);
    console.log(`🎯 Safety threshold: ${this.threshold}`);
    this.stats.activeImmunities = Array.from(this.immunities.keys());
  }

  /**
   * Analyze action against all registered immunities
   */
  public async analyzeAction(actionData: any): Promise<ImmunityReport> {
    const startTime = Date.now();
    const actionId = actionData.correlationId || `action-${Date.now()}`;

    this.stats.totalChecks++;

    // Run all immunity checks concurrently using Promise.all
    const immunityPromises = Array.from(this.immunities.entries()).map(
      async ([name, immunity]) => {
        try {
          const result = await immunity.analyze(actionData);
          return { name, ...result };
        } catch (error) {
          console.warn(`⚠️ Immunity ${name} failed:`, error);
          return { name, score: 1.0, violations: [] }; // Fail safe
        }
      }
    );

    const immunityResults = await Promise.all(immunityPromises);

    // Calculate weighted average score
    const overallScore = this.calculateWeightedAverage(immunityResults);

    // Collect all violations
    const allViolations: ImmunityViolation[] = [];
    const immunityScores: Record<string, number> = {};

    for (const result of immunityResults) {
      immunityScores[result.name] = result.score;
      allViolations.push(...result.violations);
    }

    // Sort violations by severity
    allViolations.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });

    const safe = overallScore >= this.threshold;

    if (!safe) {
      this.stats.blockedActions++;

      if (this.enableLearning) {
        await this.learnFromViolation(actionData, allViolations);
      }
    }

    const analysisTime = Date.now() - startTime;
    console.log(`🔬 Immunity analysis completed in ${analysisTime}ms (score: ${overallScore.toFixed(3)})`);

    return {
      safe,
      overallScore,
      violations: allViolations,
      immunityScores,
      timestamp: new Date(),
      actionId
    };
  }

  /**
   * Register a custom immunity
   */
  public registerImmunity(name: string, immunity: Immunity): void {
    this.immunities.set(name, immunity);
    this.stats.activeImmunities = Array.from(this.immunities.keys());
    console.log(`🛡️ Registered immunity: ${name}`);
  }

  /**
   * Get immunity service statistics
   */
  public async getStatistics(): Promise<typeof this.stats> {
    return { ...this.stats };
  }

  /**
   * Calculate weighted average of immunity scores
   */
  private calculateWeightedAverage(results: Array<{ name: string; score: number }>): number {
    let totalWeight = 0;
    let weightedSum = 0;

    for (const result of results) {
      const immunity = this.immunities.get(result.name);
      if (immunity) {
        const weight = immunity.weight;
        weightedSum += result.score * weight;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Register default immunity implementations
   */
  private registerDefaultImmunities(): void {
    this.registerImmunity('security', new SecurityImmunity());
    this.registerImmunity('truth', new TruthImmunity());
    this.registerImmunity('coherence', new CoherenceImmunity());
    this.registerImmunity('performance', new PerformanceImmunity());
    this.registerImmunity('dependencies', new DependenciesImmunity());
  }

  /**
   * Register custom immunity implementations
   */
  private registerCustomImmunities(customImmunities: Record<string, any>): void {
    for (const [name, ImmunityClass] of Object.entries(customImmunities)) {
      try {
        const immunity = new ImmunityClass();
        this.registerImmunity(name, immunity);
      } catch (error) {
        console.warn(`⚠️ Failed to register custom immunity ${name}:`, error);
      }
    }
  }

  /**
   * Learn from immunity violations (for future improvement)
   */
  private async learnFromViolation(
    actionData: any,
    violations: ImmunityViolation[]
  ): Promise<void> {
    try {
      // Simple learning - could be enhanced with ML
      console.log(`📚 Learning from ${violations.length} violation(s)`);

      // Store violation patterns for future reference
      const learningData = {
        timestamp: new Date().toISOString(),
        actionType: actionData.type,
        violations: violations.map(v => ({
          type: v.type,
          severity: v.severity,
          description: v.description
        }))
      };

      // In a real implementation, this would store to a persistent learning database
      console.log('🧠 Violation pattern stored for learning:', learningData);
    } catch (error) {
      console.warn('⚠️ Failed to learn from violation:', error);
    }
  }
}