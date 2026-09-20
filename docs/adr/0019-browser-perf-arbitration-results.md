# ADR-0019: Browser perf arbitration — results and the honest path forward

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-09-20 |
| Deciders | Author (delegated to the campaign; ADR-0016 anticipated this decision) |
| Amends | ADR-0016 (browser arbitration), PRD §5.2 metrics M1a/M1b |

## Context

ADR-0016 moved the M1a/M1b latency budgets out of Node (jsdom OOMs, super-linear
sanitiser scaling) and into a real browser: `scripts/perf-arbitrate.mjs` drives
the deployed app (GitHub Pages, Chromium, headless) through the real user path —
paste a document into the CodeMirror source pane, measure paste-to-preview-update.
The harness reports raw wall time and debounce-adjusted time (the live preview
debounces 150 ms by design); budgets are judged on the adjusted number.

The first harness draft weighted code fences ~50× reality (one per 180 bytes) and
measured Shiki, not OneMark. It was rebalanced to a prose-heavy mix — paragraphs,
lists, tables, alerts, one fence per ~8 KB — before these numbers were recorded.

## Results (deployed app, headless Chromium, median of 5 cold runs)

| Tier | Size | Budget | Adjusted median | Verdict |
|---|---|---|---|---|
| Real §4 workload | 20 KB | — (informational) | **79 ms** | **within M1a's budget** |
| M1a | 100 KB | < 100 ms | 411 ms | **FAIL** (~4×) |
| M1b | 1 MB | < 500 ms | 32 541 ms | **FAIL** (~65×) |

Raw samples are committed alongside this ADR (`docs/perf/`).

## Interpretation

- **The size the PRD §4 actually describes renders within budget.** A 20 KB
  document — the "typical document" the done-line points at — adjusts to 79 ms,
  under the 100 ms bar. The app is usable for its primary workload today.
- **M1a fails honestly at 100 KB**, and M1b fails decisively. Scaling is
  super-linear, consistent with ADR-0016's sanitiser finding: `renderToSafeHtml`
  runs parse+render+DOMPurify as one main-thread pass, and DOMPurify's cost
  grows faster than document size. Shiki on fence-heavy documents is the second
  cost centre.
- The M1c tier (never block the UI thread) is separately satisfied by
  architecture: parsing already runs in a worker; **rendering does not yet** —
  that is the first ladder rung below.

## Decision

1. **v0.1.0 ships with honest numbers.** The release notes state exactly this:
   fidelity proven (M3/M4/M5), 20 KB documents render in budget, the 100 KB/1 MB
   tiers do not hold yet. The done-line sentence is *not yet literally true at
   its 100 KB clause*; nothing in the release claims otherwise.
2. **The performance ladder is scheduled, in order of measured leverage:**
   1. Move render + sanitisation into the parse worker (M1c is currently met by
      parse-only off-threading; render+sanitise still runs on the main thread).
   2. Stream or chunk sanitisation (DOMPurify per-chunk) to attack the
      super-linearity directly.
   3. Shiki: lazy per-language grammars and an off-thread highlight pass.
   4. Preview virtualisation above ~200 KB (render the viewport, not the tree).
   5. Re-arbitrate after each rung; each rung lands with numbers in this ADR's
      successor.
3. **M1a/M1b budgets are re-targeted, not deleted.** They stay in the PRD as
   gates for the performance milestone; v0.1.0's honest state is the baseline
   every rung measures against. A relaxation is only acceptable if the ladder is
   exhausted — and it has not been attempted yet.

## Rejected alternatives

- **Relax the budgets now** — hides un-attempted wins behind a document edit.
  ADR-0012 re-scoped a budget that was ~50× mis-sized *with measurements*; the
  same discipline applies in reverse: no relaxation before the ladder runs.
- **Ship a spinner/loading state and call M1b satisfied** — M1c is a
  non-blocking requirement, not a latency requirement; conflating them would be
  moving the goalposts mid-game.
- **Ignore and release silently** — violates the project's core premise that
  claims are verified, not asserted.
