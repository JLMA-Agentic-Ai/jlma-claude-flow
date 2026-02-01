/**
 * Jest Configuration for AIS Plugin Testing
 * AQE Testing Suite Configuration
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Root directory for tests
  rootDir: '../..',

  // Test patterns
  testMatch: [
    '**/tests/ais-plugin/**/*.test.ts',
    '**/tests/ais-plugin/**/*.test.js'
  ],

  // TypeScript support
  preset: 'ts-jest',

  // Module paths
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/ais-plugin/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/ais-plugin/$1'
  },

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/ais-plugin/setup/test-setup.ts'
  ],

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/tests/ais-plugin/coverage',
  coverageReporters: [
    'text',
    'html',
    'json',
    'lcov',
    'clover'
  ],

  // Coverage paths
  collectCoverageFrom: [
    'src/ais-plugin/src/**/*.ts',
    '!src/ais-plugin/src/**/*.d.ts',
    '!src/ais-plugin/src/**/*.test.ts',
    '!src/ais-plugin/src/types/index.ts' // Skip type definitions
  ],

  // Coverage thresholds (AQE Quality Gates)
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 88,
      statements: 88
    },
    // Critical components require higher coverage
    'src/ais-plugin/src/core/': {
      branches: 90,
      functions: 95,
      lines: 92,
      statements: 92
    },
    'src/ais-plugin/src/detectors/': {
      branches: 88,
      functions: 92,
      lines: 90,
      statements: 90
    }
  },

  // Test timeout (allow time for performance tests)
  testTimeout: 30000,

  // Globals
  globals: {
    'ts-jest': {
      tsconfig: {
        target: 'ES2020',
        lib: ['ES2020'],
        moduleResolution: 'node',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true
      }
    }
  },

  // Test reporters
  reporters: [
    'default',
    ['jest-html-reporters', {
      'publicPath': '<rootDir>/tests/ais-plugin/reports',
      'filename': 'ais-test-report.html',
      'expand': true,
      'hideIcon': false,
      'pageTitle': 'AIS Plugin Test Report'
    }],
    ['jest-junit', {
      'outputDirectory': '<rootDir>/tests/ais-plugin/reports',
      'outputName': 'junit.xml',
      'suiteName': 'AIS Plugin Test Suite',
      'classNameTemplate': '{classname}',
      'titleTemplate': '{title}',
      'ancestorSeparator': ' › ',
      'usePathForSuiteName': 'true'
    }]
  ],

  // Performance monitoring
  maxWorkers: '50%',

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Verbose output for debugging
  verbose: true,

  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(uuid|@claude-flow)/)'
  ],

  // Test categories via tags
  testNamePattern: process.env.TEST_CATEGORY ?
    new RegExp(process.env.TEST_CATEGORY, 'i') : undefined,

  // Custom test sequences
  projects: [
    {
      displayName: 'Unit Tests',
      testMatch: ['**/tests/ais-plugin/unit/**/*.test.ts']
    },
    {
      displayName: 'Integration Tests',
      testMatch: ['**/tests/ais-plugin/integration/**/*.test.ts']
    },
    {
      displayName: 'Performance Tests',
      testMatch: ['**/tests/ais-plugin/performance/**/*.test.ts']
    },
    {
      displayName: 'End-to-End Tests',
      testMatch: ['**/tests/ais-plugin/e2e/**/*.test.ts']
    },
    {
      displayName: 'Chaos Engineering Tests',
      testMatch: ['**/tests/ais-plugin/chaos/**/*.test.ts']
    }
  ]
};