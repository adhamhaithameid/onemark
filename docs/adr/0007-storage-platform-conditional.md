# ADR-0007 — Storage is platform-conditional: folders on desktop, OPFS on web

**Status:** Accepted · **Date:** 2026-08-16

## Context

The primary user story is *"read READMEs from cloned repos"* — which requires **folder** access. But the first shipping target is web (ADR-0011), and:

**Safari does not implement the File System Access API** (`showDirectoryPicker`). It is Chromium-only. The author's devices are Apple. A web build therefore **cannot** open a cloned repo folder — not as a limitation to work around, but as an absolute.

Safari does support **OPFS** (Origin Private File System, 16.4+) — an app-private sandbox that documents must be *imported* into.

This created a genuine contradiction: an app-owned library means copies, and copies go stale when `git pull` runs.

## Decision

**One `StorageProvider` interface, two implementations, selected by platform capability:**

| Platform | Implementation | Behavior |
|---|---|---|
| Web | `OpfsStorage` | Drag/drop, paste, app-owned library. No folder access — impossible. |
| Desktop / mobile (Tauri) | `FolderStorage` | Open a real folder by reference. Always fresh. No copies. |

**The UI branches on `capabilities`, never on platform name.** That is what keeps web and desktop a single codebase.

## Alternatives rejected

| Option | Why rejected |
|---|---|
| Folder access only | Impossible on web in Safari. Would mean no web target at all. |
| App-owned library only | Copies go stale; `git pull` would not update them. Contradicts the primary user story. |
| Sync between devices (iCloud/git) | The honest fix for "same notes on Mac and iPad", but it is an explicit non-goal — it brings accounts, conflict resolution and a server, and would end the zero-network guarantee. |

## Consequences

**Good:** each platform gets the best storage model it can actually support, behind one interface. No sync problem, no accounts, no server — the zero-network guarantee (M2) holds.

**Bad / accepted cost — stated plainly rather than discovered in month three:** the **web build does not deliver the author's daily workflow.** Reading cloned repos arrives at M2 (macOS). Web-first exists to prove fidelity and the editor fast, not to be the product.

Additionally, the iPad half of the original pain stays unsolved until M4, and even then without sync the iPad experience is import-based.

**Reversibility:** high — adding a third provider later (sync) is an interface implementation, not an architecture change.
