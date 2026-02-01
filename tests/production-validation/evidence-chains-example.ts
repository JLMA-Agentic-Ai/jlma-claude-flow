/**
 * Evidence Chains Production Validation Example
 *
 * Demonstrates comprehensive production validation using Evidence Chains methodology
 * for a sample application deployment.
 */

import ProductionValidationOrchestrator, { ProductionValidationConfig } from './production-validation-orchestrator';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function runProductionValidationExample() {
  console.log('🚀 Evidence Chains Production Validation Example');
  console.log('===============================================\n');

  // Example configuration for a microservices application
  const config: ProductionValidationConfig = {
    projectRoot: '/workspaces/jlmaworkspace/base_projects/jlma-claude-flow',
    environment: 'production-like',

    // Real database configuration (staging database)
    database: {
      host: 'staging-db.example.com',
      port: 5432,
      database: 'myapp_staging',
      username: process.env.DB_USERNAME || 'app_user',
      password: process.env.DB_PASSWORD || 'secure_password',
      ssl: true,
      maxConnections: 50
    },

    // Real Redis cache configuration
    redis: {
      host: 'staging-redis.example.com',
      port: 6379,
      password: process.env.REDIS_PASSWORD || 'redis_password',
      db: 0
    },

    // Real external services for integration testing
    externalServices: [
      {
        name: 'payment-service',
        baseUrl: 'https://api.stripe.com/v1',
        apiKey: process.env.STRIPE_TEST_KEY,
        timeout: 5000,
        retries: 3
      },
      {
        name: 'email-service',
        baseUrl: 'https://api.sendgrid.com/v3',
        apiKey: process.env.SENDGRID_API_KEY,
        timeout: 10000,
        retries: 2
      },
      {
        name: 'auth-service',
        baseUrl: 'https://auth0.example.com',
        timeout: 3000,
        retries: 3
      },
      {
        name: 'analytics-service',
        baseUrl: 'https://api.mixpanel.com',
        apiKey: process.env.MIXPANEL_TOKEN,
        timeout: 5000,
        retries: 1
      }
    ],

    // Container topology for cross-container communication testing
    containerTopology: {
      containers: [
        {
          name: 'api-gateway',
          image: 'nginx:alpine',
          ports: [80, 443],
          environment: {
            UPSTREAM_SERVERS: 'user-service:8080,order-service:8080,payment-service:8080'
          },
          dependencies: ['user-service', 'order-service', 'payment-service']
        },
        {
          name: 'user-service',
          image: 'myapp/user-service:latest',
          ports: [8080],
          environment: {
            DB_HOST: 'postgres',
            REDIS_HOST: 'redis',
            AUTH_SERVICE_URL: 'http://auth-service:8080'
          },
          dependencies: ['postgres', 'redis', 'auth-service']
        },
        {
          name: 'order-service',
          image: 'myapp/order-service:latest',
          ports: [8080],
          environment: {
            DB_HOST: 'postgres',
            REDIS_HOST: 'redis',
            PAYMENT_SERVICE_URL: 'http://payment-service:8080'
          },
          dependencies: ['postgres', 'redis', 'payment-service']
        },
        {
          name: 'payment-service',
          image: 'myapp/payment-service:latest',
          ports: [8080],
          environment: {
            DB_HOST: 'postgres',
            STRIPE_API_URL: 'https://api.stripe.com/v1'
          },
          dependencies: ['postgres']
        },
        {
          name: 'auth-service',
          image: 'myapp/auth-service:latest',
          ports: [8080],
          environment: {
            DB_HOST: 'postgres',
            JWT_SECRET: 'production-secret'
          },
          dependencies: ['postgres']
        },
        {
          name: 'postgres',
          image: 'postgres:14',
          ports: [5432],
          environment: {
            POSTGRES_DB: 'myapp',
            POSTGRES_USER: 'app_user',
            POSTGRES_PASSWORD: 'secure_password'
          },
          dependencies: []
        },
        {
          name: 'redis',
          image: 'redis:7-alpine',
          ports: [6379],
          environment: {
            REDIS_PASSWORD: 'redis_password'
          },
          dependencies: []
        }
      ],

      networks: [
        {
          name: 'frontend-network',
          subnet: '172.20.0.0/16',
          containers: ['api-gateway', 'user-service', 'order-service', 'payment-service', 'auth-service']
        },
        {
          name: 'backend-network',
          subnet: '172.21.0.0/16',
          containers: ['user-service', 'order-service', 'payment-service', 'auth-service', 'postgres', 'redis']
        }
      ],

      loadBalancers: [
        {
          name: 'main-lb',
          algorithm: 'round-robin',
          backends: ['api-gateway'],
          healthCheck: true
        },
        {
          name: 'services-lb',
          algorithm: 'least-connections',
          backends: ['user-service', 'order-service', 'payment-service', 'auth-service'],
          healthCheck: true
        }
      ]
    },

    // Load testing configuration
    loadTesting: {
      concurrentUsers: 100,
      duration: 300000, // 5 minutes
      rampUpTime: 60000, // 1 minute
      targetRPS: 500
    },

    // Failure scenarios to test
    failureScenarios: [
      {
        type: 'network-partition',
        duration: 30000, // 30 seconds
        severity: 'partial',
        recoveryExpected: true
      },
      {
        type: 'process-crash',
        duration: 10000, // 10 seconds
        severity: 'complete',
        recoveryExpected: true
      },
      {
        type: 'disk-failure',
        duration: 60000, // 1 minute
        severity: 'partial',
        recoveryExpected: true
      },
      {
        type: 'memory-corruption',
        duration: 5000, // 5 seconds
        severity: 'complete',
        recoveryExpected: true
      }
    ],

    // Production readiness thresholds
    thresholds: {
      maxLatency: 500, // milliseconds
      maxPacketLoss: 0.01, // 1%
      maxJitter: 50, // milliseconds
      minProductionReadiness: 85, // percentage
      maxCriticalRisks: 0
    }
  };

  try {
    // Initialize the orchestrator
    const orchestrator = new ProductionValidationOrchestrator(config);

    // Execute comprehensive production validation
    console.log('📊 Executing Evidence Chains Production Validation...\n');
    const report = await orchestrator.executeProductionValidation();

    // Display summary results
    console.log('📋 PRODUCTION VALIDATION SUMMARY');
    console.log('================================');
    console.log(`🎯 Overall Score: ${report.overallScore.toFixed(1)}%`);
    console.log(`✅ Production Ready: ${report.readyForProduction ? 'YES' : 'NO'}`);
    console.log(`🚀 Deployment Approval: ${report.deploymentApproval.toUpperCase()}`);
    console.log(`⏱️ Execution Time: ${(report.duration / 1000).toFixed(1)}s`);
    console.log(`🌍 Environment: ${report.environment}\n`);

    // Display domain scores
    console.log('📊 DOMAIN SCORES');
    console.log('================');
    console.log(`🌐 Real-World Integration: ${report.domainResults.realWorldIntegration.score.toFixed(1)}%`);
    console.log(`📡 Cross-Container Communication: ${report.domainResults.crossContainerCommunication.score.toFixed(1)}%`);
    console.log(`💾 Data Persistence: ${report.domainResults.dataPersistence.score.toFixed(1)}%\n`);

    // Display evidence chains status
    console.log('🔍 EVIDENCE CHAINS STATUS');
    console.log('=========================');
    Object.entries(report.evidenceChains).forEach(([chainId, chain]) => {
      const status = chain.status === 'complete' ? '✅' : chain.status === 'failed' ? '❌' : '⚠️';
      console.log(`${status} ${chainId}: ${chain.score}% (${chain.evidence} evidence points)`);
    });
    console.log('');

    // Display compliance status
    console.log('📋 COMPLIANCE STATUS');
    console.log('====================');
    Object.entries(report.complianceStatus).forEach(([check, passed]) => {
      const status = passed ? '✅' : '❌';
      const description = check.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^\w/, c => c.toUpperCase());
      console.log(`${status} ${description}`);
    });
    console.log('');

    // Display critical risks (if any)
    if (report.criticalRisks.length > 0) {
      console.log('⚠️ CRITICAL RISKS');
      console.log('=================');
      report.criticalRisks.slice(0, 5).forEach((risk, i) => {
        console.log(`${i + 1}. [${risk.severity.toUpperCase()}] ${risk.description}`);
        console.log(`   Mitigation: ${risk.mitigation}`);
        console.log(`   Blocking: ${risk.blocking ? 'YES' : 'NO'}\n`);
      });
    }

    // Display blocking issues (if any)
    if (report.blockingIssues.length > 0) {
      console.log('🚫 BLOCKING ISSUES');
      console.log('==================');
      report.blockingIssues.forEach((issue, i) => {
        console.log(`${i + 1}. ${issue.description}`);
        console.log(`   Mitigation: ${issue.mitigation}\n`);
      });
    }

    // Display recommendations
    if (report.recommendations.length > 0) {
      console.log('💡 RECOMMENDATIONS');
      console.log('==================');
      report.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`);
      });
      console.log('');
    }

    // Display next steps
    console.log('🔄 NEXT STEPS');
    console.log('=============');
    report.nextSteps.forEach((step, i) => {
      console.log(`${i + 1}. ${step}`);
    });
    console.log('');

    // Save detailed report
    const reportPath = join(config.projectRoot, 'tests/production-validation', `production-validation-report-${Date.now()}.json`);
    await orchestrator.saveReport(report, reportPath);

    // Generate human-readable summary
    const summaryPath = join(config.projectRoot, 'tests/production-validation', 'production-validation-summary.md');
    generateMarkdownSummary(report, summaryPath);

    // Final verdict
    console.log('🎯 FINAL VERDICT');
    console.log('================');

    switch (report.deploymentApproval) {
      case 'approved':
        console.log('🟢 APPROVED: System is ready for production deployment');
        console.log('   No critical risks detected, all validation checks passed');
        break;
      case 'conditional':
        console.log('🟡 CONDITIONAL APPROVAL: System can be deployed with monitoring');
        console.log('   Minor issues detected but not blocking deployment');
        console.log('   Implement additional monitoring and be prepared for rollback');
        break;
      case 'rejected':
        console.log('🔴 REJECTED: System is NOT ready for production deployment');
        console.log('   Critical issues must be resolved before deployment');
        console.log('   Address all blocking issues and re-run validation');
        break;
    }

    return report;

  } catch (error) {
    console.error('❌ Production Validation Failed:', error);
    throw error;
  }
}

function generateMarkdownSummary(report: any, outputPath: string): void {
  const markdown = `# Production Validation Report

## Executive Summary

- **Overall Score**: ${report.overallScore.toFixed(1)}%
- **Production Ready**: ${report.readyForProduction ? 'YES' : 'NO'}
- **Deployment Approval**: ${report.deploymentApproval.toUpperCase()}
- **Execution Time**: ${(report.duration / 1000).toFixed(1)} seconds
- **Environment**: ${report.environment}
- **Timestamp**: ${report.timestamp}

## Domain Scores

| Domain | Score | Status |
|--------|-------|--------|
| Real-World Integration | ${report.domainResults.realWorldIntegration.score.toFixed(1)}% | ${report.domainResults.realWorldIntegration.score >= 85 ? '✅' : '❌'} |
| Cross-Container Communication | ${report.domainResults.crossContainerCommunication.score.toFixed(1)}% | ${report.domainResults.crossContainerCommunication.score >= 85 ? '✅' : '❌'} |
| Data Persistence | ${report.domainResults.dataPersistence.score.toFixed(1)}% | ${report.domainResults.dataPersistence.score >= 85 ? '✅' : '❌'} |

## Evidence Chains Status

| Chain | Status | Score | Evidence Points |
|-------|--------|-------|-----------------|
${Object.entries(report.evidenceChains).map(([id, chain]: [string, any]) =>
  `| ${id} | ${chain.status} | ${chain.score}% | ${chain.evidence} |`
).join('\n')}

## Compliance Checklist

${Object.entries(report.complianceStatus).map(([check, passed]: [string, any]) =>
  `- [${passed ? 'x' : ' '}] ${check.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^\w/, (c: string) => c.toUpperCase())}`
).join('\n')}

## Critical Risks

${report.criticalRisks.length === 0 ? 'No critical risks detected. ✅' :
  report.criticalRisks.map((risk: any, i: number) =>
    `### ${i + 1}. ${risk.description}

- **Severity**: ${risk.severity}
- **Blocking**: ${risk.blocking ? 'Yes' : 'No'}
- **Mitigation**: ${risk.mitigation}`
  ).join('\n\n')
}

## Recommendations

${report.recommendations.map((rec: string, i: number) => `${i + 1}. ${rec}`).join('\n')}

## Next Steps

${report.nextSteps.map((step: string, i: number) => `${i + 1}. ${step}`).join('\n')}

## Deployment Decision

${report.deploymentApproval === 'approved' ?
  '🟢 **APPROVED** - System is ready for production deployment' :
  report.deploymentApproval === 'conditional' ?
  '🟡 **CONDITIONAL** - System can be deployed with monitoring' :
  '🔴 **REJECTED** - System is not ready for production deployment'
}

---

*Report generated by AIS Production Validation Orchestrator using Evidence Chains methodology*
`;

  writeFileSync(outputPath, markdown);
  console.log(`📄 Markdown summary saved to: ${outputPath}`);
}

// Export for use in other modules
export { runProductionValidationExample, ProductionValidationOrchestrator };

// Run example if executed directly
if (require.main === module) {
  runProductionValidationExample()
    .then(() => {
      console.log('\n✅ Production validation example completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Production validation example failed:', error);
      process.exit(1);
    });
}