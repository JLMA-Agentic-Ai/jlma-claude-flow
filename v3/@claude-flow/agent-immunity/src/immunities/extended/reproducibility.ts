/**
 * Reproducibility Immunity - Ensures deterministic and reproducible behavior
 *
 * @module @claude-flow/agent-immunity/immunities/extended/reproducibility
 */

import type { Immunity, ImmunityViolation } from '../../immunity-service';

/**
 * Reproducibility Immunity
 *
 * Detects non-deterministic behavior that could lead to inconsistent results.
 * Checks for random number generation, timestamps, and other sources of variance.
 */
export class ReproducibilityImmunity implements Immunity {
  public readonly name = 'reproducibility';
  public readonly weight = 0.015; // 1.5% - Testing/reliability in ADR-001 weight distribution

  private readonly nonDeterministicPatterns = [
    { pattern: /Math\.random\(\)/g, source: 'random_number_generation', severity: 'high' },
    { pattern: /Date\.now\(\)/g, source: 'timestamp_dependency', severity: 'medium' },
    { pattern: /new Date\(\)/g, source: 'date_instantiation', severity: 'medium' },
    { pattern: /setTimeout|setInterval/g, source: 'timer_dependency', severity: 'low' },
    { pattern: /crypto\.getRandomValues/g, source: 'crypto_random', severity: 'high' },
    { pattern: /Math\.floor\(Math\.random/g, source: 'random_integer', severity: 'high' },
    { pattern: /uuid\(\)|uuidv4\(\)/g, source: 'uuid_generation', severity: 'medium' },
    { pattern: /process\.hrtime/g, source: 'high_resolution_time', severity: 'low' },
    { pattern: /performance\.now\(\)/g, source: 'performance_timing', severity: 'low' }
  ];

  /**
   * Analyze action for reproducibility issues
   */
  public async analyze(actionData: any): Promise<{
    score: number;
    violations: ImmunityViolation[];
  }> {
    try {
      const violations: ImmunityViolation[] = [];
      let score = 1.0;

      const content = this.extractCodeContent(actionData);

      // Check for non-deterministic patterns
      const deterministicAnalysis = this.analyzeDeterministicBehavior(content);
      if (deterministicAnalysis.issues.length > 0) {
        const severity = this.calculateDeterministicSeverity(deterministicAnalysis.issues);
        const scoreReduction = deterministicAnalysis.issues.length * 0.15;
        score = Math.max(0.2, 1.0 - scoreReduction);

        violations.push({
          type: 'non_deterministic_behavior',
          severity,
          score: scoreReduction,
          description: `Non-deterministic patterns detected: ${deterministicAnalysis.issues.map(i => i.source).join(', ')}`,
          details: {
            issues: deterministicAnalysis.issues,
            suggestions: this.generateDeterministicSuggestions(deterministicAnalysis.issues),
            riskLevel: deterministicAnalysis.riskLevel
          }
        });
      }

      // Check for environment-dependent behavior
      const environmentIssues = this.analyzeEnvironmentDependency(content);
      if (environmentIssues.length > 0) {
        violations.push({
          type: 'environment_dependency',
          severity: 'medium',
          score: 0.2,
          description: `Environment-dependent behavior detected: ${environmentIssues.join(', ')}`,
          details: {
            dependencies: environmentIssues,
            portabilityRisk: environmentIssues.length > 2 ? 'high' : 'medium'
          }
        });
        score = Math.min(score, 0.8);
      }

      // Check for race conditions
      const raceConditions = this.analyzeRaceConditions(content);
      if (raceConditions.detected) {
        violations.push({
          type: 'race_condition_risk',
          severity: 'high',
          score: 0.4,
          description: `Potential race condition detected: ${raceConditions.type}`,
          details: {
            type: raceConditions.type,
            confidence: raceConditions.confidence,
            mitigation: raceConditions.mitigation
          }
        });
        score = Math.min(score, 0.6);
      }

      // Check for global state mutations
      const globalStateIssues = this.analyzeGlobalStateMutations(content);
      if (globalStateIssues.length > 0) {
        violations.push({
          type: 'global_state_mutation',
          severity: 'medium',
          score: 0.25,
          description: `Global state mutations detected: ${globalStateIssues.join(', ')}`,
          details: {
            mutations: globalStateIssues,
            isolationRecommendations: this.generateIsolationRecommendations(globalStateIssues)
          }
        });
        score = Math.min(score, 0.75);
      }

      // Check for uncontrolled side effects
      const sideEffects = this.analyzeSideEffects(content);
      if (sideEffects.length > 0) {
        violations.push({
          type: 'uncontrolled_side_effects',
          severity: 'low',
          score: 0.15,
          description: `Potential side effects: ${sideEffects.join(', ')}`,
          details: {
            effects: sideEffects,
            containmentSuggestions: this.generateContainmentSuggestions(sideEffects)
          }
        });
        score = Math.min(score, 0.85);
      }

      return { score: Math.max(0, score), violations };
    } catch (error) {
      console.warn('🛡️ Reproducibility immunity check failed:', error);
      return { score: 1.0, violations: [] }; // Fail safe
    }
  }

  private extractCodeContent(actionData: any): string {
    const content = [];

    if (actionData.task?.implementation) content.push(actionData.task.implementation);
    if (actionData.agent?.code) content.push(actionData.agent.code);
    if (actionData.files) {
      for (const file of Object.values(actionData.files as any[])) {
        if (typeof file === 'string') content.push(file);
      }
    }

    return content.join('\n');
  }

  private analyzeDeterministicBehavior(content: string): {
    issues: Array<{
      source: string;
      severity: string;
      pattern: string;
      line?: number;
    }>;
    riskLevel: 'low' | 'medium' | 'high';
  } {
    const issues = [];

    for (const { pattern, source, severity } of this.nonDeterministicPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        issues.push({
          source,
          severity,
          pattern: pattern.source,
          line: this.findLineNumber(content, pattern)
        });
      }
    }

    const riskLevel = this.calculateReproducibilityRisk(issues);

    return {
      issues,
      riskLevel
    };
  }

  private findLineNumber(content: string, pattern: RegExp): number {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        return i + 1;
      }
    }
    return -1;
  }

  private calculateReproducibilityRisk(issues: Array<{ severity: string }>): 'low' | 'medium' | 'high' {
    const highSeverityCount = issues.filter(i => i.severity === 'high').length;
    const mediumSeverityCount = issues.filter(i => i.severity === 'medium').length;

    if (highSeverityCount > 2) return 'high';
    if (highSeverityCount > 0 || mediumSeverityCount > 3) return 'medium';
    return 'low';
  }

  private calculateDeterministicSeverity(issues: Array<{ severity: string }>): 'low' | 'medium' | 'high' | 'critical' {
    const highCount = issues.filter(i => i.severity === 'high').length;

    if (highCount > 3) return 'critical';
    if (highCount > 1) return 'high';
    if (issues.length > 3) return 'medium';
    return 'low';
  }

  private generateDeterministicSuggestions(issues: Array<{ source: string }>): string[] {
    const suggestions = [];

    if (issues.some(i => i.source.includes('random'))) {
      suggestions.push('Use seeded random number generators or remove randomness');
    }
    if (issues.some(i => i.source.includes('timestamp') || i.source.includes('date'))) {
      suggestions.push('Pass timestamps as parameters or use fixed test values');
    }
    if (issues.some(i => i.source.includes('uuid'))) {
      suggestions.push('Use deterministic ID generation or pass IDs as parameters');
    }
    if (issues.some(i => i.source.includes('timer'))) {
      suggestions.push('Replace timers with explicit control flow or dependency injection');
    }

    return suggestions;
  }

  private analyzeEnvironmentDependency(content: string): string[] {
    const dependencies = [];

    // Check for environment variable usage
    if (/process\.env/g.test(content)) {
      dependencies.push('environment_variables');
    }

    // Check for file system dependencies
    if (/fs\.|readFile|writeFile|__dirname|__filename/g.test(content)) {
      dependencies.push('file_system');
    }

    // Check for network dependencies
    if (/fetch\(|axios\.|http\./g.test(content)) {
      dependencies.push('network_calls');
    }

    // Check for OS-specific code
    if (/process\.platform|os\.|platform\(\)/g.test(content)) {
      dependencies.push('operating_system');
    }

    // Check for external command execution
    if (/exec\(|spawn\(|child_process/g.test(content)) {
      dependencies.push('external_commands');
    }

    return dependencies;
  }

  private analyzeRaceConditions(content: string): {
    detected: boolean;
    type: string;
    confidence: number;
    mitigation: string;
  } {
    // Check for concurrent operations without proper synchronization
    const hasAsync = /async.*await|Promise\./g.test(content);
    const hasSharedState = /global|window\.|this\./g.test(content);
    const hasConcurrentAccess = /Promise\.all|Promise\.race/g.test(content);

    if (hasAsync && hasSharedState && hasConcurrentAccess) {
      return {
        detected: true,
        type: 'concurrent_shared_state_access',
        confidence: 0.8,
        mitigation: 'Use proper synchronization (locks, semaphores, or immutable data)'
      };
    }

    // Check for callback-based race conditions
    const hasCallbacks = /callback\(|\.then\(.*\.then\(/g.test(content);
    if (hasCallbacks && hasSharedState) {
      return {
        detected: true,
        type: 'callback_race_condition',
        confidence: 0.6,
        mitigation: 'Use async/await or proper callback sequencing'
      };
    }

    return {
      detected: false,
      type: '',
      confidence: 0,
      mitigation: ''
    };
  }

  private analyzeGlobalStateMutations(content: string): string[] {
    const mutations = [];

    // Check for global variable assignments
    if (/window\.[a-zA-Z_$][a-zA-Z0-9_$]*\s*=/g.test(content)) {
      mutations.push('window_object_mutation');
    }

    // Check for prototype modifications
    if (/\.prototype\.[a-zA-Z_$][a-zA-Z0-9_$]*\s*=/g.test(content)) {
      mutations.push('prototype_pollution');
    }

    // Check for global object modifications
    if (/global\.[a-zA-Z_$][a-zA-Z0-9_$]*\s*=/g.test(content)) {
      mutations.push('global_object_mutation');
    }

    // Check for module-level state mutations
    if (/let\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*=.*\n.*[a-zA-Z_$][a-zA-Z0-9_$]*\s*=/g.test(content)) {
      mutations.push('module_state_mutation');
    }

    return mutations;
  }

  private generateIsolationRecommendations(mutations: string[]): string[] {
    const recommendations = [];

    if (mutations.includes('window_object_mutation')) {
      recommendations.push('Avoid modifying window object; use module-scoped variables');
    }
    if (mutations.includes('prototype_pollution')) {
      recommendations.push('Avoid prototype modifications; use composition or factory patterns');
    }
    if (mutations.includes('global_object_mutation')) {
      recommendations.push('Use dependency injection instead of global object mutations');
    }
    if (mutations.includes('module_state_mutation')) {
      recommendations.push('Prefer functional programming or explicit state management');
    }

    return recommendations;
  }

  private analyzeSideEffects(content: string): string[] {
    const effects = [];

    // Check for console modifications
    if (/console\.(log|warn|error)\s*=/g.test(content)) {
      effects.push('console_modification');
    }

    // Check for DOM modifications (in non-UI contexts)
    if (/document\.|getElementById|querySelector/g.test(content) && !/ui|component|render/.test(content.toLowerCase())) {
      effects.push('unexpected_dom_modification');
    }

    // Check for localStorage/sessionStorage usage
    if (/localStorage\.|sessionStorage\./g.test(content)) {
      effects.push('storage_side_effects');
    }

    // Check for network side effects without error handling
    if (/fetch\(|axios\./g.test(content) && !/catch|try.*catch/g.test(content)) {
      effects.push('unhandled_network_effects');
    }

    return effects;
  }

  private generateContainmentSuggestions(effects: string[]): string[] {
    const suggestions = [];

    if (effects.includes('console_modification')) {
      suggestions.push('Avoid modifying console methods; use logging libraries');
    }
    if (effects.includes('unexpected_dom_modification')) {
      suggestions.push('Isolate DOM modifications to UI components');
    }
    if (effects.includes('storage_side_effects')) {
      suggestions.push('Abstract storage operations and make them testable');
    }
    if (effects.includes('unhandled_network_effects')) {
      suggestions.push('Add proper error handling for network operations');
    }

    return suggestions;
  }
}