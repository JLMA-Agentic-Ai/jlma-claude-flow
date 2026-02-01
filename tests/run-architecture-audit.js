#!/usr/bin/env node

/**
 * AIS Architecture Integration Audit Executor
 *
 * Runs comprehensive production-like stress tests to validate
 * actual vs. apparent architectural improvements using Evidence Chains methodology.
 */

import AISArchitectureIntegrationAuditor from './ais-architecture-integration-audit.js';
import { performance } from 'perf_hooks';

async function runArchitectureAudit() {
  console.log('🚀 Starting AIS Architecture Integration Audit');
  console.log('📊 Testing actual hardening mechanisms under production-like stress\n');

  const auditor = new AISArchitectureIntegrationAuditor({
    stressTestDuration: 30000, // 30 seconds of stress testing
    memoryLeakThresholdMB: 100, // >100MB growth indicates leak
    concurrentOperations: 50, // High concurrency for real stress
    timeoutThreshold: 0.3, // 30% timeout rate threshold
    evidenceChainDepth: 5
  });

  // Set up event listeners for real-time monitoring
  auditor.on('auditComplete', (report) => {
    console.log('\n🎯 AUDIT COMPLETE - Final Report:');
    console.log('=' .repeat(80));

    console.log('\n📈 Executive Summary:');
    console.log(`Overall Effectiveness: ${report.executiveSummary.overallEffectiveness.score.toFixed(2)}/5.0 (${report.executiveSummary.overallEffectiveness.grade})`);
    console.log(`Test Coverage: ${report.executiveSummary.testCoverage.passRate} (${report.executiveSummary.testCoverage.passed}/${report.executiveSummary.testCoverage.total})`);
    console.log(`Critical Failures: ${report.executiveSummary.criticalFindings}`);
    console.log(`Duration: ${report.duration}`);

    console.log('\n🔍 Detailed Results:');

    // Resource Exhaustion Protection
    const resourceProtection = report.detailedResults.resourceExhaustionProtection;
    if (resourceProtection) {
      console.log(`\n1️⃣ Resource Exhaustion Protection: ${resourceProtection.evidenceStrength.toFixed(2)}/5.0`);
      if (resourceProtection.memoryLeakPrevention) {
        const memTest = resourceProtection.memoryLeakPrevention;
        console.log(`   🧠 Memory Leak Protection: ${memTest.passed ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`      Growth: ${memTest.memoryGrowthMB.toFixed(2)}MB (threshold: ${memTest.threshold}MB)`);
        console.log(`      Evidence: ${memTest.evidence.operations} operations, ${memTest.evidence.startMemory} → ${memTest.evidence.endMemory}`);
      }
      if (resourceProtection.cpuStarvationProtection) {
        const cpuTest = resourceProtection.cpuStarvationProtection;
        console.log(`   🔥 CPU Starvation Protection: ${cpuTest.passed ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`      Timeout Rate: ${(cpuTest.timeoutRate * 100).toFixed(1)}% (threshold: ${(cpuTest.threshold * 100).toFixed(1)}%)`);
        console.log(`      Evidence: ${cpuTest.evidence.totalOperations} operations, avg ${cpuTest.evidence.averageDuration}`);
      }
      if (resourceProtection.timeoutRateControl) {
        const timeoutTest = resourceProtection.timeoutRateControl;
        console.log(`   ⏱️ Timeout Rate Control: ${timeoutTest.passed ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`      Controlled Timeouts: ${timeoutTest.controlledTimeouts}/${timeoutTest.totalOperations}`);
        console.log(`      Evidence: ${timeoutTest.evidence.timeoutRate}, protection active: ${timeoutTest.evidence.protectionActive}`);
      }
    }

    // Concurrent Access Management
    const concurrentAccess = report.detailedResults.concurrentAccessManagement;
    if (concurrentAccess) {
      console.log(`\n2️⃣ Concurrent Access Management: ${concurrentAccess.evidenceStrength.toFixed(2)}/5.0`);
      if (concurrentAccess.raceConditionPrevention) {
        const raceTest = concurrentAccess.raceConditionPrevention;
        console.log(`   🏁 Race Condition Prevention: ${raceTest.passed ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`      Data Consistency: ${raceTest.consistency ? 'Maintained' : 'Violated'}`);
        console.log(`      Expected/Actual: ${raceTest.expectedValue}/${raceTest.actualValue}`);
        console.log(`      Evidence: ${raceTest.evidence.successful} successful operations`);
      }
      if (concurrentAccess.dataCorruptionProtection) {
        const corruptionTest = concurrentAccess.dataCorruptionProtection;
        console.log(`   🛡️ Data Corruption Protection: ${corruptionTest.passed ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`      Data Integrity: ${corruptionTest.dataIntegrity ? 'Preserved' : 'Compromised'}`);
        console.log(`      Evidence: ${corruptionTest.evidence.dataStoreEntries} entries, corruption: ${corruptionTest.evidence.corruptionDetected}`);
      }
    }

    // Boundary Condition Hardening
    const boundaryHardening = report.detailedResults.boundaryConditionHardening;
    if (boundaryHardening) {
      console.log(`\n3️⃣ Boundary Condition Hardening: ${boundaryHardening.evidenceStrength.toFixed(2)}/5.0`);
      if (boundaryHardening.integrationBoundaryProtection) {
        const boundaryTest = boundaryHardening.integrationBoundaryProtection;
        console.log(`   🚧 Integration Boundary Protection: ${boundaryTest.passed ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`      Blocked Operations: ${boundaryTest.blockedOperations}/${boundaryTest.totalOperations}`);
        console.log(`      Evidence: Protection active: ${boundaryTest.evidence.protectionActive}`);
      }
      if (boundaryHardening.circuitBreakerEffectiveness) {
        const circuitTest = boundaryHardening.circuitBreakerEffectiveness;
        console.log(`   ⚡ Circuit Breaker Effectiveness: ${circuitTest.passed ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`      Circuit Breaker Triggered: ${circuitTest.circuitBreakerTriggered ? 'Yes' : 'No'}`);
        console.log(`      Evidence: Protection active: ${circuitTest.evidence.protectionActive}`);
      }
    }

    // Silent Failure Detection
    const silentFailure = report.detailedResults.silentFailureDetection;
    if (silentFailure) {
      console.log(`\n4️⃣ Silent Failure Detection: ${silentFailure.evidenceStrength.toFixed(2)}/5.0`);
      if (silentFailure.silentFailureDetection) {
        const detectionTest = silentFailure.silentFailureDetection;
        console.log(`   👁️ Silent Failure Detection: ${detectionTest.passed ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`      Failures Detected: ${detectionTest.silentFailuresDetected}/${detectionTest.totalOperations}`);
        console.log(`      Evidence: Detection active: ${detectionTest.evidence.detectionActive}`);
      }
      if (silentFailure.monitoringEffectiveness) {
        const monitoringTest = silentFailure.monitoringEffectiveness;
        console.log(`   📊 Monitoring Effectiveness: ${monitoringTest.passed ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`      Events Recorded: ${monitoringTest.eventsRecorded}`);
        console.log(`      Evidence: Event types: [${monitoringTest.evidence.eventTypes.join(', ')}]`);
      }
    }

    console.log('\n💡 Recommendations:');
    if (report.recommendations && report.recommendations.length > 0) {
      report.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. [${rec.priority}] ${rec.category}: ${rec.recommendation}`);
      });
    } else {
      console.log('✅ No critical recommendations - architecture hardening is effective');
    }

    console.log('\n📋 Next Steps:');
    report.nextSteps.forEach((step, index) => {
      console.log(`${index + 1}. ${step}`);
    });

    console.log('\n🎯 Overall Recommendation:');
    console.log(`${report.executiveSummary.overallEffectiveness.recommendation}`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ AIS Architecture Integration Audit Complete');
  });

  auditor.on('auditFailed', (errorReport) => {
    console.error('\n❌ AUDIT FAILED');
    console.error('Error:', errorReport.error);
    console.error('Partial Results:', JSON.stringify(errorReport.partialResults, null, 2));
    process.exit(1);
  });

  try {
    const startTime = performance.now();

    // Execute the comprehensive audit
    const auditReport = await auditor.executeComprehensiveAudit();

    const totalDuration = performance.now() - startTime;

    console.log(`\n⚡ Audit completed in ${(totalDuration / 1000).toFixed(2)} seconds`);

    // Save detailed report to file
    const fs = await import('fs/promises');
    const reportPath = `/workspaces/jlmaworkspace/base_projects/jlma-claude-flow/tests/architecture-audit-report-${new Date().toISOString().split('T')[0]}.json`;

    await fs.writeFile(reportPath, JSON.stringify(auditReport, null, 2));
    console.log(`📄 Detailed report saved to: ${reportPath}`);

    // Exit with appropriate code
    const effectivenessScore = auditReport.executiveSummary.overallEffectiveness.score;
    if (effectivenessScore >= 3.5) {
      console.log('🎉 Architecture hardening is EFFECTIVE - Production ready');
      process.exit(0);
    } else if (effectivenessScore >= 2.5) {
      console.log('⚠️ Architecture hardening has CONCERNS - Review required');
      process.exit(1);
    } else {
      console.log('🚨 Architecture hardening is INADEQUATE - Critical issues found');
      process.exit(2);
    }

  } catch (error) {
    console.error('\n💥 Audit execution failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(3);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('\n💥 Uncaught exception during audit:', error.message);
  process.exit(4);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n💥 Unhandled rejection during audit:', reason);
  process.exit(5);
});

// Execute the audit
runArchitectureAudit();