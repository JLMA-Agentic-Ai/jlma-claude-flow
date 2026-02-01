/**
 * Core TypeScript Types for Agent Immunity System
 * Eliminates ALL `any` types and creates proper type safety
 *
 * @module @claude-flow/agent-immunity/types
 */

// Claude Flow Hook Types (proper imports from @claude-flow/hooks when available)
export interface HookContext {
  timestamp: number;
  correlationId: string;
  agent?: AgentInfo;
  task?: TaskInfo;
  metadata?: Record<string, unknown>;
  sessionId?: string;
  userId?: string;
}

export interface HookResult {
  success: boolean;
  continueChain?: boolean;
  abort?: boolean;
  error?: Error;
  executionTime?: number;
  metadata?: Record<string, unknown>;
}

// Agent Information Types
export interface AgentInfo {
  id: string;
  type: string;
  name?: string;
  config?: AgentConfig;
  status: 'idle' | 'running' | 'paused' | 'error';
  capabilities: string[];
  version?: string;
}

export interface AgentConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  retryAttempts?: number;
  customSettings?: Record<string, unknown>;
}

// Task Information Types
export interface TaskInfo {
  id: string;
  type: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  estimatedDuration?: number;
  dependencies?: string[];
}

// Code Content Types
export interface CodeContent {
  language: string;
  source: string;
  filePath?: string;
  lineNumbers?: { start: number; end: number };
  ast?: ASTNode;
  complexity?: ComplexityMetrics;
}

export interface ASTNode {
  type: string;
  value?: unknown;
  children?: ASTNode[];
  position?: { line: number; column: number };
}

export interface ComplexityMetrics {
  cyclomaticComplexity: number;
  linesOfCode: number;
  cognitiveComplexity: number;
  maintainabilityIndex: number;
}

// Action Data Types (replaces all `actionData: any`)
export interface ActionData {
  type: ActionType;
  timestamp: number;
  agent: AgentInfo;
  task: TaskInfo;
  content?: CodeContent;
  metadata: ActionMetadata;
  correlationId: string;
  sessionId?: string;
  input?: ActionInput;
  output?: ActionOutput;
}

export type ActionType =
  | 'agent_spawn'
  | 'code_generation'
  | 'file_edit'
  | 'command_execution'
  | 'api_call'
  | 'memory_access'
  | 'network_request'
  | 'data_processing'
  | 'security_scan'
  | 'dependency_check';

export interface ActionMetadata {
  source: string;
  intent: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  estimatedCost?: number;
  tokenUsage?: TokenUsage;
  performance?: PerformanceMetrics;
  security?: SecurityMetadata;
}

export interface ActionInput {
  prompt?: string;
  parameters?: Record<string, unknown>;
  files?: string[];
  commands?: string[];
  dependencies?: string[];
  environment?: Record<string, string>;
}

export interface ActionOutput {
  result?: unknown;
  files?: FileChange[];
  logs?: LogEntry[];
  metrics?: PerformanceMetrics;
  errors?: ErrorInfo[];
}

// Immunity Context Types
export interface ImmunityContext {
  trajectory: TrajectoryStep[];
  session: SessionInfo;
  memory: MemoryContext;
  environment: EnvironmentInfo;
  constraints: ConstraintSet;
}

export interface TrajectoryStep {
  stepId: string;
  timestamp: number;
  action: ActionData;
  result: ActionResult;
  immunityScore: number;
  violations: ImmunityViolation[];
}

export interface ActionResult {
  success: boolean;
  duration: number;
  output?: unknown;
  sideEffects: SideEffect[];
  qualityMetrics: QualityMetrics;
}

export interface SideEffect {
  type: 'file_change' | 'network_call' | 'memory_write' | 'process_spawn';
  target: string;
  description: string;
  reversible: boolean;
}

export interface SessionInfo {
  sessionId: string;
  userId?: string;
  startTime: number;
  totalActions: number;
  averageImmunityScore: number;
  riskProfile: RiskProfile;
}

export interface MemoryContext {
  recentPatterns: PatternMatch[];
  learnedBehaviors: BehaviorPattern[];
  knownVulnerabilities: VulnerabilityInfo[];
  trustScores: Record<string, number>;
}

export interface PatternMatch {
  pattern: string;
  confidence: number;
  lastSeen: number;
  frequency: number;
  context: string;
}

export interface BehaviorPattern {
  id: string;
  description: string;
  indicators: string[];
  riskLevel: 'low' | 'medium' | 'high';
  prevalence: number;
}

// Repair Suggestion Types (replaces RepairSuggestion with better typing)
export interface RepairSuggestion {
  id: string;
  type: RepairType;
  severity: SeverityLevel;
  description: string;
  explanation: string;
  code?: string;
  automated: boolean;
  estimatedEffort: EffortEstimate;
  riskAssessment: RiskAssessment;
  implementation?: ImplementationGuide;
}

export type RepairType = 'automated' | 'manual' | 'hybrid';

// Legacy repair action types for backward compatibility
export type LegacyRepairAction = 'replace' | 'modify' | 'remove' | 'add';

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';

export interface EffortEstimate {
  hours: number;
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex';
  requiredSkills: string[];
  dependencies: string[];
}

export interface RiskAssessment {
  breakingChange: boolean;
  dataLoss: boolean;
  securityImpact: SeverityLevel;
  performanceImpact: 'positive' | 'neutral' | 'negative';
}

export interface ImplementationGuide {
  steps: ImplementationStep[];
  prerequisites: string[];
  validation: ValidationCriteria;
  rollbackPlan?: string[];
}

export interface ImplementationStep {
  order: number;
  description: string;
  action: string;
  expectedOutcome: string;
  verification: string;
}

export interface ValidationCriteria {
  tests: string[];
  metrics: string[];
  acceptanceCriteria: string[];
}

// Error Types
export interface ImmunityError {
  code: string;
  message: string;
  context?: ActionData;
  suggestions?: RepairSuggestion[];
  stackTrace?: string;
  correlationId?: string;
  timestamp: number;
}

export type ImmunityErrorCode =
  | 'IMMUNITY_CHECK_FAILED'
  | 'VIOLATION_DETECTED'
  | 'REPAIR_FAILED'
  | 'THRESHOLD_EXCEEDED'
  | 'CONFIGURATION_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR';

// Supporting Types
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface PerformanceMetrics {
  executionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  networkLatency?: number;
  throughput?: number;
}

export interface SecurityMetadata {
  threatLevel: SeverityLevel;
  scanResults: SecurityScanResult[];
  compliance: ComplianceStatus[];
}

export interface SecurityScanResult {
  scanner: string;
  threatType: string;
  confidence: number;
  description: string;
  mitigation?: string;
}

export interface ComplianceStatus {
  framework: string;
  status: 'compliant' | 'non_compliant' | 'partial';
  gaps: string[];
}

export interface FileChange {
  path: string;
  operation: 'create' | 'update' | 'delete';
  sizeBefore?: number;
  sizeAfter?: number;
  checksum?: string;
}

export interface LogEntry {
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
}

export interface ErrorInfo {
  code: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
}

export interface EnvironmentInfo {
  nodeVersion: string;
  platform: string;
  architecture: string;
  availableMemory: number;
  cpuCores: number;
  diskSpace: number;
}

export interface ConstraintSet {
  maxTokens?: number;
  maxDuration?: number;
  allowedDomains?: string[];
  blockedPatterns?: string[];
  resourceLimits?: ResourceLimits;
}

export interface ResourceLimits {
  maxMemoryMB: number;
  maxCpuPercent: number;
  maxNetworkMbps: number;
  maxFileSize: number;
}

export interface RiskProfile {
  overallRisk: SeverityLevel;
  categories: Record<string, number>;
  trends: TrendAnalysis;
  recommendations: string[];
}

export interface TrendAnalysis {
  direction: 'improving' | 'stable' | 'degrading';
  confidence: number;
  factors: string[];
}

export interface VulnerabilityInfo {
  id: string;
  type: string;
  severity: SeverityLevel;
  description: string;
  affectedComponents: string[];
  mitigation?: string;
  discovered: number;
}

export interface QualityMetrics {
  readability: number;
  maintainability: number;
  testability: number;
  performance: number;
  security: number;
  overall: number;
}

// Immunity Violation (enhanced version)
export interface ImmunityViolation {
  id?: string;
  type: string;
  severity: SeverityLevel;
  score: number;
  description: string;
  details: ViolationDetails | Record<string, unknown>; // Support legacy format
  timestamp?: number;
  actionId?: string;
  immunityName?: string;
  context?: ViolationContext;
}

export interface ViolationDetails {
  category: string;
  subcategory?: string;
  indicators: string[];
  evidence: Evidence[];
  confidence: number;
  impact: ImpactAssessment;
}

export interface Evidence {
  type: 'pattern_match' | 'anomaly' | 'rule_violation' | 'heuristic';
  description: string;
  value: unknown;
  confidence: number;
}

export interface ImpactAssessment {
  scope: 'local' | 'session' | 'system' | 'global';
  domains: string[];
  estimatedDamage: SeverityLevel;
  cascadingEffects: string[];
}

export interface ViolationContext {
  relatedActions: string[];
  environmentState: Record<string, unknown>;
  userContext?: Record<string, unknown>;
  systemLoad?: number;
}

// Re-export Claude Flow integration types
export type {
  CFHookContext,
  CFHookResult,
  CFAgentInfo,
  CFTaskInfo
} from './claude-flow';

// Re-export immunity types
export type { Immunity } from './immunity';

// Legacy RepairSuggestion interface for backward compatibility
export interface LegacyRepairSuggestion {
  type: LegacyRepairAction;
  target: string;
  description: string;
  priority: SeverityLevel;
  automated: boolean;
  implementation?: string;
}