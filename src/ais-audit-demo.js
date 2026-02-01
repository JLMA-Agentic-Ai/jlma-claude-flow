#!/usr/bin/env node

/**
 * AIS Audit Demo - GOAP Planning Coordinator
 * Demonstrates the complete GOAP-based AIS audit strategy execution
 */

import { GOAPAISAuditCoordinator } from './goap-ais-audit.js';
import { AISAuditExecutionEngine } from './ais-audit-execution.js';

class AISAuditDemo {
    constructor() {
        this.coordinator = new GOAPAISAuditCoordinator();
        this.executionEngine = new AISAuditExecutionEngine();
    }

    /**
     * Run complete AIS audit demonstration
     */
    async runDemo() {
        console.log('🎯 GOAP Planning Coordinator for AIS Audit Strategy');
        console.log('=' .repeat(60));

        try {
            // Phase 1: Strategy Generation
            console.log('\n📋 Phase 1: Generating GOAP-based Audit Strategy');
            const strategy = await this.coordinator.generateAuditStrategy();
            this.displayStrategy(strategy);

            // Phase 2: Execution Planning
            console.log('\n⚙️ Phase 2: Action Sequence Optimization');
            this.displayActionSequence(strategy.plan);

            // Phase 3: Risk Assessment
            console.log('\n⚠️ Phase 3: Risk Assessment and Mitigation');
            this.displayRiskAssessment(strategy);

            // Phase 4: Contingency Planning
            console.log('\n🛡️ Phase 4: Contingency and Adaptive Replanning');
            this.displayContingencyPlanning(strategy);

            // Phase 5: Evidence Collection Framework
            console.log('\n📊 Phase 5: Evidence Collection Framework');
            this.displayEvidenceFramework(strategy);

            // Phase 6: Simulation of Adaptive Replanning
            console.log('\n🔄 Phase 6: Adaptive Replanning Simulation');
            await this.simulateAdaptiveReplanning();

            console.log('\n✅ AIS Audit Strategy Demonstration Complete');
            console.log('🎯 GOAP Planning Coordinator successfully generated comprehensive audit approach');

        } catch (error) {
            console.error('❌ Demo failed:', error.message);
        }
    }

    /**
     * Display generated strategy details
     */
    displayStrategy(strategy) {
        console.log(`\n🎯 Strategy: ${strategy.strategy}`);
        console.log(`📊 Total Actions: ${strategy.plan.length}`);
        console.log(`⏱️ Estimated Duration: ${strategy.estimatedDuration} minutes`);
        console.log(`⚠️ Risk Level: ${strategy.riskAssessment}`);
        console.log(`📋 Evidence Types: ${strategy.evidenceTypes.length}`);
        console.log(`🛡️ Contingency Actions: ${strategy.contingencyActions.length}`);

        console.log('\n📝 Evidence Types Expected:');
        strategy.evidenceTypes.forEach((evidence, index) => {
            console.log(`  ${index + 1}. ${evidence}`);
        });
    }

    /**
     * Display optimized action sequence
     */
    displayActionSequence(plan) {
        console.log('\n🔗 Optimized Action Sequence:');

        plan.forEach((action, index) => {
            const riskIcon = this.getRiskIcon(action.riskLevel);
            const durationBar = '█'.repeat(Math.floor(action.duration / 10));

            console.log(`\n${index + 1}. ${action.name}`);
            console.log(`   ${riskIcon} Risk: ${action.riskLevel.toUpperCase()}`);
            console.log(`   ⏱️ Duration: ${action.duration}m ${durationBar}`);
            console.log(`   💰 Cost: ${action.cost}`);

            if (action.preconditions.size > 0) {
                console.log(`   📋 Requires: ${Array.from(action.preconditions.keys()).join(', ')}`);
            }

            if (action.effects.size > 0) {
                console.log(`   ✅ Produces: ${Array.from(action.effects.keys()).join(', ')}`);
            }

            if (action.evidence && action.evidence.length > 0) {
                console.log(`   📊 Evidence: ${action.evidence.join(', ')}`);
            }
        });
    }

    /**
     * Display risk assessment
     */
    displayRiskAssessment(strategy) {
        const riskBreakdown = this.analyzeRiskDistribution(strategy.plan);

        console.log('\n📊 Risk Distribution:');
        Object.entries(riskBreakdown).forEach(([level, count]) => {
            const icon = this.getRiskIcon(level);
            const percentage = ((count / strategy.plan.length) * 100).toFixed(1);
            console.log(`  ${icon} ${level.toUpperCase()}: ${count} actions (${percentage}%)`);
        });

        console.log('\n🛡️ Risk Mitigation Strategies:');
        this.getRiskMitigationStrategies(strategy.riskAssessment).forEach((mitigation, index) => {
            console.log(`  ${index + 1}. ${mitigation}`);
        });
    }

    /**
     * Display contingency planning
     */
    displayContingencyPlanning(strategy) {
        console.log('\n🚨 Contingency Actions:');

        strategy.contingencyActions.forEach((contingency, index) => {
            const priorityIcon = this.getPriorityIcon(contingency.priority);
            console.log(`\n${index + 1}. ${priorityIcon} ${contingency.trigger}`);
            console.log(`   ⚡ Action: ${contingency.action}`);
            console.log(`   🎯 Priority: ${contingency.priority}`);
        });

        console.log('\n🔄 Adaptive Replanning Triggers:');
        const replanningTriggers = [
            'Hidden integration discovery (deviation > 0.4)',
            'Security vulnerability detection (deviation > 0.5)',
            'Performance anomaly detection (deviation > 0.3)',
            'Data integrity issues (deviation > 0.6)',
            'Compliance violations (deviation > 0.4)'
        ];

        replanningTriggers.forEach((trigger, index) => {
            console.log(`  ${index + 1}. ${trigger}`);
        });
    }

    /**
     * Display evidence collection framework
     */
    displayEvidenceFramework(strategy) {
        console.log('\n📊 Evidence Collection Framework:');

        const evidenceCategories = this.categorizeEvidence(strategy.evidenceTypes);

        Object.entries(evidenceCategories).forEach(([category, items]) => {
            console.log(`\n📁 ${category.toUpperCase()}:`);
            items.forEach(item => {
                console.log(`  • ${item}`);
            });
        });

        console.log('\n🎯 Monitoring Points:');
        strategy.monitoringPoints.forEach((point, index) => {
            const riskIcon = this.getRiskIcon(point.riskLevel);
            console.log(`\n${index + 1}. Checkpoint ${point.checkpoint}: ${point.action}`);
            console.log(`   ${riskIcon} Risk: ${point.riskLevel}`);
            console.log(`   ⏱️ Expected Duration: ${point.expectedDuration}m`);
            console.log(`   📊 Evidence Expected: ${point.evidenceExpected.join(', ')}`);
        });
    }

    /**
     * Simulate adaptive replanning scenario
     */
    async simulateAdaptiveReplanning() {
        console.log('\n🎬 Simulating Adaptive Replanning Scenarios...');

        const scenarios = [
            {
                name: 'Hidden Integration Discovery',
                evidence: {
                    hiddenIntegrations: true,
                    reason: 'Discovered undocumented AI agent communication channels',
                    priority: 'critical'
                }
            },
            {
                name: 'Security Vulnerability Detection',
                evidence: {
                    securityVulnerabilities: true,
                    reason: 'Found privilege escalation in agent coordination layer',
                    priority: 'critical'
                }
            },
            {
                name: 'Performance Anomaly',
                evidence: {
                    performanceAnomalies: true,
                    reason: 'Agent memory usage exceeding expected thresholds',
                    priority: 'high'
                }
            }
        ];

        for (const scenario of scenarios) {
            console.log(`\n🎭 Scenario: ${scenario.name}`);

            const mockProgress = {
                currentStep: 3,
                completedActions: ['discover_ais_components', 'trace_execution_paths'],
                collectedEvidence: new Map()
            };

            const replanResult = await this.coordinator.adaptiveReplan(mockProgress, scenario.evidence);

            if (replanResult.replanned) {
                console.log(`  ✅ Replanning Triggered`);
                console.log(`  📝 Reason: ${replanResult.reason}`);
                console.log(`  🎯 Priority: ${replanResult.priority}`);
                console.log(`  🔧 New Actions: ${replanResult.newPlan ? replanResult.newPlan.length : 0}`);

                if (replanResult.newPlan) {
                    console.log(`  📋 Additional Actions:`);
                    replanResult.newPlan.slice(0, 3).forEach((action, index) => {
                        console.log(`     ${index + 1}. ${action.name} (${action.riskLevel})`);
                    });
                    if (replanResult.newPlan.length > 3) {
                        console.log(`     ... and ${replanResult.newPlan.length - 3} more`);
                    }
                }
            } else {
                console.log(`  ⏸️ No Replanning Required`);
            }
        }
    }

    /**
     * Analyze risk distribution in plan
     */
    analyzeRiskDistribution(plan) {
        const distribution = { low: 0, medium: 0, high: 0, critical: 0 };

        plan.forEach(action => {
            distribution[action.riskLevel]++;
        });

        return distribution;
    }

    /**
     * Get risk icon
     */
    getRiskIcon(riskLevel) {
        const icons = {
            low: '🟢',
            medium: '🟡',
            high: '🟠',
            critical: '🔴'
        };
        return icons[riskLevel] || '⚪';
    }

    /**
     * Get priority icon
     */
    getPriorityIcon(priority) {
        const icons = {
            low: '🔵',
            medium: '🟡',
            high: '🟠',
            critical: '🔴'
        };
        return icons[priority] || '⚪';
    }

    /**
     * Get risk mitigation strategies
     */
    getRiskMitigationStrategies(riskLevel) {
        const strategies = {
            critical: [
                'Implement continuous monitoring with immediate alerts',
                'Establish rollback procedures for all critical actions',
                'Deploy dedicated security agents for real-time protection',
                'Enable Byzantine fault tolerance for consensus mechanisms'
            ],
            high: [
                'Increase checkpoint frequency for early detection',
                'Implement circuit breakers for failure isolation',
                'Deploy redundant validation agents'
            ],
            medium: [
                'Standard monitoring with periodic validation',
                'Automated retry mechanisms with exponential backoff'
            ],
            low: [
                'Basic logging and monitoring',
                'Standard error handling procedures'
            ]
        };

        return strategies[riskLevel] || strategies.medium;
    }

    /**
     * Categorize evidence types
     */
    categorizeEvidence(evidenceTypes) {
        const categories = {
            discovery: [],
            architecture: [],
            security: [],
            performance: [],
            compliance: []
        };

        evidenceTypes.forEach(evidence => {
            if (evidence.includes('component') || evidence.includes('inventory')) {
                categories.discovery.push(evidence);
            } else if (evidence.includes('trace') || evidence.includes('flow') || evidence.includes('graph')) {
                categories.architecture.push(evidence);
            } else if (evidence.includes('security') || evidence.includes('vulnerability') || evidence.includes('audit')) {
                categories.security.push(evidence);
            } else if (evidence.includes('performance') || evidence.includes('metrics') || evidence.includes('bottleneck')) {
                categories.performance.push(evidence);
            } else if (evidence.includes('compliance') || evidence.includes('regulatory')) {
                categories.compliance.push(evidence);
            } else {
                categories.discovery.push(evidence);
            }
        });

        return categories;
    }
}

// Run demonstration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const demo = new AISAuditDemo();
    demo.runDemo().catch(console.error);
}

export { AISAuditDemo };