# AIS Plugin AQE Testing Suite

**Advanced Quality Engineering for Agent Immunity System**

This comprehensive testing suite validates the Agent Immunity System (AIS) plugin using evidence-based quality engineering principles. The suite includes unit tests, integration tests, performance benchmarks, end-to-end workflows, and chaos engineering validation.

## 📋 Table of Contents

- [Overview](#overview)
- [Test Categories](#test-categories)
- [Performance Validation](#performance-validation)
- [Quality Gates](#quality-gates)
- [Getting Started](#getting-started)
- [Running Tests](#running-tests)
- [Continuous Integration](#continuous-integration)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

The AIS Plugin AQE Testing Suite provides comprehensive validation for:

- **Agent Immunity Core**: Central orchestration engine
- **Threat Detector**: Real-time threat detection with <100ms requirement
- **Hive-Mind Integration**: Distributed coordination and Byzantine fault tolerance
- **Performance Optimization**: Memory usage, latency, and throughput validation
- **Chaos Engineering**: Fault tolerance and resilience testing

### Key Features

✅ **Evidence-Based Testing**: Realistic performance claims validation
✅ **Multi-Layer Coverage**: Unit → Integration → E2E → Chaos
✅ **Performance Benchmarking**: Sub-100ms latency requirements
✅ **Security Validation**: Threat detection accuracy and false positive rates
✅ **Fault Tolerance**: Byzantine failure scenarios and auto-healing

## 🧪 Test Categories

### 1. Unit Tests (`/unit/`)

**Scope**: Individual component functionality
**Files**: `ThreatDetector.test.ts`, `AgentImmunityCore.test.ts`

- Threat pattern detection accuracy
- Agent lifecycle management
- Performance metrics tracking
- Error handling and edge cases
- Memory management and cleanup

### 2. Integration Tests (`/integration/`)

**Scope**: Component interaction and hive-mind coordination
**Files**: `AIS-HiveMind-Integration.test.ts`

- Distributed threat detection
- Agent status synchronization
- Byzantine fault tolerance
- Memory state coordination
- Cross-agent communication

### 3. Performance Tests (`/performance/`)

**Scope**: Latency, throughput, and resource usage
**Files**: `AIS-Performance-Benchmarks.test.ts`

- Sub-100ms threat detection requirement
- Concurrent agent processing (15+ agents)
- Memory optimization validation (50-75% reduction)
- Realistic vs claimed performance analysis
- Resource scaling characteristics

### 4. End-to-End Tests (`/e2e/`)

**Scope**: Complete workflow validation
**Files**: `AIS-End-to-End.test.ts`

- Full threat lifecycle (detection → mitigation → recovery)
- MCP tool integration
- Adaptive learning workflows
- Auto-healing and recovery cycles
- Production-like workload simulation

### 5. Chaos Engineering (`/chaos/`)

**Scope**: Fault injection and resilience testing
**Files**: `AIS-Chaos-Engineering.test.ts`

- Plugin failure scenarios
- Memory pressure and resource exhaustion
- Network partition simulation
- Cascading failure prevention
- Data corruption handling

## ⚡ Performance Validation

### Realistic Performance Targets

| Metric | Realistic Target | Overstated Claim | Status |
|--------|------------------|------------------|--------|
| Threat Detection | <100ms | <10ms | ✅ Validated |
| Memory Reduction | 50-75% | Variable | ✅ Validated |
| Agent Registration | <10ms | <1ms | ✅ Validated |
| System Health Check | <50ms | <5ms | ✅ Validated |
| CLI Startup | ~500ms | 52ms | ❌ Corrected |
| HNSW Search | 10-50x | 2,000x | ❌ Corrected |

### Performance Monitoring

```bash
# Run performance benchmarks
npm run test:performance

# View performance report
open reports/performance-results.json
```

## 🚪 Quality Gates

### Coverage Requirements

| Component | Lines | Functions | Branches | Statements |
|-----------|-------|-----------|----------|------------|
| **Core** | ≥92% | ≥95% | ≥90% | ≥92% |
| **Detectors** | ≥90% | ≥92% | ≥88% | ≥90% |
| **Overall** | ≥88% | ≥90% | ≥85% | ≥88% |

### Security Metrics

- **Threat Detection Accuracy**: ≥85%
- **False Positive Rate**: ≤10%
- **Byzantine Fault Tolerance**: f < n/3
- **Response Time**: <100ms (95th percentile)

### Reliability Metrics

- **System Availability**: >99.9%
- **Memory Leak Detection**: <20MB over 24h
- **Auto-Recovery Time**: <60 seconds
- **Cascading Failure Prevention**: Isolate ≥80% of failures

## 🚀 Getting Started

### Prerequisites

- Node.js ≥18.0.0
- npm ≥9.0.0
- TypeScript ≥5.0.0

### Installation

```bash
# Navigate to test directory
cd tests/ais-plugin

# Install dependencies
npm install

# Make test runner executable
chmod +x run-aqe-tests.sh
```

### Quick Validation

```bash
# Run quick smoke test
npm run test:unit

# Full validation suite
npm test
```

## 🧩 Running Tests

### Individual Test Categories

```bash
# Unit tests only
./run-aqe-tests.sh unit

# Integration tests
./run-aqe-tests.sh integration

# Performance benchmarks
./run-aqe-tests.sh performance

# End-to-end workflows
./run-aqe-tests.sh e2e

# Chaos engineering
./run-aqe-tests.sh chaos

# Coverage generation
./run-aqe-tests.sh coverage
```

### Complete Test Suite

```bash
# Run all categories + generate reports
./run-aqe-tests.sh all

# Or using npm
npm test
```

### Development Mode

```bash
# Watch mode for development
npm run test:watch

# Debug mode with inspector
npm run test:debug

# Specific test file
npx jest unit/ThreatDetector.test.ts --watch
```

### Environment Variables

```bash
# Test specific category
TEST_CATEGORY=performance npm test

# Verbose output
VERBOSE=true npm test

# Memory profiling
NODE_OPTIONS="--max-old-space-size=4096" npm test
```

## 📊 Test Reports

### Generated Reports

- **HTML Report**: `reports/ais-test-report.html`
- **Coverage Report**: `coverage/index.html`
- **JUnit XML**: `reports/junit.xml`
- **Performance Data**: `reports/performance-results.json`
- **AQE Summary**: `reports/aqe-summary.md`

### Viewing Reports

```bash
# Open test report
npm run report

# Open coverage report
npm run coverage

# View AQE summary
cat reports/aqe-summary.md
```

## 🔄 Continuous Integration

### GitHub Actions Integration

```yaml
# .github/workflows/ais-tests.yml
name: AIS Plugin AQE Tests

on: [push, pull_request]

jobs:
  aqe-validation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install Dependencies
        run: |
          cd tests/ais-plugin
          npm install

      - name: Run AQE Test Suite
        run: |
          cd tests/ais-plugin
          ./run-aqe-tests.sh all

      - name: Upload Test Reports
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: ais-test-reports
          path: tests/ais-plugin/reports/

      - name: Upload Coverage
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: ais-coverage
          path: tests/ais-plugin/coverage/
```

### Quality Gate Enforcement

```bash
# Exit code validation
./run-aqe-tests.sh all
echo "Exit code: $?"

# Coverage threshold enforcement
npx jest --coverage --coverageThreshold='{"global":{"lines":88}}'
```

## 🔧 Troubleshooting

### Common Issues

#### Test Timeouts

```bash
# Increase timeout for performance tests
NODE_OPTIONS="--max-old-space-size=4096" npm test

# Run with specific timeout
npx jest --testTimeout=60000
```

#### Memory Issues

```bash
# Run with garbage collection
node --expose-gc node_modules/.bin/jest

# Monitor memory usage
NODE_ENV=development npm test
```

#### Plugin Failures

```bash
# Disable specific plugins
DISABLE_PLUGINS=true npm test

# Mock external dependencies
MOCK_MODE=true npm test
```

### Debug Mode

```bash
# Debug specific test
npx jest --config=jest.config.js --testNamePattern="should detect threats" --verbose

# Debug with Chrome DevTools
npm run test:debug
# Open chrome://inspect in Chrome
```

### Performance Debugging

```bash
# Enable performance profiling
NODE_OPTIONS="--prof" npm run test:performance

# Generate performance report
node --prof-process isolate-*.log > perf-report.txt
```

## 📚 Reference

### Test Structure

```
tests/ais-plugin/
├── unit/                     # Unit tests
├── integration/              # Integration tests
├── performance/              # Performance benchmarks
├── e2e/                      # End-to-end tests
├── chaos/                    # Chaos engineering
├── setup/                    # Test configuration
├── reports/                  # Generated reports
├── coverage/                 # Coverage reports
├── jest.config.js           # Jest configuration
├── run-aqe-tests.sh         # Test runner script
└── README.md                # This file
```

### Key Files

- `setup/test-setup.ts`: Global test configuration and utilities
- `jest.config.js`: Jest testing framework configuration
- `run-aqe-tests.sh`: Comprehensive test execution script
- `package.json`: Test dependencies and scripts

### Performance Targets

```typescript
const AQE_TARGETS = {
  THREAT_DETECTION_MAX_MS: 100,
  MEMORY_INCREASE_MAX_MB: 50,
  FALSE_POSITIVE_RATE_MAX: 0.10,
  COVERAGE_MIN_PERCENT: 85
};
```

---

## 🎯 AQE Methodology

This test suite follows evidence-based quality engineering principles:

1. **Realistic Performance Claims**: Validate actual vs marketing claims
2. **Comprehensive Coverage**: Multi-layer testing from unit to chaos
3. **Security-First**: Threat detection accuracy and fault tolerance
4. **Performance Monitoring**: Continuous latency and resource tracking
5. **Fault Injection**: Chaos engineering for resilience validation

**Contact**: Claude Flow AQE Team
**Documentation**: [forge-quality.dev methodology](https://forge-quality.dev)
**Issue Tracking**: GitHub Issues with `aqe-testing` label