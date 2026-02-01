/**
 * Immunity-Specific Types
 * Enhanced type definitions for immunity implementations
 *
 * @module @claude-flow/agent-immunity/types/immunity
 */

import type {
  ActionData,
  ImmunityViolation,
  SeverityLevel,
  RepairSuggestion,
  PerformanceMetrics,
  SecurityMetadata
} from './index';

// Enhanced Immunity Interface (replaces base Immunity)
export interface Immunity {
  readonly name: string;
  readonly weight: number;
  readonly category: ImmunityCategory;
  readonly version: string;
  readonly description: string;

  analyze(actionData: ActionData): Promise<ImmunityAnalysisResult>;
  configure?(config: ImmunityConfig): void;
  getMetrics?(): Promise<ImmunityMetrics>;
}

export type ImmunityCategory = 'core' | 'extended' | 'custom';

export interface ImmunityAnalysisResult {
  score: number;
  violations: ImmunityViolation[];
  confidence: number;
  analysisTime: number;
  metadata?: ImmunityAnalysisMetadata;
}

export interface ImmunityAnalysisMetadata {
  patternsChecked: string[];
  rulesApplied: string[];
  dataQuality: number;
  memoryUsage: number;
  cacheHits: number;
}

export interface ImmunityConfig {
  enabled: boolean;
  threshold: number;
  sensitivity: 'low' | 'medium' | 'high';
  customRules?: CustomRule[];
  weights?: Record<string, number>;
  parameters?: Record<string, unknown>;
}

export interface CustomRule {
  id: string;
  name: string;
  pattern: string | RegExp;
  action: 'warn' | 'block' | 'log';
  severity: SeverityLevel;
  description: string;
}

export interface ImmunityMetrics {
  totalAnalyses: number;
  averageScore: number;
  violationCount: number;
  averageAnalysisTime: number;
  successRate: number;
  lastUpdated: number;
}

// Enhanced Immunity Report
export interface ImmunityReport {
  safe: boolean;
  overallScore: number;
  violations: ImmunityViolation[];
  immunityScores: Record<string, number>;
  timestamp: Date;
  actionId: string;
  analysisMetadata: ReportMetadata;
  recommendations: RecommendationSet;
}

export interface ReportMetadata {
  totalAnalysisTime: number;
  immunitiesRun: string[];
  immunitiesSkipped: string[];
  dataQuality: number;
  systemLoad: number;
}

export interface RecommendationSet {
  immediate: RepairSuggestion[];
  preventive: PreventiveRecommendation[];
  monitoring: MonitoringRecommendation[];
}

export interface PreventiveRecommendation {
  id: string;
  type: 'policy' | 'configuration' | 'training';
  description: string;
  priority: SeverityLevel;
  implementation: string[];
}

export interface MonitoringRecommendation {
  id: string;
  metric: string;
  threshold: number;
  alertCondition: string;
  description: string;
}

// Security Immunity Types
export interface SecurityAnalysisData {
  inputPatterns: string[];
  commandPatterns: string[];
  networkAccess: NetworkAccessInfo[];
  fileAccess: FileAccessInfo[];
  environmentAccess: EnvironmentAccessInfo[];
}

export interface NetworkAccessInfo {
  protocol: string;
  host: string;
  port?: number;
  endpoint?: string;
  headers?: Record<string, string>;
}

export interface FileAccessInfo {
  path: string;
  operation: 'read' | 'write' | 'execute' | 'delete';
  permissions?: string;
  size?: number;
}

export interface EnvironmentAccessInfo {
  variable: string;
  value?: string;
  operation: 'read' | 'write' | 'delete';
}

// Performance Immunity Types
export interface PerformanceAnalysisData {
  algorithmComplexity: ComplexityAnalysis;
  resourceUsage: ResourceUsageAnalysis;
  scalabilityFactors: ScalabilityFactor[];
  bottlenecks: PerformanceBottleneck[];
}

export interface ComplexityAnalysis {
  timeComplexity: string;
  spaceComplexity: string;
  cyclomaticComplexity: number;
  nesting: number;
}

export interface ResourceUsageAnalysis {
  estimatedMemory: number;
  estimatedCpu: number;
  estimatedNetwork: number;
  estimatedStorage: number;
}

export interface ScalabilityFactor {
  factor: string;
  impact: 'linear' | 'logarithmic' | 'polynomial' | 'exponential';
  description: string;
}

export interface PerformanceBottleneck {
  location: string;
  type: 'cpu' | 'memory' | 'io' | 'network';
  severity: SeverityLevel;
  description: string;
  suggestion: string;
}

// Truth/Hallucination Immunity Types
export interface TruthAnalysisData {
  factClaims: FactClaim[];
  sourceCredibility: SourceCredibility[];
  contradictions: Contradiction[];
  uncertainty: UncertaintyMetrics;
}

export interface FactClaim {
  claim: string;
  confidence: number;
  sources: string[];
  verifiable: boolean;
  category: 'factual' | 'opinion' | 'prediction' | 'assumption';
}

export interface SourceCredibility {
  source: string;
  type: 'documentation' | 'code' | 'memory' | 'external';
  reliability: number;
  lastUpdated?: number;
}

export interface Contradiction {
  claim1: string;
  claim2: string;
  severity: SeverityLevel;
  context: string;
}

export interface UncertaintyMetrics {
  overallConfidence: number;
  knownUnknowns: string[];
  uncertainAreas: string[];
  riskFactors: string[];
}

// Coherence Immunity Types
export interface CoherenceAnalysisData {
  intentAlignment: IntentAlignment;
  logicalConsistency: LogicalConsistency;
  contextualRelevance: ContextualRelevance;
  stylistic: StylisticCoherence;
}

export interface IntentAlignment {
  statedIntent: string;
  inferredIntent: string;
  alignmentScore: number;
  deviations: IntentDeviation[];
}

export interface IntentDeviation {
  type: 'scope' | 'method' | 'outcome' | 'priority';
  description: string;
  severity: SeverityLevel;
}

export interface LogicalConsistency {
  contradictions: string[];
  missingSteps: string[];
  invalidAssumptions: string[];
  logicScore: number;
}

export interface ContextualRelevance {
  contextMatch: number;
  irrelevantElements: string[];
  missingContext: string[];
  contextQuality: number;
}

export interface StylisticCoherence {
  consistency: number;
  appropriateness: number;
  clarity: number;
  issues: string[];
}

// Dependency Immunity Types
export interface DependencyAnalysisData {
  dependencies: DependencyInfo[];
  vulnerabilities: VulnerabilityReport[];
  licenses: LicenseInfo[];
  conflicts: DependencyConflict[];
}

export interface DependencyInfo {
  name: string;
  version: string;
  type: 'direct' | 'transitive';
  source: 'npm' | 'pip' | 'cargo' | 'other';
  size?: number;
  lastUpdated?: number;
}

export interface VulnerabilityReport {
  id: string;
  severity: SeverityLevel;
  package: string;
  version: string;
  description: string;
  fixedIn?: string;
  cveId?: string;
}

export interface LicenseInfo {
  package: string;
  license: string;
  compatible: boolean;
  restrictions: string[];
}

export interface DependencyConflict {
  package: string;
  versions: string[];
  type: 'version' | 'license' | 'dependency';
  description: string;
}

// Context Immunity Types
export interface ContextAnalysisData {
  sessionContext: SessionContextInfo;
  taskContext: TaskContextInfo;
  environmentContext: EnvironmentContextInfo;
  userContext?: UserContextInfo;
}

export interface SessionContextInfo {
  sessionId: string;
  duration: number;
  actionCount: number;
  previousActions: string[];
  patterns: string[];
}

export interface TaskContextInfo {
  currentTask: string;
  relatedTasks: string[];
  priority: SeverityLevel;
  deadline?: number;
  constraints: string[];
}

export interface EnvironmentContextInfo {
  system: string;
  resources: ResourceState;
  network: NetworkState;
  security: SecurityState;
}

export interface ResourceState {
  memory: ResourceMetric;
  cpu: ResourceMetric;
  disk: ResourceMetric;
  network: ResourceMetric;
}

export interface ResourceMetric {
  used: number;
  available: number;
  utilization: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface NetworkState {
  connected: boolean;
  latency: number;
  bandwidth: number;
  restrictions: string[];
}

export interface SecurityState {
  level: SeverityLevel;
  activeThreats: string[];
  protections: string[];
  lastScan: number;
}

export interface UserContextInfo {
  userId?: string;
  preferences?: Record<string, unknown>;
  permissions?: string[];
  history?: string[];
}

// Extended Immunity Types (ADR-001)
export interface PrivacyAnalysisData {
  piiDetection: PIIDetection[];
  dataFlow: DataFlowAnalysis;
  consent: ConsentAnalysis;
  retention: RetentionAnalysis;
}

export interface PIIDetection {
  type: 'email' | 'phone' | 'ssn' | 'credit_card' | 'address' | 'name' | 'other';
  value: string;
  confidence: number;
  location: string;
  masked?: string;
}

export interface DataFlowAnalysis {
  sources: string[];
  destinations: string[];
  processing: string[];
  encryption: boolean;
}

export interface ConsentAnalysis {
  required: boolean;
  obtained: boolean;
  scope: string[];
  expiry?: number;
}

export interface RetentionAnalysis {
  policy: string;
  duration: number;
  purgeRequired: boolean;
}

export interface CostAnalysisData {
  tokenUsage: TokenCostAnalysis;
  compute: ComputeCostAnalysis;
  storage: StorageCostAnalysis;
  network: NetworkCostAnalysis;
}

export interface TokenCostAnalysis {
  inputTokens: number;
  outputTokens: number;
  costPerToken: number;
  totalCost: number;
  budget?: number;
  efficiency: number;
}

export interface ComputeCostAnalysis {
  cpuTime: number;
  memoryHours: number;
  instances: number;
  costPerHour: number;
  totalCost: number;
}

export interface StorageCostAnalysis {
  bytesStored: number;
  operationsCount: number;
  costPerGB: number;
  costPerOperation: number;
  totalCost: number;
}

export interface NetworkCostAnalysis {
  bytesTransferred: number;
  requests: number;
  costPerGB: number;
  costPerRequest: number;
  totalCost: number;
}