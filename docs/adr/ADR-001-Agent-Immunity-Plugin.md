# ADR-001: Agent Immunity Plugin for Claude-Flow

**Status**: Proposed  
**Date**: 2026-02-01  
**Author**: JLMA Agentic AI Team  

---

## TL;DR

A lightweight (~500 LOC) plugin that intercepts agent actions, analyzes against health vectors, and suggests repairs—**100% reusing existing CF infrastructure**.

---

## Problem

**Agentic Drift**: Autonomous agents may:
- Violate coding standards (Doctrine)
- Introduce security vulnerabilities
- Hallucinate non-existent APIs/paths
- Lose coherence (big refactor when asked for "fix typo")
- Enter infinite loops burning tokens

Current defenses are **reactive** (post-commit CI). AIS is **proactive** (pre-commit interception).

---

## Decision

Implement `@claude-flow/agent-immunity` as a **lightweight CF plugin** (~500 LOC).

### What We Reuse (Zero Reinvention)

| Component | CF Package | Usage |
|:----------|:-----------|:------|
| **Hooks** | `@claude-flow/hooks` | `PreAgentAction`, `PostAgentAction` events |
| **Security Analysis** | `@claude-flow/aidefence` | ThreatDetector, PII scanner, 50+ patterns |
| **Truth Check** | `@claude-flow/memory` | HNSW embeddings for hallucination detection |
| **Learning** | `AgenticFlowBridge` | ReasoningBank pattern storage |
| **Fleet Broadcast** | `@claude-flow/swarm` | `cf_hive` for immunity pattern sharing |
| **Semantic Embeddings** | `@ruvector/sona` | Intent vs Code coherence |

### What We Build (~500 LOC)

| File | LOC | Description |
|:-----|:----|:------------|
| `plugin.ts` | ~80 | Hook registration, initialization |
| `vector-service.ts` | ~120 | Orchestrates all analyzers, computes score |
| `vectors/performance.ts` | ~50 | Regex patterns for O(n²), sync I/O |
| `vectors/dependencies.ts` | ~50 | Lockfile hash, license check |
| `vectors/coherence.ts` | ~100 | Semantic diff (intent vs code) |
| `antibody.ts` | ~100 | Wraps aidefence suggestions |
| **Total** | **~500** | |

---

## Architecture

```mermaid
flowchart LR
  subgraph "@claude-flow/agent-immunity"
    H["Hook: PreAgentAction"]
    V["VectorService"]
    A["Antibody"]
  end
  
  subgraph "Reused CF Components"
    AD["@claude-flow/aidefence"]
    MEM["@claude-flow/memory"]
    SONA["@ruvector/sona"]
    HIVE["cf_hive"]
  end
  
  Agent["CF Agent"] -- "trajectory step" --> H
  H --> V
  V --> AD
  V --> MEM
  V --> SONA
  V -- "unhealthy" --> A
  A -- "repair suggestion" --> Agent
  A -- "pattern" --> HIVE
```

---

## Health Vectors

### Core (Always Enabled)

| Vector | Weight | Implementation |
|:-------|:-------|:---------------|
| **Security** | 0.30 | `aidefence.analyze()` |
| **Truth** | 0.25 | HNSW similarity check for hallucinations |
| **Coherence** | 0.25 | SONA embeddings: `cosine(intent, code)` |
| **Performance** | 0.10 | Regex: `readFileSync`, nested loops |
| **Dependencies** | 0.10 | Lockfile hash, CVE check |

### Extended (Opt-In)

| Vector | Implementation |
|:-------|:---------------|
| Privacy/PII | `aidefence.containsPII()` |
| Cost/Tokens | Token counter, loop detector |
| Observability | AST check for logging calls |

---

## Core Loop

```typescript
// plugin.ts
import { HookBuilder, HookEvent, HookPriority } from '@claude-flow/plugins';
import { createAIDefence } from '@claude-flow/aidefence';
import { VectorService } from './vector-service';
import { Antibody } from './antibody';

const aidefence = createAIDefence();
const vectors = new VectorService({ aidefence });
const antibody = new Antibody();

export const immunityHook = new HookBuilder(HookEvent.PreAgentAction)
  .withName('immunity-scan')
  .withPriority(HookPriority.Critical)
  .handle(async (ctx) => {
    const report = await vectors.analyze(ctx.data.trajectory);
    
    if (report.score < 0.7) {
      const suggestion = await antibody.synthesize(report);
      return { abort: true, suggestion };
    }
    
    return { continue: true };
  })
  .build();
```

```typescript
// vector-service.ts
export class VectorService {
  async analyze(step: TrajectoryStep): Promise<ImmunityReport> {
    const results = await Promise.all([
      this.security.analyze(step),   // aidefence
      this.truth.analyze(step),       // HNSW
      this.coherence.analyze(step),   // SONA
      this.performance.analyze(step), // regex
      this.dependencies.analyze(step) // lockfile
    ]);
    
    return {
      score: this.weightedAverage(results),
      violations: results.filter(r => !r.passed),
      timestamp: Date.now()
    };
  }
}
```

---

## Directory Structure

```
v3/@claude-flow/agent-immunity/
├── package.json
├── README.md
├── src/
│   ├── index.ts           # Exports
│   ├── plugin.ts          # Hook registration
│   ├── vector-service.ts  # Orchestrator
│   ├── antibody.ts        # Repair suggestions
│   └── vectors/
│       ├── security.ts    # Wraps aidefence
│       ├── truth.ts       # HNSW check
│       ├── coherence.ts   # SONA semantic diff
│       ├── performance.ts # Regex patterns
│       └── dependencies.ts # Lockfile check
└── __tests__/
    └── vector-service.test.ts
```

---

## Verification Plan

1. **Unit Tests**: Each vector analyzer
2. **Integration Test**: Mock agent trajectory → verify blocking
3. **Latency Benchmark**: Target `<30ms` per step
4. **Fleet Test**: Verify `cf_hive` pattern broadcast

---

## Consequences

### Positive
- **~500 LOC** total (minimal surface area)
- **Zero reinvention** (100% reuses CF infra)
- **Proactive** defense (pre-commit)
- **Fleet learning** via `cf_hive`

### Negative
- Adds ~20-30ms latency per action
- Potential false positives

### Mitigations
- Confidence threshold (0.7 default)
- Dry-run mode for tuning
- Human-in-the-loop for low-confidence blocks

---

## References

- [ADR-055: AQE Agent Immunity Domain](../../../agentic-qe/v3/docs/ADR-055-Agent-Immunity-Domain.md) (Alternative implementation for QE context)
- [@claude-flow/aidefence](../../v3/@claude-flow/aidefence/)
- [@claude-flow/hooks](../../v3/@claude-flow/hooks/)
