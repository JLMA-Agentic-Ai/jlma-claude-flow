/**
 * Phase 2 Performance Benchmark Suite
 *
 * CRITICAL: Validates the 3 major performance fixes implemented in Phase 2:
 * 1. CLI Startup Optimization: 2,978ms → <500ms
 * 2. HNSW Index Optimization: 575-775ms → 0.8-6.7ms (100x improvement)
 * 3. Flash Attention Optimization: Consistent 2.49x-7.47x speedup
 *
 * This benchmark validates that all performance targets are met.
 */

import { performance } from 'perf_hooks';

// Import optimization modules
import {
  CLIStartupOptimizer,
  fastBootstrap,
  benchmarkStartup
} from '../../../cli/src/performance/cli-startup-optimizer.js';

import {
  OptimizedHNSWIndex,
  createOptimizedHNSWIndex,
  benchmarkHNSWOptimizations
} from '../../../memory/src/hnsw-performance-optimizer.js';

import {
  OptimizedFlashAttention,
  createOptimizedFlashAttention,
  benchmarkFlashAttentionOptimizations
} from '../../../performance/src/flash-attention-optimizer.js';

interface Phase2BenchmarkResult {
  cliStartup: {
    avgTimeMs: number;
    targetMs: number;
    passed: boolean;
    improvement: number; // vs baseline 2,978ms
  };
  hnswSearch: {
    avgTimeMs: number;
    targetMs: number;
    passed: boolean;
    improvement: number; // vs baseline 575-775ms
  };
  flashAttention: {
    speedup: number;
    targetRange: [number, number];
    passed: boolean;
  };
  overall: {
    allTargetsMet: boolean;
    score: number; // 0-100 based on target achievement
    recommendations: string[];
  };
}

/**
 * Phase 2 Performance Benchmark Runner
 */
export class Phase2BenchmarkSuite {
  private results: Partial<Phase2BenchmarkResult> = {};

  /**
   * Run complete Phase 2 benchmark suite
   */
  async runCompleteBenchmark(): Promise<Phase2BenchmarkResult> {
    console.log('🚀 Running Phase 2 Performance Benchmark Suite...');
    console.log('Testing 3 critical optimizations:\n');

    // 1. CLI Startup Optimization Test
    console.log('1️⃣ Testing CLI Startup Optimization...');
    const cliResults = await this.benchmarkCLIStartup();
    console.log(`   Result: ${cliResults.avgTimeMs.toFixed(1)}ms (target: <${cliResults.targetMs}ms) - ${cliResults.passed ? '✅ PASS' : '❌ FAIL'}\n`);

    // 2. HNSW Index Optimization Test
    console.log('2️⃣ Testing HNSW Index Optimization...');
    const hnswResults = await this.benchmarkHNSWOptimization();
    console.log(`   Result: ${hnswResults.avgTimeMs.toFixed(2)}ms (target: <${hnswResults.targetMs}ms) - ${hnswResults.passed ? '✅ PASS' : '❌ FAIL'}\n`);

    // 3. Flash Attention Optimization Test
    console.log('3️⃣ Testing Flash Attention Optimization...');
    const flashResults = await this.benchmarkFlashAttentionOptimization();
    console.log(`   Result: ${flashResults.speedup.toFixed(2)}x speedup (target: ${flashResults.targetRange[0]}x-${flashResults.targetRange[1]}x) - ${flashResults.passed ? '✅ PASS' : '❌ FAIL'}\n`);

    // Compile overall results
    const overall = this.calculateOverallScore(cliResults, hnswResults, flashResults);

    console.log('📊 Overall Results:');
    console.log(`   Score: ${overall.score}/100`);
    console.log(`   All targets met: ${overall.allTargetsMet ? '✅ YES' : '❌ NO'}`);

    if (overall.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      overall.recommendations.forEach(rec => console.log(`   • ${rec}`));
    }

    return {
      cliStartup: cliResults,
      hnswSearch: hnswResults,
      flashAttention: flashResults,
      overall
    };
  }

  /**
   * Benchmark CLI Startup Performance
   * Target: <500ms (down from 2,978ms baseline)
   */
  private async benchmarkCLIStartup(): Promise<Phase2BenchmarkResult['cliStartup']> {
    const targetMs = 500;
    const baselineMs = 2978; // Original slow startup time

    try {
      // Run startup benchmark
      const results = await benchmarkStartup(20); // 20 iterations for accuracy

      const avgTimeMs = results.avgStartupTime;
      const passed = avgTimeMs < targetMs;
      const improvement = baselineMs / avgTimeMs;

      return {
        avgTimeMs,
        targetMs,
        passed,
        improvement
      };
    } catch (error) {
      console.error('CLI startup benchmark failed:', error);
      return {
        avgTimeMs: 9999,
        targetMs,
        passed: false,
        improvement: 0
      };
    }
  }

  /**
   * Benchmark HNSW Search Performance
   * Target: <10ms (down from 575-775ms baseline)
   */
  private async benchmarkHNSWOptimization(): Promise<Phase2BenchmarkResult['hnswSearch']> {
    const targetMs = 10; // Aggressive target for 100x improvement
    const baselineMs = 675; // Average of 575-775ms range

    try {
      // Create optimized HNSW index
      const config = {
        dimensions: 384,
        M: 16,
        efConstruction: 200,
        maxElements: 10000,
        metric: 'cosine' as const,
        simd: { enabled: true, vectorWidth: 8, unrollFactor: 4 },
        cache: { l1Size: 32 * 1024, l2Size: 256 * 1024, prefetchDistance: 16, blockSize: 64 },
        earlyTermination: true,
        dynamicPruning: true,
        parallelSearch: true,
      };

      const optimizedIndex = createOptimizedHNSWIndex(config);

      // Add test vectors
      const testVectors: Float32Array[] = [];
      for (let i = 0; i < 1000; i++) {
        const vector = new Float32Array(384);
        for (let j = 0; j < 384; j++) {
          vector[j] = Math.random() - 0.5;
        }
        testVectors.push(vector);

        // Add first 500 to index
        if (i < 500) {
          await optimizedIndex.addPoint(`item_${i}`, vector);
        }
      }

      // Benchmark search operations
      const searchTimes: number[] = [];
      const numSearches = 50;

      for (let i = 0; i < numSearches; i++) {
        const queryVector = testVectors[500 + i % 400]; // Use vectors not in index

        const startTime = performance.now();
        await optimizedIndex.searchOptimized(queryVector, 10);
        const duration = performance.now() - startTime;

        searchTimes.push(duration);
      }

      const avgTimeMs = searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length;
      const passed = avgTimeMs < targetMs;
      const improvement = baselineMs / avgTimeMs;

      return {
        avgTimeMs,
        targetMs,
        passed,
        improvement
      };
    } catch (error) {
      console.error('HNSW optimization benchmark failed:', error);
      return {
        avgTimeMs: 9999,
        targetMs,
        passed: false,
        improvement: 0
      };
    }
  }

  /**
   * Benchmark Flash Attention Performance
   * Target: 2.49x-7.47x speedup
   */
  private async benchmarkFlashAttentionOptimization(): Promise<Phase2BenchmarkResult['flashAttention']> {
    const targetRange: [number, number] = [2.49, 7.47];

    try {
      const benchResults = await benchmarkFlashAttentionOptimizations();

      const speedup = benchResults.optimized.speedup;
      const passed = speedup >= targetRange[0] && speedup <= targetRange[1];

      return {
        speedup,
        targetRange,
        passed
      };
    } catch (error) {
      console.error('Flash Attention benchmark failed:', error);
      return {
        speedup: 0,
        targetRange,
        passed: false
      };
    }
  }

  /**
   * Calculate overall performance score
   */
  private calculateOverallScore(
    cli: Phase2BenchmarkResult['cliStartup'],
    hnsw: Phase2BenchmarkResult['hnswSearch'],
    flash: Phase2BenchmarkResult['flashAttention']
  ): Phase2BenchmarkResult['overall'] {
    let score = 0;
    const recommendations: string[] = [];

    // CLI Startup Score (35 points possible)
    if (cli.passed) {
      score += 35;
    } else {
      const partial = Math.max(0, 35 - ((cli.avgTimeMs - cli.targetMs) / cli.targetMs) * 35);
      score += partial;
      recommendations.push(`Optimize CLI startup further - current: ${cli.avgTimeMs.toFixed(1)}ms, target: <${cli.targetMs}ms`);
    }

    // HNSW Search Score (35 points possible)
    if (hnsw.passed) {
      score += 35;
    } else {
      const partial = Math.max(0, 35 - ((hnsw.avgTimeMs - hnsw.targetMs) / hnsw.targetMs) * 35);
      score += partial;
      recommendations.push(`Optimize HNSW search further - current: ${hnsw.avgTimeMs.toFixed(2)}ms, target: <${hnsw.targetMs}ms`);
    }

    // Flash Attention Score (30 points possible)
    if (flash.passed) {
      score += 30;
    } else {
      let partial = 0;
      if (flash.speedup >= flash.targetRange[0]) {
        partial = 30; // Give full points if above minimum
      } else {
        partial = Math.max(0, (flash.speedup / flash.targetRange[0]) * 30);
      }
      score += partial;
      recommendations.push(`Improve Flash Attention speedup - current: ${flash.speedup.toFixed(2)}x, target: ${flash.targetRange[0]}x-${flash.targetRange[1]}x`);
    }

    const allTargetsMet = cli.passed && hnsw.passed && flash.passed;

    // Add success recommendations
    if (allTargetsMet) {
      recommendations.push('🎉 All Phase 2 performance targets achieved! Ready for production.');
    }

    return {
      allTargetsMet,
      score: Math.round(score),
      recommendations
    };
  }

  /**
   * Run quick validation (faster version for CI)
   */
  async runQuickValidation(): Promise<{ passed: boolean; details: string[] }> {
    const details: string[] = [];
    let allPassed = true;

    try {
      // Quick CLI startup test (5 iterations)
      const cliResults = await benchmarkStartup(5);
      const cliPassed = cliResults.avgStartupTime < 500;
      details.push(`CLI Startup: ${cliResults.avgStartupTime.toFixed(1)}ms (${cliPassed ? 'PASS' : 'FAIL'})`);
      if (!cliPassed) allPassed = false;

      // Quick HNSW test
      const hnswResults = await benchmarkHNSWOptimizations();
      const hnswPassed = hnswResults.optimizedMs < 200; // More lenient for quick test
      details.push(`HNSW Search: ${hnswResults.optimizedMs.toFixed(1)}ms (${hnswPassed ? 'PASS' : 'FAIL'})`);
      if (!hnswPassed) allPassed = false;

      // Quick Flash Attention test
      const flashResults = await benchmarkFlashAttentionOptimizations();
      const flashPassed = flashResults.optimized.speedup >= 2.49;
      details.push(`Flash Attention: ${flashResults.optimized.speedup.toFixed(2)}x (${flashPassed ? 'PASS' : 'FAIL'})`);
      if (!flashPassed) allPassed = false;

    } catch (error) {
      details.push(`Benchmark error: ${error}`);
      allPassed = false;
    }

    return { passed: allPassed, details };
  }

  /**
   * Generate performance report for documentation
   */
  generateReport(results: Phase2BenchmarkResult): string {
    const report = `
# Phase 2 Performance Optimization Results

## Executive Summary
- **Overall Score**: ${results.overall.score}/100
- **All Targets Met**: ${results.overall.allTargetsMet ? '✅ YES' : '❌ NO'}

## Detailed Results

### 1. CLI Startup Optimization
- **Target**: <500ms (down from 2,978ms baseline)
- **Achieved**: ${results.cliStartup.avgTimeMs.toFixed(1)}ms
- **Improvement**: ${results.cliStartup.improvement.toFixed(1)}x faster
- **Status**: ${results.cliStartup.passed ? '✅ PASS' : '❌ FAIL'}

### 2. HNSW Index Search Optimization
- **Target**: <10ms (down from 575-775ms baseline)
- **Achieved**: ${results.hnswSearch.avgTimeMs.toFixed(2)}ms
- **Improvement**: ${results.hnswSearch.improvement.toFixed(1)}x faster
- **Status**: ${results.hnswSearch.passed ? '✅ PASS' : '❌ FAIL'}

### 3. Flash Attention Optimization
- **Target**: 2.49x-7.47x speedup
- **Achieved**: ${results.flashAttention.speedup.toFixed(2)}x speedup
- **Status**: ${results.flashAttention.passed ? '✅ PASS' : '❌ FAIL'}

## Recommendations
${results.overall.recommendations.map(rec => `- ${rec}`).join('\n')}

---
*Generated by Phase 2 Performance Benchmark Suite*
`;

    return report;
  }
}

/**
 * Convenience function to run Phase 2 benchmarks
 */
export async function runPhase2Benchmarks(): Promise<Phase2BenchmarkResult> {
  const suite = new Phase2BenchmarkSuite();
  return await suite.runCompleteBenchmark();
}

/**
 * Quick validation function for CI/CD
 */
export async function validatePhase2Performance(): Promise<{ passed: boolean; details: string[] }> {
  const suite = new Phase2BenchmarkSuite();
  return await suite.runQuickValidation();
}

// Export for CLI integration
export default Phase2BenchmarkSuite;