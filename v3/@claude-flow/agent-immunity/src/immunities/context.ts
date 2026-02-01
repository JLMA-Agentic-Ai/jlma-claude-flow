/**
 * Context Immunity - Agent drift prevention and context preservation
 *
 * @module @claude-flow/agent-immunity/immunities/context
 */

import type { Immunity, ImmunityViolation } from '../immunity-service';

/**
 * Context Immunity
 *
 * Prevents agent drift by monitoring context consistency and goal deviation.
 * Uses semantic analysis to detect when agents are deviating from their original context.
 */
export class ContextImmunity implements Immunity {
  public readonly name = 'context';
  public readonly weight = 0.95; // Very high weight - context drift is critical

  private baselineContext: ContextSnapshot | null = null;
  private contextHistory: ContextSnapshot[] = [];
  private driftThreshold = 0.25; // Allow 25% drift before violation

  /**
   * Analyze action for context drift and goal deviation
   */
  public async analyze(actionData: any): Promise<{
    score: number;
    violations: ImmunityViolation[];
  }> {
    try {
      const violations: ImmunityViolation[] = [];

      // Extract current context
      const currentContext = this.extractContext(actionData);

      if (!this.baselineContext) {
        // First analysis - establish baseline
        this.baselineContext = currentContext;
        this.contextHistory.push(currentContext);
        return { score: 1.0, violations: [] };
      }

      // Calculate context drift
      const driftScore = await this.calculateContextDrift(this.baselineContext, currentContext);
      const temporalDrift = this.calculateTemporalDrift();

      // Store current context
      this.contextHistory.push(currentContext);

      // Limit history size
      if (this.contextHistory.length > 10) {
        this.contextHistory.shift();
      }

      // Check for various types of context violations
      if (driftScore > this.driftThreshold) {
        violations.push({
          type: 'context_drift',
          severity: driftScore > 0.5 ? 'critical' : 'high',
          score: 1.0 - driftScore,
          description: `Significant context drift detected (${(driftScore * 100).toFixed(1)}% deviation from baseline)`,
          details: {
            driftScore,
            threshold: this.driftThreshold,
            baseline: this.baselineContext.summary,
            current: currentContext.summary,
            temporalDrift
          }
        });
      }

      // Check for goal inconsistency
      const goalConsistency = this.checkGoalConsistency(currentContext);
      if (goalConsistency < 0.7) {
        violations.push({
          type: 'goal_inconsistency',
          severity: 'medium',
          score: goalConsistency,
          description: `Goal inconsistency detected (${(goalConsistency * 100).toFixed(1)}% consistency)`,
          details: {
            goalConsistency,
            originalGoal: this.baselineContext.goals,
            currentGoal: currentContext.goals
          }
        });
      }

      // Check for excessive temporal drift
      if (temporalDrift > 0.4) {
        violations.push({
          type: 'temporal_drift',
          severity: 'medium',
          score: 1.0 - temporalDrift,
          description: `Temporal context drift detected (${(temporalDrift * 100).toFixed(1)}% drift over time)`,
          details: {
            temporalDrift,
            historyLength: this.contextHistory.length
          }
        });
      }

      // Overall score is inverse of maximum drift
      const overallScore = Math.max(0, 1.0 - Math.max(driftScore, temporalDrift));

      return { score: overallScore, violations };
    } catch (error) {
      console.warn('🧭 Context immunity check failed:', error);
      return { score: 1.0, violations: [] }; // Fail safe
    }
  }

  /**
   * Extract context snapshot from action data
   */
  private extractContext(actionData: any): ContextSnapshot {
    return {
      timestamp: Date.now(),
      agentType: actionData.agent?.type || 'unknown',
      task: actionData.task?.description || '',
      goals: this.extractGoals(actionData),
      constraints: this.extractConstraints(actionData),
      resources: this.extractResources(actionData),
      summary: this.generateContextSummary(actionData)
    };
  }

  /**
   * Extract goals from action data
   */
  private extractGoals(actionData: any): string[] {
    const goals: string[] = [];

    if (actionData.task?.description) {
      // Extract goal-oriented keywords
      const goalPatterns = [
        /create\s+(\w+)/gi,
        /implement\s+(\w+)/gi,
        /build\s+(\w+)/gi,
        /fix\s+(\w+)/gi,
        /optimize\s+(\w+)/gi,
        /deploy\s+(\w+)/gi,
        /test\s+(\w+)/gi
      ];

      for (const pattern of goalPatterns) {
        const matches = actionData.task.description.match(pattern);
        if (matches) {
          goals.push(...matches);
        }
      }
    }

    return goals;
  }

  /**
   * Extract constraints from action data
   */
  private extractConstraints(actionData: any): string[] {
    const constraints: string[] = [];

    if (actionData.metadata?.constraints) {
      constraints.push(...actionData.metadata.constraints);
    }

    // Extract implicit constraints from task description
    if (actionData.task?.description) {
      const constraintPatterns = [
        /must\s+(\w+)/gi,
        /cannot\s+(\w+)/gi,
        /should\s+not\s+(\w+)/gi,
        /require\s+(\w+)/gi,
        /within\s+(\d+)/gi
      ];

      for (const pattern of constraintPatterns) {
        const matches = actionData.task.description.match(pattern);
        if (matches) {
          constraints.push(...matches);
        }
      }
    }

    return constraints;
  }

  /**
   * Extract resource requirements from action data
   */
  private extractResources(actionData: any): string[] {
    const resources: string[] = [];

    if (actionData.metadata?.resources) {
      resources.push(...actionData.metadata.resources);
    }

    // Extract implicit resources
    if (actionData.agent?.config) {
      const config = JSON.stringify(actionData.agent.config);
      if (config.includes('memory')) resources.push('memory');
      if (config.includes('cpu')) resources.push('cpu');
      if (config.includes('network')) resources.push('network');
      if (config.includes('disk')) resources.push('disk');
    }

    return resources;
  }

  /**
   * Generate context summary for comparison
   */
  private generateContextSummary(actionData: any): string {
    const parts: string[] = [];

    if (actionData.agent?.type) parts.push(`agent:${actionData.agent.type}`);
    if (actionData.task?.description) {
      const taskWords = actionData.task.description.toLowerCase().match(/\w+/g) || [];
      const keyWords = taskWords.filter(word => word.length > 3).slice(0, 5);
      parts.push(`task:${keyWords.join(',')}`);
    }

    return parts.join('|');
  }

  /**
   * Calculate context drift between baseline and current context
   */
  private async calculateContextDrift(baseline: ContextSnapshot, current: ContextSnapshot): Promise<number> {
    let totalDrift = 0;
    let factors = 0;

    // Agent type consistency
    if (baseline.agentType !== current.agentType) {
      totalDrift += 0.8; // High penalty for agent type change
    }
    factors++;

    // Goal consistency
    const goalDrift = this.calculateGoalDrift(baseline.goals, current.goals);
    totalDrift += goalDrift;
    factors++;

    // Constraint consistency
    const constraintDrift = this.calculateConstraintDrift(baseline.constraints, current.constraints);
    totalDrift += constraintDrift;
    factors++;

    // Summary semantic similarity
    const summaryDrift = 1.0 - this.calculateStringSimilarity(baseline.summary, current.summary);
    totalDrift += summaryDrift;
    factors++;

    return totalDrift / factors;
  }

  /**
   * Calculate goal drift between two sets of goals
   */
  private calculateGoalDrift(baselineGoals: string[], currentGoals: string[]): number {
    if (baselineGoals.length === 0 && currentGoals.length === 0) return 0;
    if (baselineGoals.length === 0 || currentGoals.length === 0) return 1.0;

    const commonGoals = baselineGoals.filter(goal =>
      currentGoals.some(currentGoal =>
        this.calculateStringSimilarity(goal, currentGoal) > 0.7
      )
    );

    return 1.0 - (commonGoals.length / Math.max(baselineGoals.length, currentGoals.length));
  }

  /**
   * Calculate constraint drift between two sets of constraints
   */
  private calculateConstraintDrift(baselineConstraints: string[], currentConstraints: string[]): number {
    if (baselineConstraints.length === 0 && currentConstraints.length === 0) return 0;
    if (baselineConstraints.length === 0 || currentConstraints.length === 0) return 0.5; // Medium penalty

    const commonConstraints = baselineConstraints.filter(constraint =>
      currentConstraints.some(currentConstraint =>
        this.calculateStringSimilarity(constraint, currentConstraint) > 0.7
      )
    );

    return 1.0 - (commonConstraints.length / Math.max(baselineConstraints.length, currentConstraints.length));
  }

  /**
   * Calculate temporal drift across context history
   */
  private calculateTemporalDrift(): number {
    if (this.contextHistory.length < 3) return 0;

    let cumulativeDrift = 0;
    for (let i = 1; i < this.contextHistory.length; i++) {
      const prev = this.contextHistory[i - 1];
      const current = this.contextHistory[i];

      const stepDrift = 1.0 - this.calculateStringSimilarity(prev.summary, current.summary);
      cumulativeDrift += stepDrift;
    }

    return cumulativeDrift / (this.contextHistory.length - 1);
  }

  /**
   * Check goal consistency within current context
   */
  private checkGoalConsistency(context: ContextSnapshot): number {
    if (context.goals.length === 0) return 1.0;

    // Check for contradictory goals
    const contradictions = this.findGoalContradictions(context.goals);

    return Math.max(0, 1.0 - (contradictions.length * 0.3));
  }

  /**
   * Find contradictory goals
   */
  private findGoalContradictions(goals: string[]): string[] {
    const contradictions: string[] = [];
    const contradictoryPairs = [
      ['create', 'delete'],
      ['build', 'destroy'],
      ['optimize', 'degrade'],
      ['secure', 'expose'],
      ['enable', 'disable']
    ];

    for (const [positive, negative] of contradictoryPairs) {
      const hasPositive = goals.some(goal => goal.toLowerCase().includes(positive));
      const hasNegative = goals.some(goal => goal.toLowerCase().includes(negative));

      if (hasPositive && hasNegative) {
        contradictions.push(`${positive}/${negative}`);
      }
    }

    return contradictions;
  }

  /**
   * Calculate string similarity using simple algorithm
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const words1 = str1.toLowerCase().match(/\w+/g) || [];
    const words2 = str2.toLowerCase().match(/\w+/g) || [];

    if (words1.length === 0 && words2.length === 0) return 1.0;
    if (words1.length === 0 || words2.length === 0) return 0;

    const commonWords = words1.filter(word => words2.includes(word));
    return commonWords.length / Math.max(words1.length, words2.length);
  }
}

/**
 * Context snapshot for drift analysis
 */
interface ContextSnapshot {
  timestamp: number;
  agentType: string;
  task: string;
  goals: string[];
  constraints: string[];
  resources: string[];
  summary: string;
}