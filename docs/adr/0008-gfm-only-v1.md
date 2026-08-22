# ADR-0008 — GFM only in v1; Obsidian-compatibility profile deferred

**Status:** Accepted · **Date:** 2026-08-16

## Context

A proposal was made to combine GitHub's and Obsidian's engines with a user-controlled switch.

**Obsidian is not open source.** The application is proprietary and closed-source. There is no engine to pull.

What *does* exist is Obsidian's publicly documented **dialect**: `[[wikilinks]]`, `![[embeds]]`, `> [!callout]`, `#tags`, block references `^id`, YAML frontmatter, MathJax, Mermaid. That dialect is implementable — as **profiles over one engine**, not as two engines glued together.

Separately, "GitHub fidelity" is already larger than it looks: the GFM spec covers tables, task lists, strikethrough, autolinks and footnotes, but github.com *also* does syntax highlighting, Mermaid, math, alerts, emoji, sanitization and its own CSS. **The parser is roughly 20% of "looks like GitHub"; the render layer is the other 80%.**

## Decision

**v1 supports GFM only.** The dialect-profile system — including an Obsidian-compatible profile and the user-facing switch — is **v2**.

The `ParseOptions.dialect` field exists in the interface from day one so the profile system has a place to land.

## Alternatives rejected

| Option | Why rejected |
|---|---|
| Both dialects in v1 | Doubles the fidelity surface before a single dialect is correct. |
| GFM + only wikilinks and callouts | Tempting middle ground, but it means shipping a dialect that is neither GFM-exact nor Obsidian-compatible — the worst of both, and it breaks the differentiator. |
| Two engines with a switch | Impossible (Obsidian is closed source) and would violate ADR-0003. |

## Consequences

**Good:** one dialect, done exactly, and the differentiator stays testable. Profiles become meaningful only once there is a correct baseline to be a profile *of*.

**Bad / accepted cost:** Obsidian users get nothing in v1. Files containing `[[wikilinks]]` render them as literal text — which is, correctly, what GitHub does.

**Reversibility:** high — `ParseOptions.dialect` is the designated extension point.
