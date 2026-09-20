# ADR-0022: The sanitiser needs a complete DOM — worker rungs revised

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-09-20 |
| Deciders | Author (delegated to the campaign) |
| Amends | ADR-0019 (performance ladder rung 1) |

## Context

ADR-0019's first ladder rung was "move render + sanitisation into the worker".
DOMPurify requires a DOM, and workers have none, so the rung implied a
lightweight DOM shim. That assumption has now been **tested and falsified**:

| Host | DOMPurify `isSupported` | Actual behaviour |
|---|---|---|
| **linkedom** | `undefined` (falsy) | **Silent no-op** — hostile input passes through unchanged. An invisible XSS hole. |
| **happy-dom** | `true` | **Worse than a no-op** — reports support, then its parser mishandles sanitisation: `<script>` and `javascript:` hrefs survive. |
| jsdom / real browsers | `true` | Correct (the existing 93-vector corpus proves it). |

Both failures were caught by tests written *before* any worker wiring existed —
the exact reason the project demands proof over assumption.

## Decision

1. **The sanitiser always runs on a complete DOM** (browser or jsdom). The
   worker path may render and highlight, but sanitisation stays on the main
   thread until a host passes the invariant checks below.
2. **Fail closed, twice.** `sanitiseHtml` now (a) throws when DOMPurify
   reports no support, and (b) scans its own output for element-borne
   executable residue (`<script`, inline handlers, `javascript:` URLs) and
   throws if any survives — the belt that catches half-supported hosts like
   happy-dom. Guard tests pin both behaviors, plus the jsdom false-positive
   check, in `packages/renderer/test/linkedom.test.ts`.
3. **Ladder revision.**
   - Rung 1 (shipped 2026-09-20): render + Shiki highlighting move to the
     worker; sanitisation and math hydration stay on the main thread behind
     the fail-closed guard. M1c win: the main thread no longer renders.
   - **Rung 2 (shipped 2026-09-21): chunked sanitisation.** The renderer emits
     top-level blocks (`renderToUnsafeBlocks`); each block is sanitised
     independently and the output reassembled with the renderer's own block
     discipline (`joinBlocks`). Byte-equivalence with whole-string
     sanitisation is proven across the ENTIRE CommonMark + GFM corpora
     (`test/chunked.test.ts`). Arbitrated on the deployed app:

     | Tier | Before rung 2 | After rung 2 |
     |---|---|---|
     | Real workload (20 KB) | 87 ms adj ✅ | 95 ms adj ✅ |
     | M1a (100 KB, <100 ms) | 411 ms adj ❌ | **310 ms adj ❌ (−25%)** |
     | M1b (1 MB, <500 ms) | 27.4 s adj ❌ | **9.5 s adj ❌ (−65%)** |

     The super-linear term is broken (M1b improved ~3× while M1a improved
     ~1.3×). Raw samples: `docs/perf/2026-09-21-rung2.json`.
   - Rungs 3+ (lazy per-language grammars, preview virtualisation) unchanged.

## Rejected alternatives

- **linkedom in the worker** — silently disables the sanitiser. Fatal.
- **happy-dom in the worker** — reports support and passes scripts. Worse:
  it looks correct in a superficial test.
- **A custom DOM-free sanitiser for worker output** — ADR-0013's whole point
  is to wrap a proven sanitiser, not grow a second one.
- **Skip worker rendering entirely** — M1c's "must not block the UI thread"
  is a PRD metric, and typing responsiveness on large documents is real user
  value independent of the wall-time budgets.

## Consequences

- `renderToSafeHtml` is refactored into exported steps — `renderToUnsafeHtml`
  (anywhere), `sanitiseHtml` (complete DOM only), `hydrateMathInHtml`
  (anywhere) — so the app composes them across the worker boundary without
  duplicating the pipeline.
- Any future host (new DOM shim, new runtime) must pass the invariant guard
  tests before the sanitiser will run on it — by construction, since it will
  throw otherwise.
