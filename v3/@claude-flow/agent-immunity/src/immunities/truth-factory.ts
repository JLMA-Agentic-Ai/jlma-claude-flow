/**
 * Truth Immunity Factory - Integration with Real Embeddings
 *
 * @module @claude-flow/agent-immunity/immunities/truth-factory
 */

import { TruthImmunity } from './truth.js';
import type { EmbeddingGenerator } from '@claude-flow/memory';

/**
 * Configuration for Truth Immunity initialization
 */
export interface TruthImmunityConfig {
  /** Path to truth database file */
  databasePath?: string;

  /** Embedding dimensions (384 optimized for truth verification) */
  dimensions?: number;

  /** Enable performance monitoring */
  enableMetrics?: boolean;

  /** Pre-populate with domain-specific facts */
  domain?: 'general' | 'security' | 'ai-ml' | 'web-dev' | 'custom';

  /** Custom facts to add during initialization */
  customFacts?: Array<{
    fact: string;
    confidence: number;
    source?: string;
  }>;
}

/**
 * Create a Truth Immunity instance with real embeddings
 */
export async function createTruthImmunity(
  embeddingGenerator: EmbeddingGenerator,
  config: TruthImmunityConfig = {}
): Promise<TruthImmunity> {
  const {
    databasePath = './data/truth-immunity.db',
    domain = 'general',
    customFacts = [],
    enableMetrics = true
  } = config;

  const truthImmunity = new TruthImmunity(embeddingGenerator, databasePath);
  await truthImmunity.initialize();

  // Add domain-specific facts
  if (domain !== 'custom') {
    await addDomainFacts(truthImmunity, domain);
  }

  // Add custom facts
  for (const { fact, confidence, source } of customFacts) {
    await truthImmunity.addTruthFact(fact, confidence, source || 'custom');
  }

  if (enableMetrics) {
    // Set up periodic metrics logging
    setInterval(() => {
      const metrics = truthImmunity.getMetrics();
      if (metrics.totalQueries > 0) {
        console.log(`🔍 Truth Immunity Metrics: ${metrics.totalQueries} queries, ${metrics.avgSearchTime.toFixed(2)}ms avg, ${(metrics.cacheHitRate * 100).toFixed(1)}% cache hit`);
      }
    }, 300000); // Every 5 minutes
  }

  return truthImmunity;
}

/**
 * Add domain-specific facts to the truth immunity system
 */
async function addDomainFacts(truthImmunity: TruthImmunity, domain: string): Promise<void> {
  const domainFacts: Record<string, Array<{ fact: string; confidence: number }>> = {
    general: [
      { fact: 'Software applications require testing to ensure quality', confidence: 1.0 },
      { fact: 'Version control systems track code changes over time', confidence: 1.0 },
      { fact: 'APIs enable communication between software systems', confidence: 1.0 },
      { fact: 'Databases store and organize structured data', confidence: 1.0 },
      { fact: 'Caching improves application performance by reducing data access latency', confidence: 1.0 }
    ],

    security: [
      { fact: 'Input validation prevents injection attacks', confidence: 1.0 },
      { fact: 'Encryption protects sensitive data from unauthorized access', confidence: 1.0 },
      { fact: 'Authentication verifies user identity before granting access', confidence: 1.0 },
      { fact: 'HTTPS provides secure communication over the internet', confidence: 1.0 },
      { fact: 'SQL injection exploits unsanitized database queries', confidence: 1.0 },
      { fact: 'XSS attacks execute malicious scripts in user browsers', confidence: 1.0 },
      { fact: 'CSRF attacks trick users into performing unauthorized actions', confidence: 1.0 },
      { fact: 'Multi-factor authentication adds extra security layers', confidence: 1.0 },
      { fact: 'Security headers protect against common web vulnerabilities', confidence: 1.0 },
      { fact: 'Regular security audits identify potential vulnerabilities', confidence: 1.0 }
    ],

    'ai-ml': [
      { fact: 'Machine learning models learn patterns from training data', confidence: 1.0 },
      { fact: 'Neural networks are composed of interconnected nodes', confidence: 1.0 },
      { fact: 'Embeddings represent text as numerical vectors in high-dimensional space', confidence: 1.0 },
      { fact: 'Transformers use attention mechanisms to process sequences', confidence: 1.0 },
      { fact: 'Large Language Models are trained on vast text corpora', confidence: 1.0 },
      { fact: 'Vector databases optimize similarity search for embeddings', confidence: 1.0 },
      { fact: 'HNSW provides efficient approximate nearest neighbor search', confidence: 1.0 },
      { fact: 'Fine-tuning adapts pre-trained models to specific tasks', confidence: 1.0 },
      { fact: 'Quantization reduces model size while preserving accuracy', confidence: 1.0 },
      { fact: 'Hallucination occurs when AI generates false information', confidence: 1.0 }
    ],

    'web-dev': [
      { fact: 'HTML structures web page content and semantics', confidence: 1.0 },
      { fact: 'CSS styles web page appearance and layout', confidence: 1.0 },
      { fact: 'JavaScript adds interactivity to web pages', confidence: 1.0 },
      { fact: 'React is a component-based UI library', confidence: 1.0 },
      { fact: 'RESTful APIs follow stateless architectural principles', confidence: 1.0 },
      { fact: 'GraphQL provides a query language for APIs', confidence: 1.0 },
      { fact: 'Web frameworks simplify application development', confidence: 1.0 },
      { fact: 'Responsive design ensures compatibility across devices', confidence: 1.0 },
      { fact: 'Performance optimization improves user experience', confidence: 1.0 },
      { fact: 'Progressive Web Apps combine web and mobile features', confidence: 1.0 }
    ]
  };

  const facts = domainFacts[domain] || domainFacts.general;

  for (const { fact, confidence } of facts) {
    await truthImmunity.addTruthFact(fact, confidence, `domain-${domain}`);
  }

  console.log(`🔍 Added ${facts.length} ${domain} domain facts to truth immunity system`);
}

/**
 * Create Truth Immunity with OpenAI embeddings
 */
export async function createTruthImmunityWithOpenAI(
  apiKey: string,
  config: TruthImmunityConfig = {}
): Promise<TruthImmunity> {
  // Dynamic import to avoid bundling OpenAI if not used
  const { default: OpenAI } = await import('openai');
  const openai = new OpenAI({ apiKey });

  const embeddingGenerator: EmbeddingGenerator = async (text: string) => {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      dimensions: config.dimensions || 384
    });

    return new Float32Array(response.data[0].embedding);
  };

  return createTruthImmunity(embeddingGenerator, config);
}

/**
 * Create Truth Immunity with Anthropic embeddings (when available)
 */
export async function createTruthImmunityWithAnthropic(
  apiKey: string,
  config: TruthImmunityConfig = {}
): Promise<TruthImmunity> {
  // Placeholder for Anthropic embeddings API
  // For now, fall back to a simple hash-based approach
  const embeddingGenerator: EmbeddingGenerator = async (text: string) => {
    // Simple deterministic embedding based on text content
    const dimensions = config.dimensions || 384;
    const embedding = new Float32Array(dimensions);

    // Generate pseudo-embedding from text hash
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash + text.charCodeAt(i)) & 0xffffffff;
    }

    for (let i = 0; i < dimensions; i++) {
      embedding[i] = Math.sin(hash * (i + 1) * 0.001) * 0.1;
    }

    return embedding;
  };

  return createTruthImmunity(embeddingGenerator, config);
}

/**
 * Create Truth Immunity for testing with mock embeddings
 */
export async function createTestTruthImmunity(
  config: TruthImmunityConfig = {}
): Promise<TruthImmunity> {
  const embeddingGenerator: EmbeddingGenerator = async (text: string) => {
    const dimensions = config.dimensions || 384;
    const embedding = new Float32Array(dimensions);

    // Deterministic mock embeddings for testing
    const words = text.toLowerCase().split(/\s+/);
    for (let i = 0; i < dimensions; i++) {
      let value = 0;
      for (let j = 0; j < words.length; j++) {
        value += words[j].charCodeAt(0) * Math.sin((i + j + 1) * 0.01);
      }
      embedding[i] = value / words.length * 0.01;
    }

    return embedding;
  };

  return createTruthImmunity(embeddingGenerator, {
    ...config,
    databasePath: config.databasePath || './test-data/truth-test.db'
  });
}

/**
 * Benchmark Truth Immunity performance across different embedding providers
 */
export async function benchmarkTruthImmunity(
  providers: Array<{
    name: string;
    immunity: TruthImmunity;
  }>,
  testClaims: string[] = [
    'JavaScript is a programming language',
    'Quantum computers use qubits instead of bits',
    'Machine learning requires training data',
    'SQL injection is a security vulnerability',
    'React is a database system' // False claim
  ]
): Promise<{
  results: Array<{
    provider: string;
    avgSearchTime: number;
    accuracy: number;
    speedup: number;
  }>;
  winner: string;
}> {
  const results = [];

  for (const { name, immunity } of providers) {
    console.log(`Benchmarking ${name}...`);

    const startTime = performance.now();
    let correctDetections = 0;

    for (const claim of testClaims) {
      const result = await immunity.analyze({
        task: { description: claim }
      });

      // Check if false claim was detected (last claim is false)
      if (claim.includes('React is a database') && result.score < 0.5) {
        correctDetections++;
      } else if (!claim.includes('React is a database') && result.score > 0.5) {
        correctDetections++;
      }
    }

    const totalTime = performance.now() - startTime;
    const avgSearchTime = totalTime / testClaims.length;
    const accuracy = correctDetections / testClaims.length;

    // Get speedup from immunity's benchmark
    const benchmark = await immunity.benchmarkPerformance();
    const speedup = benchmark.speedupRatio;

    results.push({
      provider: name,
      avgSearchTime,
      accuracy,
      speedup
    });
  }

  // Determine winner based on combined score (speed + accuracy)
  let bestScore = 0;
  let winner = results[0]?.provider || 'none';

  for (const result of results) {
    const combinedScore = result.accuracy * 1000 - result.avgSearchTime; // Prioritize accuracy
    if (combinedScore > bestScore) {
      bestScore = combinedScore;
      winner = result.provider;
    }
  }

  return { results, winner };
}

export default createTruthImmunity;