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
  Immunity,
  ImmunityViolation,
  ImmunityReport
} from './immunity-service';

export type {
  ImmunityPluginConfig
} from './plugin';

export type {
  RepairSuggestion,
  AntibodyReport
} from './antibody';

// Export core immunity implementations
export { SecurityImmunity } from './immunities/security';
export { TruthImmunity } from './immunities/truth';
export { CoherenceImmunity } from './immunities/coherence';
export { PerformanceImmunity } from './immunities/performance';
export { DependenciesImmunity } from './immunities/dependencies';

// Export truth immunity factory and utilities
export {
  createTruthImmunity,
  createTruthImmunityWithOpenAI,
  createTruthImmunityWithAnthropic,
  createTestTruthImmunity,
  benchmarkTruthImmunity
} from './immunities/truth-factory';
export type { TruthImmunityConfig } from './immunities/truth-factory';

// Export production immunity implementations (AIS Production Ready)
export { ContextImmunity } from './immunities/context';
export { ResourceImmunity } from './immunities/resource';
export { NetworkImmunity } from './immunities/network';
export { DataImmunity } from './immunities/data';
export { BehaviorImmunity } from './immunities/behavior';
export { ConsensusImmunity } from './immunities/consensus';

// Export extended immunity implementations (ADR-001)
export { PrivacyImmunity } from './immunities/extended/privacy';
export { CostImmunity } from './immunities/extended/cost';
export { ObservabilityImmunity } from './immunities/extended/observability';
export { AccessibilityImmunity } from './immunities/extended/accessibility';
export { ReproducibilityImmunity } from './immunities/extended/reproducibility';
export { DocumentationImmunity } from './immunities/extended/documentation';

// Export utilities
export { WeightValidator } from './utils/weight-validator';

// Export PHASE 1 security fixes (fail-closed patterns)
export {
  FailSafeManager,
  globalFailSafeManager,
  SecurityLevel,
  CircuitState
} from './security/fail-safe-manager';
export type {
  FailSafePolicy,
  SecurityAuditEvent
} from './security/fail-safe-manager';

export {
  AIDefenseIntegration,
  globalAIDefense
} from './security/aidefence-integration';
export type {
  AIDefenseResult,
  ThreatDetection,
  MitigationStrategy,
  LearningFeedback,
  AIDefenseStats
} from './security/aidefence-integration';

/**
 * Package version
 */
export const version = '3.0.0-alpha.2';

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