# ADR-0012 — The latency budget is scoped to real documents, not a synthetic 5 MB file

**Status:** Accepted · **Date:** 2026-08-18 · **Amends:** [PRD §5.1, §5.2](../02-PRD.md) · **Preserves:** [ADR-0005](0005-ast-plus-html-renderer.md)

## Context

M1 required a 5 MB markdown file to reach first paint in under 200 ms. That number was chosen before any code existed. M0 measured it.

Reference Mac, release build, 9 runs after warmup. Engine only — no syntax highlighting, math, diagrams, CSS or DOM insertion:

| Document | Native parse | Native A (AST→JSON) | **WASM A (end-to-end)** | **WASM B (HTML)** |
|---:|---:|---:|---:|---:|
| 100 KB | 4.6 ms | 5.4 ms | **30.0 ms** | 6.7 ms |
| 1 MB | 33.6 ms | 65.1 ms | **335.0 ms** | 80.0 ms |
| 5 MB | 186.0 ms | 389.5 ms | **1640.7 ms** | 352.7 ms |

Three facts fell out:

1. **Native parsing alone consumes 186 ms of the 200 ms budget at 5 MB** — 93%, before transport, rendering, or the webview.
2. **WASM is ~4× slower than native** for design A at 5 MB, and the AST-as-JSON payload is **16.9× the source size** (5 MB in, 82.7 MB out). Restricting positions to block-level nodes halves the payload but not the time; the cost is JSON encoding itself.
3. **At the size the PRD actually describes, none of this matters.** [PRD §4](../02-PRD.md) states the target user's files are "typically under 100 KB". There, design A costs 30 ms end-to-end.

The 5 MB figure is roughly **50× the stated real workload**, and it was the only thing forcing a move to design B — which would have partially undone ADR-0005.

## Decision

**Scope the latency budget to the documents the product is actually for**, and replace the single 5 MB gate with tiered budgets:

| ID | Document | Target | Rationale |
|---|---|---|---|
| **M1a** | 100 KB — the real workload | first paint **< 100 ms** | Engine measured at 30 ms; leaves 70 ms for the render layer |
| **M1b** | 1 MB — the large-document case | first paint **< 500 ms** | Engine measured at 335 ms; deliberately loose |
| **M1c** | 5 MB — the pathological case | **must not block the UI thread**; no first-paint gate | A latency target here buys nothing a real user experiences |

M1c is a *responsiveness* guarantee, not a latency one: parsing runs off the main thread (NFR-3) and the UI stays interactive while a 5 MB document renders.

**Consequence for ADR-0005: it stands unchanged.** Design A — the AST as the contract — is viable at the real workload. The AST keeps its source positions, and the future native-renderer door stays open.

## Alternatives rejected

| Option | Why rejected |
|---|---|
| Keep 5 MB / 200 ms, adopt design B (HTML inside Rust) | Partially undoes ADR-0005: the renderer moves to Rust, the AST stops being the contract, and the native-Apple track closes. Buys a number no real user experiences. Measured 352 ms in WASM anyway — it would *still* miss the 200 ms gate. |
| Keep 5 MB / 200 ms and accept the gate goes red | Violates G2: a metric that is known-failing is not a gate, it is a permanently broken build. Worse than no metric — teams learn to ignore red. |
| Keep 5 MB / 200 ms, adopt the hybrid (block HTML + partial AST) | Real option, but it buys the pathological case at the cost of permanent complexity in the one interface the architecture rests on. Deferred, not discarded — see Reversibility. |
| Drop latency metrics entirely | Fidelity is provable and performance should be too. An unmeasured budget silently rots. |
| Set the budget from the synthetic corpus | The synthetic document is ~10 nodes per 100 bytes — denser than real READMEs. Budgets set on it would be pessimistic in a way that distorts design. |

## Consequences

**Good:**
- The budget now measures something a user experiences. G1 (ship) is served rather than obstructed.
- ADR-0005 survives intact — the AST stays the contract, positions stay, the native track stays open.
- Three tiers make degradation explicit instead of a cliff at one number.

**Bad / accepted cost:**
- OneMark will be visibly slow on a 5 MB markdown file. Accepted: that is not a document the target user has, and the UI stays responsive.
- The tiers are set from **engine-only** measurements. The render layer — Shiki, KaTeX, Mermaid, sanitisation, CSS — is ~80% of "looks like GitHub" and is entirely unmeasured. **M1a's 70 ms of headroom is an assumption, not a finding.**
- More numbers to keep honest in CI than one.

**Reversibility:** Cheap. The budgets are constants in the benchmark harness. If M1 shows the render layer eats the headroom, the first move is the hybrid transport (already specified in tech spec §5), then re-tiering. Revisit when the render layer is first measured end-to-end — that is a scheduled event, at task 1.20.
