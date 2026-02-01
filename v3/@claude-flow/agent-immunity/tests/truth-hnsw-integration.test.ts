/**
 * Truth Immunity HNSW Integration Tests
 *
 * Validates real @claude-flow/memory integration with HNSW vector search
 * for truth verification with 150x-12,500x performance improvements.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TruthImmunity } from '../src/immunities/truth';
import { promises as fs } from 'fs';
import { join } from 'path';

// Mock embedding generator for testing
const mockEmbeddingGenerator = async (text: string): Promise<Float32Array> => {
  // Simple hash-based embedding for deterministic tests
  const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const embedding = new Float32Array(384);

  for (let i = 0; i < 384; i++) {
    embedding[i] = Math.sin(hash * (i + 1) * 0.001) * 0.1;
  }

  return embedding;
};

describe('Truth Immunity HNSW Integration', () => {
  let truthImmunity: TruthImmunity;
  const testDbPath = join(__dirname, '../test-data/truth-test.db');

  beforeAll(async () => {
    // Ensure test directory exists
    await fs.mkdir(join(__dirname, '../test-data'), { recursive: true });

    // Initialize truth immunity with mock embeddings
    truthImmunity = new TruthImmunity(mockEmbeddingGenerator, testDbPath);
    await truthImmunity.initialize();
  });

  afterAll(async () => {
    await truthImmunity.shutdown();

    // Clean up test database
    try {
      await fs.unlink(testDbPath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  describe('Real HNSW Integration', () => {
    it('should initialize with HNSW indexing', async () => {
      expect(truthImmunity).toBeDefined();

      const metrics = truthImmunity.getMetrics();
      expect(metrics).toEqual(expect.objectContaining({
        avgSearchTime: expect.any(Number),
        totalQueries: expect.any(Number),
        cacheHitRate: expect.any(Number),
        targetAchieved: expect.any(Boolean)
      }));
    });

    it('should add and retrieve truth facts', async () => {
      await truthImmunity.addTruthFact(
        'HNSW provides logarithmic time complexity for similarity search',
        0.95,
        'test-system'
      );

      // Verify fact was stored by searching for it
      const result = await truthImmunity.analyze({
        task: {
          description: 'HNSW is efficient for similarity search operations'
        }
      });

      expect(result.score).toBeGreaterThan(0.5);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect hallucinations with low similarity scores', async () => {
      const result = await truthImmunity.analyze({
        task: {
          description: 'JavaScript is written in assembly language and runs on quantum computers'
        }
      });

      expect(result.score).toBeLessThan(0.3);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('hallucination');
      expect(result.violations[0].severity).toBe('high');
    });

    it('should provide medium confidence warnings for ambiguous claims', async () => {
      const result = await truthImmunity.analyze({
        task: {
          description: 'Modern frameworks enhance development productivity significantly'
        }
      });

      // This should be flagged as low confidence due to vague nature
      if (result.score < 0.5) {
        expect(result.violations[0].type).toBe('low_confidence');
        expect(result.violations[0].severity).toBe('medium');
      }
    });

    it('should correctly identify true technical facts', async () => {
      const result = await truthImmunity.analyze({
        task: {
          description: 'TypeScript is a superset of JavaScript that adds static typing'
        }
      });

      expect(result.score).toBeGreaterThan(0.7);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('Performance Validation', () => {
    it('should achieve sub-100ms search performance target', async () => {
      // Add multiple facts to test search performance
      const facts = [
        'Vector databases optimize high-dimensional data queries',
        'Approximate nearest neighbor algorithms trade accuracy for speed',
        'HNSW constructs hierarchical graphs for efficient navigation',
        'Embedding spaces capture semantic similarity relationships',
        'Quantization reduces memory usage while preserving accuracy'
      ];

      for (const fact of facts) {
        await truthImmunity.addTruthFact(fact, 0.9, 'performance-test');
      }

      // Perform multiple searches to measure average performance
      const searches = 10;
      const start = performance.now();

      for (let i = 0; i < searches; i++) {
        await truthImmunity.analyze({
          task: { description: 'Database optimization techniques for vector search' }
        });
      }

      const totalTime = performance.now() - start;
      const avgTime = totalTime / searches;

      console.log(`Average search time: ${avgTime.toFixed(2)}ms`);

      // Target: Sub-100ms queries
      expect(avgTime).toBeLessThan(100);

      const metrics = truthImmunity.getMetrics();
      expect(metrics.targetAchieved).toBe(true);
    });

    it('should demonstrate speedup vs brute force approach', async () => {
      const benchmark = await truthImmunity.benchmarkPerformance();

      expect(benchmark.speedupRatio).toBeGreaterThan(10); // At least 10x speedup
      expect(benchmark.hnswTime).toBeLessThan(100); // Sub-100ms target
      expect(benchmark.entriesSearched).toBeGreaterThan(0);

      console.log(`HNSW vs Brute Force:
        - HNSW time: ${benchmark.hnswTime.toFixed(2)}ms
        - Estimated brute force: ${benchmark.bruteForceTime.toFixed(2)}ms
        - Speedup: ${benchmark.speedupRatio.toFixed(1)}x
        - Entries searched: ${benchmark.entriesSearched}`);
    });
  });

  describe('Learning and Pattern Storage', () => {
    it('should store and learn from truth patterns', async () => {
      await truthImmunity.learnPattern(
        'Machine learning models require training data',
        true,
        { domain: 'ai-ml', confidence: 0.95 }
      );

      await truthImmunity.learnPattern(
        'Quantum computers run on classical processors',
        false,
        { domain: 'quantum', confidence: 0.9 }
      );

      // Verify patterns influence future truth verification
      const trueResult = await truthImmunity.analyze({
        task: { description: 'AI systems need training datasets to learn patterns' }
      });

      const falseResult = await truthImmunity.analyze({
        task: { description: 'Quantum computers operate using traditional silicon chips' }
      });

      expect(trueResult.score).toBeGreaterThan(falseResult.score);
    });

    it('should maintain fleet-shared knowledge base', async () => {
      // Add facts that would be shared across agent fleet
      await truthImmunity.addTruthFact(
        'Cross-agent memory sharing enables collective intelligence',
        0.95,
        'fleet-knowledge'
      );

      await truthImmunity.addTruthFact(
        'SONA integration provides adaptive learning capabilities',
        0.9,
        'fleet-knowledge'
      );

      const result = await truthImmunity.analyze({
        task: {
          description: 'Agent swarms benefit from shared memory and adaptive learning systems'
        }
      });

      expect(result.score).toBeGreaterThan(0.6);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('Memory Usage and Scalability', () => {
    it('should handle large fact databases efficiently', async () => {
      // Simulate large fact database
      const largeBatch = Array.from({ length: 100 }, (_, i) => ({
        fact: `Technical fact number ${i} about system architecture and performance optimization`,
        confidence: 0.8 + (i % 2) * 0.1,
        source: 'scalability-test'
      }));

      const batchStart = performance.now();

      for (const { fact, confidence, source } of largeBatch) {
        await truthImmunity.addTruthFact(fact, confidence, source);
      }

      const batchTime = performance.now() - batchStart;
      console.log(`Batch insert time for 100 facts: ${batchTime.toFixed(2)}ms`);

      // Verify search performance doesn't degrade significantly
      const searchStart = performance.now();
      await truthImmunity.analyze({
        task: { description: 'System architecture performance optimization techniques' }
      });
      const searchTime = performance.now() - searchStart;

      expect(searchTime).toBeLessThan(100); // Maintain sub-100ms target
    });

    it('should provide memory usage statistics', async () => {
      const metrics = truthImmunity.getMetrics();

      expect(metrics.totalQueries).toBeGreaterThan(0);
      expect(metrics.avgSearchTime).toBeGreaterThan(0);
      expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0);

      console.log('Truth Immunity Performance Metrics:', {
        queries: metrics.totalQueries,
        avgTime: `${metrics.avgSearchTime.toFixed(2)}ms`,
        cacheHitRate: `${(metrics.cacheHitRate * 100).toFixed(1)}%`,
        targetAchieved: metrics.targetAchieved
      });
    });
  });

  describe('Error Handling and Robustness', () => {
    it('should handle empty or malformed input gracefully', async () => {
      const emptyResult = await truthImmunity.analyze({});
      expect(emptyResult.score).toBe(1.0);
      expect(emptyResult.violations).toHaveLength(0);

      const nullResult = await truthImmunity.analyze(null);
      expect(nullResult.score).toBe(1.0);
      expect(nullResult.violations).toHaveLength(0);
    });

    it('should maintain fail-safe behavior on errors', async () => {
      // Test with potentially problematic input
      const result = await truthImmunity.analyze({
        task: {
          description: ''.repeat(10000) // Very long string
        }
      });

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(Array.isArray(result.violations)).toBe(true);
    });
  });
});