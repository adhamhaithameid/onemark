# ADR-0006 — Split-view editor for v1; inline live preview deferred

**Status:** Accepted · **Date:** 2026-08-16

## Context

"Full live preview" is three different products:

| Mode | Behavior | Example |
|---|---|---|
| **Split view** | Source pane + rendered pane, scroll-synced | GitHub's Edit/Preview |
| **Inline live preview** | One pane; `**bold**` becomes bold in place, markers fade when the cursor leaves | Obsidian |
| **True WYSIWYG** | Syntax never visible | Typora |

The decisive fact: **inline live preview requires a second parser, permanently.** CodeMirror 6 decorates using its own incremental parser (Lezer), while `comrak` remains canonical for rendering and export. Every dialect feature — callouts, wikilinks, alerts — would then be implemented **twice**, once as a Lezer extension and once as an engine extension.

That is a permanent tax, on a project already carrying six platforms.

## Decision

**v1 ships split view.** Source pane (CodeMirror 6, markdown syntax coloring) + rendered pane, live-updating and scroll-synced.

**Inline live preview is v2**, upgraded in place. Both modes use CodeMirror 6 for the text pane, so choosing split view now costs nothing later.

## Alternatives rejected

| Option | Why rejected |
|---|---|
| Inline live preview in v1 | Permanent double-parser tax; large build; the stated pain is *reading*, not typing feel. |
| True WYSIWYG | Hardest to build, and markdown round-trips become lossy — unacceptable for a fidelity product. |
| Plain textarea, no CodeMirror | Would forfeit undo/redo, IME, mobile touch, accessibility and virtualized scrolling — all of which CM6 provides free. |

## Consequences

**Good:** ships the reading experience immediately, which is the actual pain. CodeMirror 6 supplies ~80% of an editor at no cost. One parser stays canonical, preserving ADR-0003's determinism property.

**Bad / accepted cost:** split view is a less impressive demo than Obsidian-style inline preview, and it uses more horizontal space — a real constraint on iPad and phone (M4).

**Reversibility:** high — this is precisely why CodeMirror 6 is chosen now rather than a textarea.
