# ADR-0015 — Present-layer fidelity is verified by assertions, never by eye

**Status:** Accepted · **Date:** 2026-08-22

## Context

Task 1.4 (GitHub Markdown CSS, light and dark) is the first build-plan task whose verify
column reads "visual match on a reference document". As written it is unfalsifiable — G2
(fidelity must be provable; PRD §3) forbids a claim that cannot fail a build. The same
problem will recur for every present-layer task that follows: Shiki themes (1.5), KaTeX
fonts (1.6), Mermaid output (1.7), theme switching (1.18).

"Looks right to me" is exactly the marketing G2 outlaws.

## Decision

Every present-layer task is verified by three assertion layers, all CI-runnable, no human
eye anywhere in the gate:

1. **Structural** — the rendered reference fixture carries the expected DOM shape
   (elements, classes, nesting) per theme.
2. **Computed-style** — key properties (font stacks, code-block background, table borders,
   alert colours, link colours) are asserted against **reference values vendored from
   `github-markdown-css`** (pinned version, MIT licence, attribution committed alongside).
   Both light and dark are asserted. Reference values are data, reviewed like code.
3. **Screenshot diff** — Playwright renders the reference document in both themes;
   screenshots diff against committed reference PNGs under a pixel threshold. Failures
   emit a visual diff artifact. Runs in the opt-in browser suite (same harness as the
   security matrix), blocking at task 1.20 when the perf/visual CI lands.

The verify column of task 1.4 therefore becomes: *computed-style suite green in both
themes against vendored `github-markdown-css` values + screenshot diff within threshold on
the reference fixture*.

## Alternatives rejected

| Option | Why rejected |
|---|---|
| Eyeball approval ("looks like GitHub") | Unfalsifiable; violates G2 directly |
| Fetch github.com CSS at test time | Network-dependent flake; GitHub can change styles without notice; violates reproducibility |
| Pixel-diff only | Fragile alone (font raster differs per platform); kept as layer 3, not the whole gate |
| Assert OneMark's CSS text against upstream file byte-for-byte | Vendoring means we own deltas (alerts, truncation marker); byte-equality would forbid deliberate divergences |

## Consequences

**Good:** every "matches GitHub" claim from 1.4 onward can fail a build; theme regressions
are caught in CI, not by the author's eye weeks later; the vendored reference makes the
target version explicit and upgradable as a decision.

**Bad / accepted cost:** reference PNGs and style tables are more artifacts to maintain;
upgrading the pinned `github-markdown-css` version requires re-baselining references —
deliberately frictional, since an upgrade is a fidelity change and must be one.

**Reversibility:** high — layers are independent; dropping layer 3 does not weaken layers 1–2.
