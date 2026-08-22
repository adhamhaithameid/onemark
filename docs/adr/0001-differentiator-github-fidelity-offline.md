# ADR-0001 — Differentiator: GitHub-identical rendering, offline, everywhere

**Status:** Accepted · **Date:** 2026-08-16

## Context

The initial framing was "cross-platform markdown read/write", which is not a product — Obsidian, Typora, iA Writer and CodeMirror+markdown-it all do that. Without a sharp differentiator, every downstream technical decision is unanchored.

When pressed for the origin pain, the answer was concrete: *markdown that renders correctly on github.com cannot be viewed that way locally on a Mac, and there is no good way to view or create it on iPhone/iPad.* The author initially self-assessed as having **no** differentiator; the origin story contained one.

## Decision

> **GitHub-identical Markdown rendering, offline, on every device — because GitHub's fidelity currently only exists inside github.com.**

Fidelity is the product. It must be **provable**, not asserted — see ADR-0003 and PRD §8.

## Alternatives rejected

| Option | Why rejected |
|---|---|
| No differentiator; pure learning project | The origin story contained a real one. Accepting "none" would have optimized for depth and produced something the author wouldn't use daily. |
| Compete with Obsidian on features | Unwinnable solo, and licenses infinite scope. |
| Niche audience (students, RTL writers, academics) | Not the author's actual pain; would be inventing a user. |
| A specific workflow integration | No candidate workflow emerged from the origin story. |

## Consequences

**Good:** every scope question now has an objective test — does it move fidelity, or not? It also produces a *measurable* claim (diff against GitHub's own renderer) rather than a marketing one.

**Bad / accepted cost:** the gap is genuinely thin. QLMarkdown covers Mac viewing (view-only, not GFM-exact) and Working Copy covers iOS (preview not GFM-exact). The differentiator is real but narrow, and it only stays real if fidelity is actually achieved — a half-faithful renderer differentiates from nothing.

**Reversibility:** cheap to restate, expensive to abandon — it is load-bearing for ADR-0003, 0008 and the entire verification strategy.
