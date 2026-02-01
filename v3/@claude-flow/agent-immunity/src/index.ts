/**
 * @claude-flow/agent-immunity - Agent Immunity System
 *
 * Biological immune system for autonomous agents that prevents drift, hallucination,
 * and maintains operational integrity through multi-layered immunity checks.
 *
 * @module @claude-flow/agent-immunity
 */

export { ImmunityPlugin, createImmunityPlugin } from './plugin';
export { ImmunityService } from './immunity-service';
export { AntibodyService } from './antibody';

// Export immunity interfaces
export type {
  ImmunityPluginConfig,
  Immunity,
  ImmunityViolation,
  ImmunityReport
} from './immunity-service';

export type {
  RepairSuggestion,
  AntibodyReport
} from './antibody';

// Export specific immunity implementations
export { SecurityImmunity } from './immunities/security';
export { TruthImmunity } from './immunities/truth';
export { CoherenceImmunity } from './immunities/coherence';
export { PerformanceImmunity } from './immunities/performance';
export { DependenciesImmunity } from './immunities/dependencies';

/**
 * Package version
 */
export const version = '3.0.0-alpha.1';

/**
 * Package metadata
 */
export const metadata = {
  name: '@claude-flow/agent-immunity',
  version,
  description: 'Biological immune system for autonomous agents',
  author: 'Claude Flow Team',
  license: 'MIT'
};