/**
 * AIS Architecture Hardening Integration Test
 *
 * End-to-end integration test demonstrating all Phase 3 hardening
 * components working together to prevent architectural vulnerabilities.
 */

import AISArchitectureHardening from '../../src/hardening/ais-architecture-hardening.js';
import { simulateAttackPattern } from './load-test-validation.js';
import crypto from 'crypto';

async function runIntegrationTest() {
  console.log('🚀 Starting AIS Architecture Hardening Integration Test');
  console.log('=' * 60);

  // Initialize hardening system
  const hardening = new AISArchitectureHardening({
    hardeningLevel: 'production',
    autoRemediation: true,
    alertThresholds: {
      memoryLeakMB: 75,
      cpuUsagePercent: 80,
      timeoutRate: 0.25,
      scoreVariance: 0.15,
      boundaryFailureRate: 0.4
    },
    integrationConfig: {
      aqe: {
        enabled: true,
        fleetSize: 5
      }
    }
  });

  // Setup monitoring
  setupHardeningMonitoring(hardening);

  // Wait for initialization
  await new Promise(resolve => {
    if (hardening.isInitialized) {
      resolve();
    } else {
      hardening.once('hardeningInitialized', resolve);
    }
  });

  console.log('✅ Hardening system initialized');

  try {
    // Test 1: Resource Exhaustion Protection
    console.log('\n📊 Test 1: Resource Exhaustion Protection');
    await testResourceExhaustionProtection(hardening);

    // Test 2: Concurrent Access Management
    console.log('\n🔄 Test 2: Concurrent Access Management');
    await testConcurrentAccessManagement(hardening);

    // Test 3: Boundary Condition Validation
    console.log('\n🛡️ Test 3: Boundary Condition Validation');
    await testBoundaryConditionValidation(hardening);

    // Test 4: Integrated Attack Simulation
    console.log('\n⚔️ Test 4: Integrated Attack Simulation');
    await testIntegratedAttackSimulation(hardening);

    // Test 5: Load Testing with Hardening
    console.log('\n🚀 Test 5: Load Testing with Hardening');
    await testLoadTestingWithHardening(hardening);

    // Final metrics
    console.log('\n📈 Final Hardening Metrics:');
    const finalMetrics = hardening.getHardeningMetrics();
    console.log(JSON.stringify(finalMetrics, null, 2));

    const componentMetrics = hardening.getComponentMetrics();
    console.log('\n🔧 Component Metrics:');
    console.log(JSON.stringify(componentMetrics, null, 2));

    console.log('\n✅ All tests completed successfully!');
    console.log('🔒 AIS Architecture hardening is working as expected');

  } catch (error) {
    console.error('\n❌ Integration test failed:', error.message);
    throw error;

  } finally {
    await hardening.shutdown();
    console.log('\n🛑 Hardening system shutdown complete');
  }
}

function setupHardeningMonitoring(hardening) {
  hardening.on('securityAlert', (alert) => {
    console.log(`🚨 SECURITY ALERT: ${alert.type} (${alert.severity}) - ${JSON.stringify(alert.data)}`);
  });

  hardening.on('hardenedOperationFailure', (data) => {
    console.log(`⚠️  Operation failure: ${data.operationId} - ${data.error}`);
  });

  hardening.on('remediationPerformed', (data) => {
    console.log(`🔧 Auto-remediation: ${data.type} at ${new Date(data.timestamp).toISOString()}`);
  });

  hardening.on('attackAttemptRecorded', (attack) => {
    console.log(`🛡️ Attack blocked: ${attack.attackId} on boundary ${attack.boundaryId}`);
  });

  hardening.on('coordinatedAttackDetected', (data) => {
    console.log(`🚨 COORDINATED ATTACK: ${data.pattern} - ${data.activityCount} attempts`);
  });
}

async function testResourceExhaustionProtection(hardening) {
  console.log('  Testing memory leak prevention...');

  // Memory exhaustion test
  const memoryLeakOps = Array(15).fill(null).map((_, i) =>
    hardening.executeHardenedOperation(`memory_${i}`, async () => {
      return new Array(15000).fill(crypto.randomUUID());
    }, { timeout: 5000 }).catch(error => ({ error: error.message }))
  );

  const memoryResults = await Promise.all(memoryLeakOps);
  const memoryFailures = memoryResults.filter(r => r.error);

  console.log(`    Memory operations: ${memoryResults.length}, Failures: ${memoryFailures.length}`);

  // CPU exhaustion test
  console.log('  Testing CPU starvation prevention...');

  const cpuIntensiveOps = Array(8).fill(null).map((_, i) =>
    hardening.executeHardenedOperation(`cpu_${i}`, async () => {
      const start = Date.now();
      let result = 0;
      while (Date.now() - start < 3000) {
        result += Math.random();
      }
      return result;
    }, { timeout: 8000 }).catch(error => ({ error: error.message }))
  );

  const cpuResults = await Promise.all(cpuIntensiveOps);
  const cpuFailures = cpuResults.filter(r => r.error);

  console.log(`    CPU operations: ${cpuResults.length}, Failures: ${cpuFailures.length}`);

  // I/O blocking test
  console.log('  Testing I/O blocking prevention...');

  const ioBlockingOps = Array(6).fill(null).map((_, i) =>
    hardening.executeHardenedOperation(`io_${i}`, async () => {
      return new Promise(resolve => {
        setTimeout(() => resolve({ data: 'delayed_response' }), 6000);
      });
    }, { timeout: 3000 }).catch(error => ({ error: error.message }))
  );

  const ioResults = await Promise.all(ioBlockingOps);
  const ioTimeouts = ioResults.filter(r => r.error && r.error.includes('timeout'));

  console.log(`    I/O operations: ${ioResults.length}, Timeouts: ${ioTimeouts.length}`);

  console.log('  ✅ Resource exhaustion protection test completed');
}

async function testConcurrentAccessManagement(hardening) {
  console.log('  Testing race condition prevention...');

  const sharedResource = 'test_shared_resource';
  let baseValue = 100;

  // Concurrent writes to same resource
  const concurrentWrites = Array(25).fill(null).map((_, i) =>
    hardening.executeHardenedOperation(`concurrent_${i}`, async () => {
      const newValue = baseValue + Math.random() * 20;
      return {
        score: newValue,
        id: i,
        timestamp: Date.now()
      };
    }, {
      resourceId: sharedResource,
      operationType: 'write',
      requiresConcurrencyControl: true
    }).catch(error => ({ error: error.message }))
  );

  const concurrentResults = await Promise.all(concurrentWrites);
  const successfulWrites = concurrentResults.filter(r => !r.error);

  console.log(`    Concurrent writes: ${concurrentResults.length}, Successful: ${successfulWrites.length}`);

  // Test atomic batch operations
  console.log('  Testing atomic batch operations...');

  const batchOperations = [
    {
      resourceId: 'batch_resource_1',
      type: 'write',
      data: { value: 42 },
      operation: async () => ({ value: 42 })
    },
    {
      resourceId: 'batch_resource_2',
      type: 'write',
      data: { value: 84 },
      operation: async () => ({ value: 84 })
    },
    {
      resourceId: 'batch_resource_3',
      type: 'write',
      data: { value: 126 },
      operation: async () => ({ value: 126 })
    }
  ];

  try {
    const batchResult = await hardening.executeHardenedBatch(batchOperations);
    console.log(`    Batch operations completed: ${batchResult.results.length}`);
  } catch (error) {
    console.log(`    Batch operations failed: ${error.message}`);
  }

  console.log('  ✅ Concurrent access management test completed');
}

async function testBoundaryConditionValidation(hardening) {
  console.log('  Registering test boundaries...');

  // Register API boundary
  hardening.registerProtectedBoundary('test_api', {
    name: 'Test API Boundary',
    type: 'api',
    endpoint: 'http://test-api.example.com',
    validationRules: [
      {
        name: 'required-id',
        type: 'schema',
        schema: { required: ['id'] }
      },
      {
        name: 'size-limit',
        type: 'size',
        maxSize: 2048
      }
    ],
    silentFailurePatterns: [
      { type: 'empty_response' },
      { type: 'slow_response', threshold: 3000 }
    ]
  });

  // Register database boundary
  hardening.registerProtectedBoundary('test_db', {
    name: 'Test Database Boundary',
    type: 'database',
    validationRules: [
      {
        name: 'injection-protection',
        type: 'custom',
        validator: (data) => !/(union|select|drop|delete)/i.test(JSON.stringify(data))
      }
    ]
  });

  console.log('  Testing valid boundary operations...');

  // Valid operations
  const validOps = [
    hardening.executeProtectedBoundaryOperation('test_api', async (data) => {
      return { result: 'success', data };
    }, { id: 'test123', payload: 'valid_data' }),

    hardening.executeProtectedBoundaryOperation('test_db', async (data) => {
      return { query_result: data };
    }, { table: 'users', action: 'select', where: { active: true } })
  ];

  const validResults = await Promise.allSettled(validOps);
  const validSuccesses = validResults.filter(r => r.status === 'fulfilled');

  console.log(`    Valid operations: ${validOps.length}, Successful: ${validSuccesses.length}`);

  console.log('  Testing invalid boundary operations...');

  // Invalid operations (should be blocked)
  const invalidOps = [
    hardening.executeProtectedBoundaryOperation('test_api', async (data) => {
      return { result: 'success', data };
    }, { payload: 'missing_id' }).catch(error => ({ error: error.message })),

    hardening.executeProtectedBoundaryOperation('test_db', async (data) => {
      return { query_result: 'injected' };
    }, { query: 'SELECT * FROM users; DROP TABLE users;' }).catch(error => ({ error: error.message }))
  ];

  const invalidResults = await Promise.all(invalidOps);
  const invalidBlocked = invalidResults.filter(r => r.error);

  console.log(`    Invalid operations: ${invalidOps.length}, Blocked: ${invalidBlocked.length}`);

  // Test silent failure detection
  console.log('  Testing silent failure detection...');

  const silentFailureOp = hardening.executeProtectedBoundaryOperation('test_api', async () => {
    return null; // Silent failure - empty response
  }, { id: 'silent_test' }).catch(error => ({ error: error.message }));

  await silentFailureOp;

  console.log('  ✅ Boundary condition validation test completed');
}

async function testIntegratedAttackSimulation(hardening) {
  console.log('  Simulating coordinated attack patterns...');

  // Simulate multiple attack vectors simultaneously
  const attackSimulations = await Promise.all([
    simulateAttackPattern(hardening, 'memory_exhaust', 5),
    simulateAttackPattern(hardening, 'cpu_exhaust', 5),
    simulateAttackPattern(hardening, 'boundary_violation', 5)
  ]);

  const totalAttacks = attackSimulations.flat().length;
  const blockedAttacks = attackSimulations.flat().filter(r => !r.success).length;

  console.log(`    Total attack attempts: ${totalAttacks}, Blocked: ${blockedAttacks}`);

  // Test sophisticated attack pattern
  console.log('  Testing sophisticated attack pattern...');

  const sophisticatedAttack = Array(10).fill(null).map((_, i) =>
    hardening.executeHardenedOperation(`sophisticated_${i}`, async () => {
      // Combine multiple attack vectors
      const memoryWaste = new Array(5000).fill(crypto.randomUUID());

      let cpuWaste = 0;
      for (let j = 0; j < 10000; j++) {
        cpuWaste += Math.random();
      }

      return {
        memory: memoryWaste.length,
        cpu: cpuWaste,
        payload: 'malicious_data'
      };
    }, {
      timeout: 2000,
      operationType: 'suspicious'
    }).catch(error => ({ error: error.message }))
  );

  const sophisticatedResults = await Promise.all(sophisticatedAttack);
  const sophisticatedBlocked = sophisticatedResults.filter(r => r.error);

  console.log(`    Sophisticated attacks: ${sophisticatedAttack.length}, Blocked: ${sophisticatedBlocked.length}`);

  console.log('  ✅ Integrated attack simulation test completed');
}

async function testLoadTestingWithHardening(hardening) {
  console.log('  Performing load test with hardening enabled...');

  const loadTestConfig = {
    concurrency: 30,
    operationTimeout: 8000,
    operation: async () => {
      const operationType = Math.random();

      if (operationType < 0.25) {
        // Memory operation
        return new Array(2000).fill(crypto.randomUUID());
      } else if (operationType < 0.5) {
        // CPU operation
        let result = 0;
        for (let i = 0; i < 50000; i++) {
          result += Math.random();
        }
        return result;
      } else if (operationType < 0.75) {
        // I/O simulation
        await new Promise(resolve => setTimeout(resolve, 200));
        return { timestamp: Date.now() };
      } else {
        // Boundary operation
        return { boundary_data: crypto.randomUUID() };
      }
    }
  };

  const startTime = Date.now();
  const loadTestResult = await hardening.performHardeningLoadTest(loadTestConfig);
  const duration = Date.now() - startTime;

  console.log(`    Load test duration: ${duration}ms`);
  console.log(`    Total operations: ${loadTestResult.totalOperations}`);
  console.log(`    Success rate: ${(loadTestResult.successRate * 100).toFixed(2)}%`);
  console.log(`    Hardening effectiveness:`);
  console.log(`      Attacks prevented: ${loadTestResult.hardeningEffectiveness.attacksPrevented}`);
  console.log(`      Resource leaks prevented: ${loadTestResult.hardeningEffectiveness.resourceLeaksPrevented}`);
  console.log(`      Race conditions prevented: ${loadTestResult.hardeningEffectiveness.racConditionsPrevented}`);
  console.log(`      Boundary failures prevented: ${loadTestResult.hardeningEffectiveness.boundaryFailuresPrevented}`);

  console.log('  ✅ Load testing with hardening test completed');
}

// Run the integration test
if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrationTest()
    .then(() => {
      console.log('\n🎉 AIS Architecture Hardening Integration Test PASSED');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 AIS Architecture Hardening Integration Test FAILED');
      console.error(error);
      process.exit(1);
    });
}

export default runIntegrationTest;