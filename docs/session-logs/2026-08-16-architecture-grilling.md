# Session log — 2026-08-16 · Architecture grilling

**Type:** Decision session · **Output:** 11 ADRs, full doc set, repo created · **Code written:** none

---

## What happened

Five rounds of adversarial questioning against the 2026-06-02 scoping doc, working root-first: nothing downstream was asked until its prerequisites were settled. The doc was treated as demolishable, not as a decision record.

## Facts established that changed the plan

| Fact | Consequence |
|---|---|
| The author is a shipping **native macOS developer**, not "a React/TS dev" | Invalidated the prior session's entire Path A/B reasoning |
| **GitHub's engine is open source** (`cmark-gfm`, C) — and Apple ships `swift-markdown` over it | Writing a parser became unjustifiable (ADR-0002) |
| **"Looks like GitHub" is ~80% render layer**, not parsing — highlighting, Mermaid, math, alerts, CSS, sanitization | Reframed the entire effort estimate |
| The origin pain is **100% Apple** (Mac + iPhone + iPad) | Exposed "six platforms" as ambition, not need — named as such in the Brief |
| **Obsidian is closed source** | Killed the two-engine plan; became dialect profiles (ADR-0008) |
| **Safari has no File System Access API** | Web build cannot open cloned repo folders (ADR-0007, ADR-0011) |
| **Tauri is not native**; **Flutter is not native Android** | Exposed the internal inconsistency in "best option for each platform" (ADR-0004) |
| Existing licences: Strict on one repo, **Noncommercial on the three shipped apps** | Corrected the licence choice (ADR-0010) |
| `onemark` free on GitHub and npm | Name confirmed |

## Contradictions surfaced and resolved

1. **"No differentiator" (stated) vs. a differentiator in the origin story (actual).** → ADR-0001.
2. **"All platforms" vs. "I want to ship."** Mutually exclusive at N native UIs. → ADR-0004: one UI, six targets.
3. **"Best per platform" vs. the stack actually chosen** (Tauri and Flutter are not native). → ADR-0004.
4. **App-owned library vs. reading cloned repos** (copies go stale). → ADR-0007: platform-conditional storage.
5. **Two engines vs. the differentiator.** Two engines recreate the exact bug the product exists to fix. → ADR-0003.
6. **"Full live preview" vs. shipping.** Inline preview costs a permanent second parser. → ADR-0006.

## Decisions

All eleven are recorded in [`../adr/`](../adr/) with rejected alternatives. Summary table in [`../../HANDOFF.md`](../../HANDOFF.md).

## Not decided — deliberately

Five open questions remain (PRD §12). Two of them — OQ-3 (`comrak` alert support) and OQ-4 (AST across the WASM boundary) — are scheduled for M0 because both are cheap to test and both affect the foundation.

## Actions taken

- Created `github.com/adhamhaithameid/onemark` — public, empty, `2026-08-16T00:51:26Z`
- Scaffolded `~/Desktop/code/OneMark`, `git init`, remote added
- Wrote: README, LICENSE, CHANGELOG, HANDOFF, docs 00–05, ADRs 0000–0011, two session logs
- **Nothing committed** — committing is blocked pending explicit instruction

## Note on repository dates

A request was made to backdate the repository creation to 2026-06-02. **GitHub stamps `created_at` server-side; it cannot be set by any API, flag or tool.** The repository will permanently read 2026-08-16.

The June date is instead recorded truthfully where it belongs: the origin date in the Brief and PRD, this session-log directory, and the CHANGELOG. Commit dates were not falsified.

## Next action

**M0.3** — get a markdown string through `comrak` compiled to WASM and back into TypeScript as an AST. Nothing else matters until that round-trip works; it validates the whole architecture in a single step.
