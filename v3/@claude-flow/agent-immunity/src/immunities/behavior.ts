/**
 * Behavior Immunity - Goal drift and behavior deviation monitoring
 *
 * @module @claude-flow/agent-immunity/immunities/behavior
 */

import type { Immunity, ImmunityViolation } from '../immunity-service';

/**
 * Behavior Immunity
 *
 * Monitors agent behavior patterns and detects deviations from expected goals.
 * Uses behavioral analysis and pattern recognition to identify goal drift and
 * malicious behavior patterns.
 */
export class BehaviorImmunity implements Immunity {
  public readonly name = 'behavior';
  public readonly weight = 0.9; // Very high weight - behavior consistency is critical

  private baselineBehavior: BehaviorProfile | null = null;
  private behaviorHistory: BehaviorSnapshot[] = [];
  private suspiciousBehaviors = new Set<string>([
    'data_exfiltration',
    'privilege_escalation',
    'lateral_movement',
    'persistence_mechanism',
    'evasion_technique',
    'reconnaissance',
    'credential_harvesting'
  ]);

  private behaviorPatterns = {
    normal: [
      'code_generation', 'testing', 'documentation', 'analysis',
      'refactoring', 'optimization', 'debugging', 'collaboration'
    ],
    suspicious: [
      'system_modification', 'file_deletion', 'credential_access',
      'network_scanning', 'process_injection', 'registry_modification'
    ],
    malicious: [
      'backdoor_installation', 'data_destruction', 'ransomware_behavior',
      'botnet_communication', 'exploit_execution', 'rootkit_behavior'
    ]
  };

  /**
   * Analyze action for behavioral violations and goal drift
   */
  public async analyze(actionData: any): Promise<{
    score: number;
    violations: ImmunityViolation[];
  }> {
    try {
      const violations: ImmunityViolation[] = [];

      // Extract current behavior
      const currentBehavior = this.extractBehavior(actionData);

      if (!this.baselineBehavior) {
        // First analysis - establish baseline
        this.baselineBehavior = this.createBehaviorProfile(currentBehavior);
        this.behaviorHistory.push(currentBehavior);
        return { score: 1.0, violations: [] };
      }

      // Analyze behavior against baseline
      const deviationScore = await this.calculateBehaviorDeviation(this.baselineBehavior, currentBehavior);

      // Check for suspicious behavior patterns
      const suspiciousBehaviorScore = this.checkSuspiciousBehaviors(currentBehavior, violations);

      // Check for goal consistency
      const goalConsistencyScore = this.checkGoalConsistency(currentBehavior, violations);

      // Check for behavioral anomalies
      const anomalyScore = this.checkBehavioralAnomalies(currentBehavior, violations);

      // Check for attack patterns
      const attackPatternScore = this.checkAttackPatterns(currentBehavior, violations);

      // Store current behavior
      this.behaviorHistory.push(currentBehavior);
      this.maintainHistorySize();

      // Update baseline gradually (concept drift adaptation)
      this.updateBaselineBehavior(currentBehavior, deviationScore);

      // Overall score is minimum of all checks
      const overallScore = Math.min(
        1.0 - deviationScore,
        suspiciousBehaviorScore,
        goalConsistencyScore,
        anomalyScore,
        attackPatternScore
      );

      return { score: overallScore, violations };
    } catch (error) {
      console.warn('🎭 Behavior immunity check failed:', error);
      return { score: 1.0, violations: [] }; // Fail safe
    }
  }

  /**
   * Extract behavior from action data
   */
  private extractBehavior(actionData: any): BehaviorSnapshot {
    const behavior: BehaviorSnapshot = {
      timestamp: Date.now(),
      agentType: actionData.agent?.type || 'unknown',
      actions: this.extractActions(actionData),
      goals: this.extractGoals(actionData),
      resources: this.extractResourceUsage(actionData),
      interactions: this.extractInteractions(actionData),
      patterns: this.extractPatterns(actionData),
      riskLevel: 'low'
    };

    // Classify risk level
    behavior.riskLevel = this.classifyRiskLevel(behavior);

    return behavior;
  }

  /**
   * Extract actions from action data
   */
  private extractActions(actionData: any): string[] {
    const actions: string[] = [];

    // Extract from task description
    if (actionData.task?.description) {
      const description = actionData.task.description.toLowerCase();

      // Extract action verbs
      const actionPatterns = [
        /create\s+(\w+)/g,
        /delete\s+(\w+)/g,
        /modify\s+(\w+)/g,
        /access\s+(\w+)/g,
        /execute\s+(\w+)/g,
        /install\s+(\w+)/g,
        /connect\s+to\s+(\w+)/g,
        /download\s+(\w+)/g,
        /upload\s+(\w+)/g,
        /scan\s+(\w+)/g
      ];

      for (const pattern of actionPatterns) {
        const matches = description.match(pattern);
        if (matches) {
          actions.push(...matches);
        }
      }

      // Extract general action categories
      if (description.includes('code')) actions.push('code_generation');
      if (description.includes('test')) actions.push('testing');
      if (description.includes('analyze')) actions.push('analysis');
      if (description.includes('file')) actions.push('file_operation');
      if (description.includes('network')) actions.push('network_operation');
      if (description.includes('database')) actions.push('database_operation');
    }

    // Extract from agent type
    const agentType = actionData.agent?.type || '';
    if (agentType.includes('security')) actions.push('security_analysis');
    if (agentType.includes('coder')) actions.push('code_generation');
    if (agentType.includes('tester')) actions.push('testing');

    return actions;
  }

  /**
   * Extract goals from action data
   */
  private extractGoals(actionData: any): string[] {
    const goals: string[] = [];

    if (actionData.task?.description) {
      const description = actionData.task.description.toLowerCase();

      // Extract explicit goals
      const goalPatterns = [
        /goal[:\s]+([^.!?]+)/g,
        /objective[:\s]+([^.!?]+)/g,
        /purpose[:\s]+([^.!?]+)/g,
        /aim[:\s]+([^.!?]+)/g
      ];

      for (const pattern of goalPatterns) {
        const matches = description.match(pattern);
        if (matches) {
          goals.push(...matches.map(match => match.trim()));
        }
      }

      // Infer implicit goals
      if (description.includes('secure')) goals.push('security_improvement');
      if (description.includes('optimize')) goals.push('performance_optimization');
      if (description.includes('fix')) goals.push('bug_resolution');
      if (description.includes('implement')) goals.push('feature_implementation');
      if (description.includes('deploy')) goals.push('deployment');
    }

    return goals;
  }

  /**
   * Extract resource usage patterns
   */
  private extractResourceUsage(actionData: any): Record<string, number> {
    const resources: Record<string, number> = {
      memory: 0,
      cpu: 0,
      network: 0,
      disk: 0
    };

    // Estimate based on task complexity
    if (actionData.task?.description) {
      const description = actionData.task.description.toLowerCase();

      if (description.includes('large') || description.includes('bulk')) {
        resources.memory += 0.5;
        resources.cpu += 0.3;
      }

      if (description.includes('analyze') || description.includes('process')) {
        resources.cpu += 0.4;
      }

      if (description.includes('download') || description.includes('upload')) {
        resources.network += 0.6;
      }

      if (description.includes('write') || description.includes('create')) {
        resources.disk += 0.3;
      }
    }

    // Extract from metadata
    if (actionData.metadata?.resources) {
      Object.assign(resources, actionData.metadata.resources);
    }

    return resources;
  }

  /**
   * Extract interaction patterns
   */
  private extractInteractions(actionData: any): string[] {
    const interactions: string[] = [];

    if (actionData.task?.description) {
      const description = actionData.task.description.toLowerCase();

      if (description.includes('coordinate') || description.includes('collaborate')) {
        interactions.push('agent_coordination');
      }
      if (description.includes('api') || description.includes('service')) {
        interactions.push('external_api');
      }
      if (description.includes('database') || description.includes('storage')) {
        interactions.push('data_storage');
      }
      if (description.includes('user') || description.includes('human')) {
        interactions.push('human_interaction');
      }
    }

    // Extract from agent relationships
    if (actionData.metadata?.agents) {
      interactions.push('multi_agent');
    }

    return interactions;
  }

  /**
   * Extract behavioral patterns
   */
  private extractPatterns(actionData: any): string[] {
    const patterns: string[] = [];

    const combinedText = [
      actionData.task?.description,
      JSON.stringify(actionData.metadata || {}),
      JSON.stringify(actionData.agent || {})
    ].join(' ').toLowerCase();

    // Check for normal patterns
    for (const pattern of this.behaviorPatterns.normal) {
      if (combinedText.includes(pattern.replace('_', ' '))) {
        patterns.push(`normal:${pattern}`);
      }
    }

    // Check for suspicious patterns
    for (const pattern of this.behaviorPatterns.suspicious) {
      if (combinedText.includes(pattern.replace('_', ' '))) {
        patterns.push(`suspicious:${pattern}`);
      }
    }

    // Check for malicious patterns
    for (const pattern of this.behaviorPatterns.malicious) {
      if (combinedText.includes(pattern.replace('_', ' '))) {
        patterns.push(`malicious:${pattern}`);
      }
    }

    return patterns;
  }

  /**
   * Classify risk level based on behavior
   */
  private classifyRiskLevel(behavior: BehaviorSnapshot): 'low' | 'medium' | 'high' | 'critical' {
    let riskScore = 0;

    // Check for malicious patterns
    const maliciousCount = behavior.patterns.filter(p => p.startsWith('malicious:')).length;
    if (maliciousCount > 0) return 'critical';

    // Check for suspicious patterns
    const suspiciousCount = behavior.patterns.filter(p => p.startsWith('suspicious:')).length;
    if (suspiciousCount > 2) return 'high';
    if (suspiciousCount > 0) riskScore += 30;

    // Check resource usage
    const totalResources = Object.values(behavior.resources).reduce((sum, val) => sum + val, 0);
    if (totalResources > 2.0) riskScore += 20;
    if (totalResources > 1.0) riskScore += 10;

    // Check interaction patterns
    if (behavior.interactions.includes('external_api')) riskScore += 10;
    if (behavior.interactions.includes('data_storage')) riskScore += 5;

    // Check action types
    const riskyActions = ['delete', 'modify', 'access', 'execute'];
    const actionRisk = behavior.actions.filter(action =>
      riskyActions.some(risky => action.includes(risky))
    ).length;
    riskScore += actionRisk * 5;

    if (riskScore >= 50) return 'high';
    if (riskScore >= 25) return 'medium';
    return 'low';
  }

  /**
   * Create behavior profile from snapshot
   */
  private createBehaviorProfile(behavior: BehaviorSnapshot): BehaviorProfile {
    return {
      commonActions: [...behavior.actions],
      commonGoals: [...behavior.goals],
      averageResources: { ...behavior.resources },
      commonInteractions: [...behavior.interactions],
      commonPatterns: [...behavior.patterns],
      agentType: behavior.agentType,
      baselineRisk: behavior.riskLevel,
      createdAt: Date.now()
    };
  }

  /**
   * Calculate behavior deviation from baseline
   */
  private async calculateBehaviorDeviation(
    baseline: BehaviorProfile,
    current: BehaviorSnapshot
  ): Promise<number> {
    let totalDeviation = 0;
    let factors = 0;

    // Agent type consistency
    if (baseline.agentType !== current.agentType) {
      totalDeviation += 0.8; // High penalty for agent type change
    }
    factors++;

    // Action deviation
    const actionDeviation = this.calculateSetDeviation(baseline.commonActions, current.actions);
    totalDeviation += actionDeviation;
    factors++;

    // Goal deviation
    const goalDeviation = this.calculateSetDeviation(baseline.commonGoals, current.goals);
    totalDeviation += goalDeviation;
    factors++;

    // Resource deviation
    const resourceDeviation = this.calculateResourceDeviation(baseline.averageResources, current.resources);
    totalDeviation += resourceDeviation;
    factors++;

    // Pattern deviation
    const patternDeviation = this.calculateSetDeviation(baseline.commonPatterns, current.patterns);
    totalDeviation += patternDeviation;
    factors++;

    return totalDeviation / factors;
  }

  /**
   * Calculate deviation between two sets
   */
  private calculateSetDeviation(baseline: string[], current: string[]): number {
    if (baseline.length === 0 && current.length === 0) return 0;
    if (baseline.length === 0 || current.length === 0) return 1.0;

    const intersection = baseline.filter(item => current.includes(item));
    const union = new Set([...baseline, ...current]);

    return 1.0 - (intersection.length / union.size);
  }

  /**
   * Calculate resource usage deviation
   */
  private calculateResourceDeviation(
    baseline: Record<string, number>,
    current: Record<string, number>
  ): number {
    let totalDeviation = 0;
    const resources = Object.keys(baseline);

    for (const resource of resources) {
      const baselineValue = baseline[resource] || 0;
      const currentValue = current[resource] || 0;

      if (baselineValue === 0 && currentValue === 0) continue;
      if (baselineValue === 0) {
        totalDeviation += 1.0;
      } else {
        const deviation = Math.abs(currentValue - baselineValue) / Math.max(baselineValue, currentValue);
        totalDeviation += deviation;
      }
    }

    return resources.length > 0 ? totalDeviation / resources.length : 0;
  }

  /**
   * Check for suspicious behaviors
   */
  private checkSuspiciousBehaviors(
    behavior: BehaviorSnapshot,
    violations: ImmunityViolation[]
  ): number {
    let score = 1.0;

    // Check for known suspicious behaviors
    for (const suspiciousBehavior of this.suspiciousBehaviors) {
      if (behavior.patterns.some(pattern => pattern.includes(suspiciousBehavior))) {
        violations.push({
          type: 'suspicious_behavior',
          severity: 'high',
          score: 0.2,
          description: `Suspicious behavior pattern detected: ${suspiciousBehavior}`,
          details: {
            behavior: suspiciousBehavior,
            timestamp: behavior.timestamp,
            agentType: behavior.agentType
          }
        });
        score = 0.2;
        break;
      }
    }

    // Check risk level escalation
    if (this.baselineBehavior && behavior.riskLevel !== this.baselineBehavior.baselineRisk) {
      const riskLevels = ['low', 'medium', 'high', 'critical'];
      const baselineIndex = riskLevels.indexOf(this.baselineBehavior.baselineRisk);
      const currentIndex = riskLevels.indexOf(behavior.riskLevel);

      if (currentIndex > baselineIndex) {
        violations.push({
          type: 'risk_escalation',
          severity: behavior.riskLevel === 'critical' ? 'critical' : 'high',
          score: 1.0 - (currentIndex - baselineIndex) * 0.3,
          description: `Risk level escalation: ${this.baselineBehavior.baselineRisk} → ${behavior.riskLevel}`,
          details: {
            previousRisk: this.baselineBehavior.baselineRisk,
            currentRisk: behavior.riskLevel,
            escalationLevel: currentIndex - baselineIndex
          }
        });
        score = Math.min(score, 1.0 - (currentIndex - baselineIndex) * 0.3);
      }
    }

    return score;
  }

  /**
   * Check goal consistency
   */
  private checkGoalConsistency(
    behavior: BehaviorSnapshot,
    violations: ImmunityViolation[]
  ): number {
    if (!this.baselineBehavior) return 1.0;

    const goalConsistency = 1.0 - this.calculateSetDeviation(this.baselineBehavior.commonGoals, behavior.goals);

    if (goalConsistency < 0.5) {
      violations.push({
        type: 'goal_drift',
        severity: 'medium',
        score: goalConsistency,
        description: `Significant goal drift detected: ${(goalConsistency * 100).toFixed(1)}% consistency`,
        details: {
          baselineGoals: this.baselineBehavior.commonGoals,
          currentGoals: behavior.goals,
          consistency: goalConsistency
        }
      });
    }

    return Math.max(0.3, goalConsistency); // Minimum score of 0.3
  }

  /**
   * Check for behavioral anomalies
   */
  private checkBehavioralAnomalies(
    behavior: BehaviorSnapshot,
    violations: ImmunityViolation[]
  ): number {
    let score = 1.0;

    // Check for unusual resource usage
    const totalResources = Object.values(behavior.resources).reduce((sum, val) => sum + val, 0);
    if (totalResources > 3.0) {
      violations.push({
        type: 'resource_anomaly',
        severity: 'medium',
        score: Math.max(0.2, 1.0 - totalResources / 4.0),
        description: 'Anomalous resource usage detected',
        details: {
          totalResourceUsage: totalResources,
          resources: behavior.resources
        }
      });
      score = Math.min(score, Math.max(0.2, 1.0 - totalResources / 4.0));
    }

    // Check for unusual action count
    if (behavior.actions.length > 20) {
      violations.push({
        type: 'action_anomaly',
        severity: 'low',
        score: 0.7,
        description: 'Unusually high number of actions detected',
        details: {
          actionCount: behavior.actions.length,
          actions: behavior.actions.slice(0, 10) // First 10 for details
        }
      });
      score = Math.min(score, 0.8);
    }

    // Check for temporal anomalies
    if (this.behaviorHistory.length > 0) {
      const timeDiff = behavior.timestamp - this.behaviorHistory[this.behaviorHistory.length - 1].timestamp;
      if (timeDiff < 1000) { // Less than 1 second
        violations.push({
          type: 'temporal_anomaly',
          severity: 'medium',
          score: 0.6,
          description: 'Suspiciously rapid behavior changes detected',
          details: {
            timeDifference: timeDiff,
            previousTimestamp: this.behaviorHistory[this.behaviorHistory.length - 1].timestamp,
            currentTimestamp: behavior.timestamp
          }
        });
        score = Math.min(score, 0.6);
      }
    }

    return score;
  }

  /**
   * Check for attack patterns
   */
  private checkAttackPatterns(
    behavior: BehaviorSnapshot,
    violations: ImmunityViolation[]
  ): number {
    let score = 1.0;

    // Check for kill chain patterns
    const killChainPhases = {
      reconnaissance: ['scan', 'enumerate', 'discover'],
      weaponization: ['exploit', 'payload', 'malware'],
      delivery: ['phishing', 'watering_hole', 'drive_by'],
      exploitation: ['buffer_overflow', 'injection', 'privilege'],
      installation: ['backdoor', 'trojan', 'rootkit'],
      command_control: ['c2', 'beacon', 'communication'],
      actions_objectives: ['exfiltrate', 'destroy', 'ransom']
    };

    const detectedPhases: string[] = [];
    for (const [phase, keywords] of Object.entries(killChainPhases)) {
      const behaviorText = [
        ...behavior.actions,
        ...behavior.goals,
        ...behavior.patterns
      ].join(' ').toLowerCase();

      if (keywords.some(keyword => behaviorText.includes(keyword))) {
        detectedPhases.push(phase);
      }
    }

    if (detectedPhases.length >= 3) {
      violations.push({
        type: 'attack_chain_pattern',
        severity: 'critical',
        score: 0.0,
        description: `Attack chain pattern detected: ${detectedPhases.join(' → ')}`,
        details: {
          detectedPhases,
          phaseCount: detectedPhases.length,
          recommendation: 'Immediate isolation and analysis required'
        }
      });
      score = 0.0;
    } else if (detectedPhases.length >= 2) {
      violations.push({
        type: 'partial_attack_pattern',
        severity: 'high',
        score: 0.3,
        description: `Partial attack pattern detected: ${detectedPhases.join(', ')}`,
        details: {
          detectedPhases,
          phaseCount: detectedPhases.length
        }
      });
      score = 0.3;
    }

    return score;
  }

  /**
   * Update baseline behavior (concept drift adaptation)
   */
  private updateBaselineBehavior(current: BehaviorSnapshot, deviationScore: number): void {
    if (!this.baselineBehavior || deviationScore > 0.8) {
      return; // Don't update for high deviation
    }

    // Gradual adaptation (10% weight to new behavior)
    const adaptationRate = 0.1;

    // Update common actions
    for (const action of current.actions) {
      if (!this.baselineBehavior.commonActions.includes(action)) {
        if (Math.random() < adaptationRate) {
          this.baselineBehavior.commonActions.push(action);
        }
      }
    }

    // Update resource averages
    for (const [resource, value] of Object.entries(current.resources)) {
      const currentAvg = this.baselineBehavior.averageResources[resource] || 0;
      this.baselineBehavior.averageResources[resource] =
        currentAvg * (1 - adaptationRate) + value * adaptationRate;
    }

    // Limit baseline size to prevent memory growth
    if (this.baselineBehavior.commonActions.length > 50) {
      this.baselineBehavior.commonActions = this.baselineBehavior.commonActions.slice(0, 50);
    }
  }

  /**
   * Maintain behavior history size
   */
  private maintainHistorySize(): void {
    if (this.behaviorHistory.length > 100) {
      this.behaviorHistory = this.behaviorHistory.slice(-100);
    }
  }
}

/**
 * Behavior snapshot for analysis
 */
interface BehaviorSnapshot {
  timestamp: number;
  agentType: string;
  actions: string[];
  goals: string[];
  resources: Record<string, number>;
  interactions: string[];
  patterns: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Baseline behavior profile
 */
interface BehaviorProfile {
  commonActions: string[];
  commonGoals: string[];
  averageResources: Record<string, number>;
  commonInteractions: string[];
  commonPatterns: string[];
  agentType: string;
  baselineRisk: 'low' | 'medium' | 'high' | 'critical';
  createdAt: number;
}