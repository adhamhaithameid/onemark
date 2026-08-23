# ADR-0016 — M1a/M1b perf budgets are arbitrated in a browser, not in Node

**Status:** Accepted · **Date:** 2026-08-22

## Context

Task 1.20 called for the perf harness. The first end-to-end measurement through the
shipping render path (parse → sanitised HTML) produced numbers that make Node arbitration
impossible:

| Measurement (100 KB synthetic doc, Node + jsdom DOM) | Result |
|---|---|
| Engine parse alone | ~300 ms |
| Render + sanitise, no highlighting | ~1.6 s |
| + bundled Shiki highlighting (~230 fences) | +~0.3 s |
| 250 KB sample | **OOMs the default 2 GB Node heap** |
| 1 MB run | exceeded a 15-minute ceiling; abandoned |

The engine's own numbers (ADR-0012: ~30 ms parse @ 100 KB) hold for realistic prose
documents; this synthetic document is construct-dense (tables/alerts/footnotes/code every
~450 bytes), and — decisively — **DOMPurify under jsdom dominates everything**, scaling
super-linearly in both time and memory. jsdom is not a browser (the same lesson as
ADR-0013's mutation-XSS argument): browser DOMPurify operates at orders of magnitude
different cost.

## Decision

1. **M1a (< 100 ms @ 100 KB) and M1b (< 500 ms @ 1 MB) are arbitrated by a browser-side
   harness in the deployed app**, landing with task 1.22 — same harness shape as
   `bench/test/perf-floor.test.ts`, running against WKWebView/Chromium via Playwright.
2. The Node suite remains as a **floor**: it proves the path completes end-to-end and
   records medians so order-of-magnitude regressions stay visible. It asserts no budget.
3. The super-linear sanitiser scaling is recorded as a risk to re-check in the browser;
   if browser numbers also blow the budget, the documented hybrid fallback (tech spec §5)
   and sanitiser-streaming work become live options — decided then, on data.

## Alternatives rejected

| Option | Why rejected |
|---|---|
| Keep Node gates with inflated budgets (~2 s) | Arbitrary numbers with no fidelity to any user-visible device; false confidence either way |
| Drop perf gates entirely | G2 forbids unverifiable claims; the tiers exist in PRD §5.2 |
| Optimise the Node path now | Optimising jsdom-DOMPurify optimises nothing a user runs; premature without browser data |

## Consequences

**Good:** CI stays honest (no meaningless red), the measurement harness exists and is
recorded, and the decision point is pinned to a concrete deliverable (deploy).

**Bad / accepted cost:** M1a/M1b are unverified until deployment; PRD §5.2's caveat about
render-layer headroom stays open longer than planned.

**Reversibility:** high — the browser harness replaces the floor suite one-for-one.
