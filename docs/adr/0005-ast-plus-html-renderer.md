# ADR-0005 — Engine emits an AST; a bundled HTML renderer consumes it

**Status:** Accepted · **Date:** 2026-08-16

## Context

With `comrak` behind a `MarkdownEngine` interface, the interface's *output type* had to be decided. Options: an HTML string, a serializable AST, or both.

This is a one-way-door risk: an HTML-string interface is trivially fast in a webview but useless to any native renderer (SwiftUI, Compose), permanently foreclosing the native Apple track kept open by ADR-0004.

## Decision

**The AST is the contract.** A bundled HTML renderer is one consumer of it.

```
comrak → AST → ┬→ HtmlRenderer (TS)  ← ships today, serves all six platforms
               └→ future native renderer  ← consumes the same AST
```

The AST includes **source positions**, required for scroll synchronization and for the inline live preview deferred in ADR-0006.

## Alternatives rejected

| Option | Why rejected |
|---|---|
| HTML string only | Fastest and simplest, but a one-way door — no native renderer could ever consume it. |
| AST only, every platform writes its own renderer | Maximum portability, but every native UI would need a full renderer. Given ADR-0004 there is exactly one UI, so this is pure cost. |

## Consequences

**Good:** costs almost nothing today (one HTML renderer either way) and preserves the native path entirely. Also produces a clean layering that makes fidelity bugs diagnosable — parse layer vs render layer vs present layer.

**Bad / accepted cost:** the AST must cross the WASM boundary on the web target, and serialization cost scales with document size. **This is the single biggest threat to metric M1 (5 MB < 200 ms)** and is tracked as open question OQ-4, to be benchmarked in M0.

Planned fallback if the benchmark fails: a hybrid — block-level HTML generated inside Rust, with the AST exposed only for nodes the renderer must post-process (code blocks, math, Mermaid).

**Reversibility:** high for the fallback; low for abandoning the AST entirely, since that would close the native door.
