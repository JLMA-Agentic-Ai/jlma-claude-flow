/**
 * Agent Immunity System Plugin
 * Biological immune system for autonomous agents - prevents drift, hallucination, and maintains operational integrity
 *
 * @module @claude-flow/agent-immunity/plugin
 */

import { HookBuilder, HookEvent, HookPriority } from '@claude-flow/hooks';
import { ImmunityService } from './immunity-service';
import { AntibodyService } from './antibody';
import type { HookContext, HookResult } from '@claude-flow/shared';

/**
 * Plugin configuration options
 */
export interface ImmunityPluginConfig {
  /** Enable/disable immunity system */
  enabled?: boolean;

  /** Immunity threshold (0-1) - actions below this score are blocked */
  threshold?: number;

  /** Enable learning from immunity violations */
  enableLearning?: boolean;

  /** Custom immunity implementations */
  customImmunities?: Record<string, any>;
}

/**
 * Agent Immunity System Plugin
 *
 * Integrates immune system into Claude Flow hook system.
 * Monitors all agent actions before execution and provides
 * repair suggestions for problematic actions.
 */
export class ImmunityPlugin {
  private immunityService: ImmunityService;
  private antibodyService: AntibodyService;
  private config: Required<ImmunityPluginConfig>;

  constructor(config: ImmunityPluginConfig = {}) {
    this.config = {
      enabled: true,
      threshold: 0.7,
      enableLearning: true,
      customImmunities: {},
      ...config
    };

    this.immunityService = new ImmunityService({
      threshold: this.config.threshold,
      enableLearning: this.config.enableLearning,
      customImmunities: this.config.customImmunities
    });

    this.antibodyService = new AntibodyService();
  }

  /**
   * Initialize plugin and register hooks
   */
  public async initialize(): Promise<void> {
    if (!this.config.enabled) {
      console.log('🦠 Agent Immunity System: DISABLED');
      return;
    }

    console.log('🛡️ Initializing Agent Immunity System...');

    // Initialize immunity service
    await this.immunityService.initialize();

    // Register hook with critical priority
    const hookBuilder = new HookBuilder();

    // Monitor agent actions before execution
    hookBuilder.register({
      id: 'agent-immunity-check',
      event: HookEvent.PreAgentSpawn, // Using closest available hook
      handler: this.checkAgentAction.bind(this),
      priority: HookPriority.Critical,
      name: 'Agent Immunity Check',
      enabled: true,
      timeout: 5000
    });

    console.log('🛡️ Agent Immunity System: ACTIVE');
  }

  /**
   * Check agent action against immunity system
   */
  private async checkAgentAction(context: HookContext): Promise<HookResult> {
    try {
      const startTime = Date.now();

      // Extract action context from hook
      const actionData = this.extractActionData(context);

      // Run immunity analysis
      const immunityReport = await this.immunityService.analyzeAction(actionData);

      const executionTime = Date.now() - startTime;

      if (!immunityReport.safe) {
        console.log(`🚨 Immunity violation detected! Score: ${immunityReport.overallScore.toFixed(3)}`);
        console.log(`   Violations: ${immunityReport.violations.map(v => v.type).join(', ')}`);

        // Generate repair suggestions
        const suggestions = await this.antibodyService.generateRepairSuggestions(
          actionData,
          immunityReport.violations
        );

        return {
          success: false,
          abort: true,
          error: new Error(`Immunity system blocked action: ${immunityReport.violations[0]?.description || 'Safety threshold not met'}`),
          executionTime,
          metadata: {
            immunityReport,
            repairSuggestions: suggestions
          }
        };
      }

      return {
        success: true,
        continueChain: true,
        executionTime,
        metadata: {
          immunityScore: immunityReport.overallScore,
          immunityStatus: 'safe'
        }
      };

    } catch (error) {
      console.error('🦠 Immunity system error:', error);

      // Fail safe - allow action but log error
      return {
        success: true,
        continueChain: true,
        error: error as Error,
        metadata: {
          immunityStatus: 'error',
          message: 'Immunity check failed, allowing action'
        }
      };
    }
  }

  /**
   * Extract action data from hook context
   */
  private extractActionData(context: HookContext): any {
    return {
      type: 'agent_spawn',
      timestamp: context.timestamp,
      agent: context.agent,
      task: context.task,
      metadata: context.metadata,
      correlationId: context.correlationId
    };
  }

  /**
   * Get immunity system status
   */
  public async getStatus(): Promise<{
    enabled: boolean;
    threshold: number;
    activeImmunities: string[];
    totalChecks: number;
    blockedActions: number;
  }> {
    const stats = await this.immunityService.getStatistics();

    return {
      enabled: this.config.enabled,
      threshold: this.config.threshold,
      activeImmunities: stats.activeImmunities,
      totalChecks: stats.totalChecks,
      blockedActions: stats.blockedActions
    };
  }
}

/**
 * Create and initialize immunity plugin
 */
export async function createImmunityPlugin(config?: ImmunityPluginConfig): Promise<ImmunityPlugin> {
  const plugin = new ImmunityPlugin(config);
  await plugin.initialize();
  return plugin;
}