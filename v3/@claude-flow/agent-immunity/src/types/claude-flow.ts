/**
 * Claude Flow Integration Types
 * Proper type definitions for @claude-flow/hooks and @claude-flow/shared integration
 *
 * @module @claude-flow/agent-immunity/types/claude-flow
 */

// Claude Flow Hook System Types
export interface CFHookContext {
  timestamp: number;
  correlationId: string;
  sessionId?: string;
  agent?: CFAgentInfo;
  task?: CFTaskInfo;
  metadata?: Record<string, unknown>;
  userId?: string;
  traceId?: string;
}

export interface CFHookResult {
  success: boolean;
  continueChain?: boolean;
  abort?: boolean;
  error?: Error;
  executionTime?: number;
  metadata?: Record<string, unknown>;
}

export interface CFAgentInfo {
  id: string;
  type: string;
  name?: string;
  config?: CFAgentConfig;
  status: 'idle' | 'running' | 'paused' | 'error';
  capabilities: string[];
  version?: string;
  model?: string;
  provider?: string;
}

export interface CFAgentConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  retryAttempts?: number;
  systemPrompt?: string;
  tools?: string[];
  customSettings?: Record<string, unknown>;
}

export interface CFTaskInfo {
  id: string;
  type: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  parentTaskId?: string;
  dependencies?: string[];
  estimatedDuration?: number;
  actualDuration?: number;
  assignedAgent?: string;
  progress?: number;
}

// Claude Flow Hook Events
export enum CFHookEvent {
  PreAgentSpawn = 'pre_agent_spawn',
  PostAgentSpawn = 'post_agent_spawn',
  PreTaskExecution = 'pre_task_execution',
  PostTaskExecution = 'post_task_execution',
  PreEdit = 'pre_edit',
  PostEdit = 'post_edit',
  PreCommand = 'pre_command',
  PostCommand = 'post_command',
  SessionStart = 'session_start',
  SessionEnd = 'session_end',
  Error = 'error',
  Warning = 'warning'
}

export enum CFHookPriority {
  Critical = 1000,
  High = 800,
  Medium = 500,
  Low = 200,
  Background = 100
}

export interface CFHookConfig {
  id: string;
  event: CFHookEvent;
  handler: CFHookHandler;
  priority: CFHookPriority;
  name: string;
  enabled: boolean;
  timeout?: number;
  conditions?: CFHookCondition[];
  metadata?: Record<string, unknown>;
}

export type CFHookHandler = (context: CFHookContext) => Promise<CFHookResult>;

export interface CFHookCondition {
  type: 'agent_type' | 'task_type' | 'metadata' | 'custom';
  operator: 'equals' | 'contains' | 'matches' | 'custom';
  value: string | RegExp | ((context: CFHookContext) => boolean);
}

// Claude Flow Memory Types
export interface CFMemoryContext {
  namespace: string;
  key: string;
  value: unknown;
  metadata?: CFMemoryMetadata;
  ttl?: number;
  version?: number;
}

export interface CFMemoryMetadata {
  createdAt: number;
  updatedAt: number;
  accessCount: number;
  lastAccessed: number;
  tags?: string[];
  size?: number;
  type?: string;
}

export interface CFMemoryQuery {
  namespace?: string;
  pattern?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'accessCount';
  order?: 'asc' | 'desc';
}

// Claude Flow Session Types
export interface CFSessionInfo {
  sessionId: string;
  userId?: string;
  startTime: number;
  endTime?: number;
  status: 'active' | 'paused' | 'ended';
  metadata?: Record<string, unknown>;
  agents: CFSessionAgent[];
  tasks: CFSessionTask[];
  metrics: CFSessionMetrics;
}

export interface CFSessionAgent {
  agentId: string;
  spawnTime: number;
  status: 'running' | 'idle' | 'terminated';
  tasksCompleted: number;
  avgTaskDuration: number;
}

export interface CFSessionTask {
  taskId: string;
  agentId: string;
  startTime: number;
  endTime?: number;
  status: string;
  result?: unknown;
}

export interface CFSessionMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  avgTaskDuration: number;
  totalTokensUsed: number;
  totalCost: number;
  immunityScore: number;
  securityEvents: number;
}

// Claude Flow Configuration Types
export interface CFConfig {
  providers: CFProviderConfig[];
  agents: CFAgentTypeConfig[];
  hooks: CFHookConfig[];
  memory: CFMemoryConfig;
  security: CFSecurityConfig;
  logging: CFLoggingConfig;
  performance: CFPerformanceConfig;
}

export interface CFProviderConfig {
  name: string;
  type: 'anthropic' | 'openai' | 'google' | 'custom';
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  rateLimit?: CFRateLimit;
  retryConfig?: CFRetryConfig;
}

export interface CFRateLimit {
  requestsPerMinute: number;
  tokensPerMinute: number;
  concurrentRequests: number;
}

export interface CFRetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBase: number;
}

export interface CFAgentTypeConfig {
  type: string;
  displayName: string;
  description: string;
  defaultConfig: CFAgentConfig;
  capabilities: string[];
  systemPrompt?: string;
  tools?: string[];
}

export interface CFMemoryConfig {
  backend: 'hybrid' | 'sqlite' | 'memory' | 'redis';
  path?: string;
  connectionString?: string;
  indexing: CFIndexingConfig;
  retention: CFRetentionConfig;
}

export interface CFIndexingConfig {
  enabled: boolean;
  algorithm: 'hnsw' | 'ivf' | 'flat';
  dimensions: number;
  similarity: 'cosine' | 'euclidean' | 'dot';
  buildParams?: Record<string, unknown>;
}

export interface CFRetentionConfig {
  defaultTtl: number;
  maxSize: number;
  cleanupInterval: number;
  policies: CFRetentionPolicy[];
}

export interface CFRetentionPolicy {
  pattern: string;
  ttl: number;
  priority: number;
}

export interface CFSecurityConfig {
  authentication: CFAuthConfig;
  authorization: CFAuthzConfig;
  encryption: CFEncryptionConfig;
  validation: CFValidationConfig;
}

export interface CFAuthConfig {
  enabled: boolean;
  type: 'jwt' | 'oauth' | 'api_key' | 'none';
  secret?: string;
  expiration?: number;
  issuer?: string;
}

export interface CFAuthzConfig {
  enabled: boolean;
  type: 'rbac' | 'abac' | 'claims';
  defaultPolicy: 'allow' | 'deny';
  policies: CFPolicy[];
}

export interface CFPolicy {
  id: string;
  effect: 'allow' | 'deny';
  subjects: string[];
  resources: string[];
  actions: string[];
  conditions?: Record<string, unknown>;
}

export interface CFEncryptionConfig {
  enabled: boolean;
  algorithm: 'aes-256-gcm' | 'chacha20-poly1305';
  keyDerivation: 'pbkdf2' | 'argon2';
  rotation: CFKeyRotationConfig;
}

export interface CFKeyRotationConfig {
  enabled: boolean;
  interval: number;
  retentionCount: number;
}

export interface CFValidationConfig {
  input: boolean;
  output: boolean;
  strict: boolean;
  schemas: CFSchemaConfig[];
}

export interface CFSchemaConfig {
  name: string;
  schema: unknown; // JSON Schema
  enforcement: 'strict' | 'warn' | 'log';
}

export interface CFLoggingConfig {
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  format: 'json' | 'text';
  outputs: CFLogOutput[];
  sampling: CFLogSampling;
}

export interface CFLogOutput {
  type: 'console' | 'file' | 'syslog' | 'custom';
  config: Record<string, unknown>;
}

export interface CFLogSampling {
  enabled: boolean;
  rate: number;
  conditions?: Record<string, unknown>;
}

export interface CFPerformanceConfig {
  monitoring: boolean;
  profiling: boolean;
  metrics: CFMetricsConfig;
  optimization: CFOptimizationConfig;
}

export interface CFMetricsConfig {
  enabled: boolean;
  interval: number;
  retention: number;
  exports: CFMetricsExport[];
}

export interface CFMetricsExport {
  type: 'prometheus' | 'statsd' | 'custom';
  config: Record<string, unknown>;
}

export interface CFOptimizationConfig {
  tokenOptimization: boolean;
  caching: CFCachingConfig;
  batching: CFBatchingConfig;
  routing: CFRoutingConfig;
}

export interface CFCachingConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  strategy: 'lru' | 'lfu' | 'fifo';
}

export interface CFBatchingConfig {
  enabled: boolean;
  maxSize: number;
  timeout: number;
  strategy: 'size' | 'time' | 'adaptive';
}

export interface CFRoutingConfig {
  enabled: boolean;
  strategy: 'round_robin' | 'least_connections' | 'weighted' | 'adaptive';
  healthCheck: boolean;
  fallback: string[];
}

// Error Types
export interface CFError extends Error {
  code: string;
  context?: Record<string, unknown>;
  correlationId?: string;
  timestamp: number;
  retryable: boolean;
}

export type CFErrorCode =
  | 'HOOK_FAILED'
  | 'AGENT_SPAWN_FAILED'
  | 'TASK_EXECUTION_FAILED'
  | 'MEMORY_ACCESS_FAILED'
  | 'CONFIGURATION_ERROR'
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_FAILED'
  | 'AUTHORIZATION_DENIED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'TIMEOUT_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

// Utility Types
export interface CFResult<T> {
  success: boolean;
  data?: T;
  error?: CFError;
  metadata?: Record<string, unknown>;
}

export interface CFPagination {
  page: number;
  size: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface CFPaginatedResult<T> extends CFResult<T[]> {
  pagination: CFPagination;
}

export type CFEventCallback<T = unknown> = (event: T) => void | Promise<void>;

export interface CFEventEmitter {
  on<T>(event: string, callback: CFEventCallback<T>): void;
  off<T>(event: string, callback: CFEventCallback<T>): void;
  emit<T>(event: string, data: T): void;
}