/**
 * Test Setup for AIS Plugin Testing Suite
 * AQE Global Test Configuration
 */

import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

// Global test configuration
declare global {
  var __AIS_TEST_CONFIG__: {
    startTime: number;
    performanceBaseline: Map<string, number>;
    resourceMonitor: {
      initialMemory: number;
      peakMemory: number;
    };
  };
}

// Performance baseline storage
globalThis.__AIS_TEST_CONFIG__ = {
  startTime: Date.now(),
  performanceBaseline: new Map(),
  resourceMonitor: {
    initialMemory: 0,
    peakMemory: 0
  }
};

// Extended Jest matchers
expect.extend({
  toBeWithinPerformanceBudget(received: number, budget: number) {
    const pass = received <= budget;
    return {
      message: () =>
        pass
          ? `Expected ${received}ms to exceed budget of ${budget}ms`
          : `Expected ${received}ms to be within budget of ${budget}ms`,
      pass,
    };
  },

  toHaveReasonableMemoryUsage(received: number, baseline: number, maxIncrease = 50) {
    const increase = received - baseline;
    const pass = increase <= maxIncrease;
    return {
      message: () =>
        pass
          ? `Expected memory increase of ${increase}MB to exceed ${maxIncrease}MB`
          : `Expected memory increase of ${increase}MB to be within ${maxIncrease}MB`,
      pass,
    };
  },

  toBeValidThreatDetection(received: any) {
    const requiredFields = ['id', 'timestamp', 'agentId', 'threatType', 'severity', 'confidence'];
    const hasAllFields = requiredFields.every(field => received && received[field] !== undefined);

    const validConfidence = received && received.confidence >= 0 && received.confidence <= 1;
    const validTimestamp = received && received.timestamp > 0;

    const pass = hasAllFields && validConfidence && validTimestamp;

    return {
      message: () =>
        pass
          ? 'Expected object not to be a valid threat detection'
          : `Expected object to be a valid threat detection. Missing or invalid fields in: ${JSON.stringify(received, null, 2)}`,
      pass,
    };
  },

  toMeetLatencyRequirement(received: number, requirement = 100) {
    const pass = received <= requirement;
    return {
      message: () =>
        pass
          ? `Expected ${received}ms to exceed latency requirement of ${requirement}ms`
          : `Expected ${received}ms to meet latency requirement of ${requirement}ms`,
      pass,
    };
  }
});

// Type declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinPerformanceBudget(budget: number): R;
      toHaveReasonableMemoryUsage(baseline: number, maxIncrease?: number): R;
      toBeValidThreatDetection(): R;
      toMeetLatencyRequirement(requirement?: number): R;
    }
  }
}

// Global setup
beforeAll(async () => {
  console.log('🚀 Starting AIS Plugin Test Suite');
  console.log('📊 AQE Quality Engineering Framework Initialized');

  // Record initial system state
  const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  globalThis.__AIS_TEST_CONFIG__.resourceMonitor.initialMemory = initialMemory;
  globalThis.__AIS_TEST_CONFIG__.resourceMonitor.peakMemory = initialMemory;

  // Set performance baselines
  globalThis.__AIS_TEST_CONFIG__.performanceBaseline.set('threatDetection', 100); // ms
  globalThis.__AIS_TEST_CONFIG__.performanceBaseline.set('agentRegistration', 10); // ms
  globalThis.__AIS_TEST_CONFIG__.performanceBaseline.set('systemHealthCheck', 50); // ms
  globalThis.__AIS_TEST_CONFIG__.performanceBaseline.set('threatProcessing', 5); // ms

  console.log(`📈 Initial Memory: ${initialMemory.toFixed(2)} MB`);
  console.log('⚡ Performance baselines set');
});

// Global cleanup
afterAll(async () => {
  const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  const initialMemory = globalThis.__AIS_TEST_CONFIG__.resourceMonitor.initialMemory;
  const peakMemory = globalThis.__AIS_TEST_CONFIG__.resourceMonitor.peakMemory;
  const totalTime = Date.now() - globalThis.__AIS_TEST_CONFIG__.startTime;

  console.log('📋 AIS Plugin Test Suite Summary:');
  console.log(`⏱️  Total Test Time: ${totalTime}ms`);
  console.log(`🧠 Memory Usage: ${initialMemory.toFixed(2)} MB → ${finalMemory.toFixed(2)} MB`);
  console.log(`📊 Peak Memory: ${peakMemory.toFixed(2)} MB`);
  console.log(`💾 Memory Delta: ${(finalMemory - initialMemory).toFixed(2)} MB`);

  // Memory leak detection
  const memoryIncrease = finalMemory - initialMemory;
  if (memoryIncrease > 100) { // More than 100MB increase
    console.warn(`⚠️  Potential memory leak detected: ${memoryIncrease.toFixed(2)} MB increase`);
  } else {
    console.log('✅ Memory usage within acceptable bounds');
  }

  console.log('🎯 AQE Validation Complete');
});

// Test-level setup
beforeEach(async () => {
  // Update peak memory tracking
  const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  if (currentMemory > globalThis.__AIS_TEST_CONFIG__.resourceMonitor.peakMemory) {
    globalThis.__AIS_TEST_CONFIG__.resourceMonitor.peakMemory = currentMemory;
  }

  // Set test timeout based on test type
  const testName = expect.getState().currentTestName;
  if (testName?.includes('performance') || testName?.includes('chaos')) {
    jest.setTimeout(60000); // 60 seconds for performance/chaos tests
  } else if (testName?.includes('e2e') || testName?.includes('integration')) {
    jest.setTimeout(30000); // 30 seconds for integration tests
  } else {
    jest.setTimeout(10000); // 10 seconds for unit tests
  }
});

afterEach(async () => {
  // Cleanup after each test
  if (global.gc) {
    global.gc(); // Force garbage collection if available
  }

  // Small delay to allow for async cleanup
  await new Promise(resolve => setTimeout(resolve, 10));
});

// Error handling for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Utility functions for tests
export const TestUtils = {
  /**
   * Measure operation performance
   */
  async measurePerformance<T>(operation: () => Promise<T>): Promise<{ result: T; timeMs: number }> {
    const startTime = Date.now();
    const result = await operation();
    const endTime = Date.now();
    return { result, timeMs: endTime - startTime };
  },

  /**
   * Get performance baseline for operation type
   */
  getPerformanceBaseline(operationType: string): number {
    return globalThis.__AIS_TEST_CONFIG__.performanceBaseline.get(operationType) || 1000;
  },

  /**
   * Wait for condition with timeout
   */
  async waitForCondition(
    condition: () => boolean | Promise<boolean>,
    timeoutMs = 5000,
    intervalMs = 100
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    return false;
  },

  /**
   * Create mock agent ID
   */
  createMockAgentId(prefix = 'test-agent'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Monitor memory usage during operation
   */
  async monitorMemoryUsage<T>(operation: () => Promise<T>): Promise<{
    result: T;
    memoryDelta: number;
    peakUsage: number;
  }> {
    const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    let peakMemory = initialMemory;

    const monitor = setInterval(() => {
      const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      if (currentMemory > peakMemory) {
        peakMemory = currentMemory;
      }
    }, 10);

    try {
      const result = await operation();
      clearInterval(monitor);

      const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      const memoryDelta = finalMemory - initialMemory;

      return {
        result,
        memoryDelta,
        peakUsage: peakMemory
      };
    } catch (error) {
      clearInterval(monitor);
      throw error;
    }
  }
};

// Console styling for test output
export const TestLogger = {
  performance: (message: string, ...args: any[]) =>
    console.log(`🏃‍♂️ [PERF] ${message}`, ...args),

  security: (message: string, ...args: any[]) =>
    console.log(`🔒 [SEC] ${message}`, ...args),

  memory: (message: string, ...args: any[]) =>
    console.log(`🧠 [MEM] ${message}`, ...args),

  chaos: (message: string, ...args: any[]) =>
    console.log(`💥 [CHAOS] ${message}`, ...args),

  integration: (message: string, ...args: any[]) =>
    console.log(`🔗 [INTEG] ${message}`, ...args)
};

// Export test configuration
export const AQE_CONFIG = {
  PERFORMANCE_TARGETS: {
    THREAT_DETECTION_MAX_MS: 100,
    AGENT_REGISTRATION_MAX_MS: 10,
    SYSTEM_HEALTH_CHECK_MAX_MS: 50,
    CONCURRENT_LOAD_MAX_MS: 200,
    MEMORY_INCREASE_MAX_MB: 50
  },

  QUALITY_GATES: {
    MIN_CODE_COVERAGE: 85,
    MAX_CYCLOMATIC_COMPLEXITY: 10,
    MAX_MEMORY_LEAK_MB: 20,
    MIN_THREAT_DETECTION_ACCURACY: 0.85,
    MAX_FALSE_POSITIVE_RATE: 0.10
  },

  CHAOS_PARAMETERS: {
    MAX_ERROR_RATE: 0.3,
    MAX_DELAY_MS: 1000,
    MEMORY_PRESSURE_MB: 200,
    CPU_LOAD_DURATION_MS: 2000
  }
};