/**
 * Vitest Test Setup
 * Global test configuration and mocks for Agent Immunity System testing
 */

import { beforeAll, afterAll, vi } from 'vitest';

// Global test configuration
beforeAll(() => {
  // Mock performance API for consistent timing tests
  Object.defineProperty(global, 'performance', {
    value: {
      now: vi.fn(() => Date.now()),
      mark: vi.fn(),
      measure: vi.fn(),
      getEntriesByType: vi.fn(() => []),
      getEntriesByName: vi.fn(() => []),
      clearMarks: vi.fn(),
      clearMeasures: vi.fn()
    }
  });

  // Mock global garbage collection for memory tests
  if (!global.gc) {
    Object.defineProperty(global, 'gc', {
      value: vi.fn(() => {
        // Mock garbage collection - in real tests this would be --expose-gc
        if (process.env.NODE_ENV === 'test') {
          // Simulate GC pause
          const start = Date.now();
          while (Date.now() - start < 1) {
            // Brief pause to simulate GC
          }
        }
      })
    });
  }

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.IMMUNITY_SYSTEM_TEST_MODE = 'true';
  process.env.CLAUDE_FLOW_LOG_LEVEL = 'error'; // Reduce log noise in tests

  // Configure test timeouts based on performance requirements
  process.env.IMMUNITY_LATENCY_TARGET = '30'; // 30ms target
  process.env.IMMUNITY_PERFORMANCE_MODE = 'strict';
});

afterAll(() => {
  // Cleanup test environment
  delete process.env.IMMUNITY_SYSTEM_TEST_MODE;
  delete process.env.IMMUNITY_LATENCY_TARGET;
  delete process.env.IMMUNITY_PERFORMANCE_MODE;

  // Clear all mocks
  vi.clearAllMocks();
  vi.resetAllMocks();
});

// Global test utilities
declare global {
  namespace Vi {
    interface AssertsNamespace {
      toBeWithinLatencyTarget(received: number, target?: number): void;
      toHaveValidImmunityResult(received: any): void;
      toBeThreatPattern(received: string): void;
    }
  }
}

// Custom matchers for immunity system testing
expect.extend({
  toBeWithinLatencyTarget(received: number, target: number = 30) {
    const pass = received <= target;
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received}ms to exceed latency target of ${target}ms`
          : `Expected ${received}ms to be within latency target of ${target}ms`
    };
  },

  toHaveValidImmunityResult(received: any) {
    const requiredFields = ['blocked', 'confidence', 'reason', 'type', 'analysisTimeMs'];
    const hasAllFields = requiredFields.every(field => received.hasOwnProperty(field));

    const validConfidence = typeof received.confidence === 'number' &&
                          received.confidence >= 0 &&
                          received.confidence <= 1;

    const validLatency = typeof received.analysisTimeMs === 'number' &&
                        received.analysisTimeMs >= 0 &&
                        received.analysisTimeMs <= 100; // Reasonable upper bound

    const pass = hasAllFields && validConfidence && validLatency;

    return {
      pass,
      message: () => pass
        ? `Expected immunity result to be invalid`
        : `Expected immunity result to have valid structure. Missing: ${requiredFields.filter(f => !received.hasOwnProperty(f)).join(', ')}`
    };
  },

  toBeThreatPattern(received: string) {
    const threatIndicators = [
      /eval\s*\(/gi,                    // Code injection
      /exec\s*\(/gi,                    // Command execution
      /<script[^>]*>/gi,                // XSS
      /SELECT.*FROM.*WHERE.*=/gi,       // SQL injection
      /rm\s+-rf/gi,                     // Destructive commands
      /\.\.\//gi,                       // Path traversal
      /document\.cookie/gi,             // Cookie manipulation
      /innerHTML\s*=/gi                 // DOM manipulation
    ];

    const containsThreat = threatIndicators.some(pattern => pattern.test(received));

    return {
      pass: containsThreat,
      message: () => containsThreat
        ? `Expected "${received}" to not contain threat patterns`
        : `Expected "${received}" to contain recognizable threat patterns`
    };
  }
});

// Mock implementations for common dependencies
vi.mock('crypto', () => ({
  randomBytes: vi.fn((size: number) => Buffer.alloc(size, 0)),
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn(() => 'mock-hash')
  })),
  createCipher: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    final: vi.fn(() => 'mock-encrypted')
  }))
}));

// Mock file system for pattern persistence tests
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  access: vi.fn(),
  unlink: vi.fn()
}));

// Test data generators for consistency
export const TestDataGenerators = {
  /**
   * Generate test code samples for immunity testing
   */
  generateCodeSamples: (count: number = 10) => {
    const samples = [
      'console.log("Hello World");',
      'const x = 5; const y = 10; return x + y;',
      'function helper() { return Math.random(); }',
      'const data = { key: "value", count: 42 };',
      'if (user.isAdmin()) { /* admin code */ }',
      'const result = await fetchData();',
      'try { processData(); } catch (e) { logError(e); }',
      'const items = list.map(item => item.name);',
      'for (let i = 0; i < 10; i++) { doWork(i); }',
      'return response.status(200).json({ success: true });'
    ];

    return Array.from({ length: count }, (_, i) => samples[i % samples.length]);
  },

  /**
   * Generate malicious code patterns for testing
   */
  generateThreatSamples: () => [
    'eval(userInput);',
    'exec("rm -rf /");',
    '<script>alert("XSS")</script>',
    'SELECT * FROM users WHERE id = \'' + userId + '\'',
    'subprocess.call(userCommand)',
    'innerHTML = userContent;',
    'document.cookie = maliciousPayload;',
    'window.location = evilSite;',
    '../../../etc/passwd',
    'process.env.SECRET = hackedValue;'
  ],

  /**
   * Generate trajectory steps for context testing
   */
  generateTrajectory: (steps: number = 5) => {
    const stepTypes = ['thought', 'action', 'observation', 'result'];
    const contents = [
      'Planning security implementation',
      'Installing security dependencies',
      'Implementing input validation',
      'Testing security measures',
      'Deploying secure solution'
    ];

    return Array.from({ length: steps }, (_, i) => ({
      type: stepTypes[i % stepTypes.length],
      content: contents[i % contents.length],
      timestamp: Date.now() - (steps - i) * 1000
    }));
  }
};