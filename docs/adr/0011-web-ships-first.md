# ADR-0011 — Web ships first

**Status:** Accepted · **Date:** 2026-08-16

## Context

Six platforms are in scope (ADR-0004), but building them in parallel solo guarantees nothing ships. One platform had to go first, alone, end-to-end.

The origin pain begins on **macOS**, which argues for macOS first. But web has a materially faster feedback loop: no code signing, no notarization, no store review, no install step — and it exercises the riskiest part of the architecture (the WASM boundary, OQ-4) immediately.

## Decision

**Web ships first (M1). macOS second (M2).**

M2 reuses the entire M1 UI — the Tauri shell wraps the same build — so the second platform costs ~2–4 weeks rather than a second product.

## Alternatives rejected

| Option | Why rejected |
|---|---|
| macOS first | Solves the real pain sooner and plays to the author's strongest platform, but slower iteration (signing, packaging) and it defers the WASM risk that the whole architecture rests on. |
| Everything in parallel | The failure mode this entire plan exists to avoid. |

## Consequences

**Good:** fastest possible proof of the hard part — fidelity and the editor. A public URL exists early, which serves the portfolio goal. The WASM boundary risk is discovered in week one rather than month four.

**Bad / accepted cost — must not be forgotten:** **the web build does not solve the author's daily workflow.** Safari has no File System Access API, so cloned-repo folders cannot be opened (ADR-0007). Web-first proves the engine; **M2 delivers the reason the project exists.**

Do not treat M1 shipping as "the pain is solved." It is not. M2 is.

**Reversibility:** high — reordering milestones costs nothing structural.
