# OneMark — Project Brief

| Field | Value |
|---|---|
| Originated | 2026-06-02 |
| This revision | 2026-08-16 |
| Status | Approved |

---

## The one sentence

> **GitHub-identical Markdown rendering, offline, on every device — because GitHub's fidelity currently only exists inside github.com.**

## The origin

The author writes markdown for GitHub and knows GFM well. Two frictions produced this project:

1. **On macOS**, there is no easy way to view a `.md` file from a cloned repo as GitHub renders it.
2. **On iPhone and iPad**, viewing or creating markdown means accepting a different dialect entirely.

The workaround was pushing to GitHub and opening a browser — a network round-trip to read a file already on disk.

## Why the obvious alternatives don't close it

| Alternative | Gap |
|---|---|
| Just use github.com | Requires network and a push |
| QLMarkdown | View-only, macOS-only, not GFM-exact |
| Obsidian | Different dialect. `[[wikilinks]]`, callouts, no GFM-exact alerts |
| Typora | Own dialect, closed source, desktop only |
| VS Code preview | markdown-it, not GFM-exact, desktop only |
| Working Copy | Preview isn't GFM-exact, iOS only |

The gap is **thin but genuine**: nothing gives GitHub-identical rendering — including Mermaid, math, alerts and highlighting — offline, with the same output on Mac and iPad, over files you also edit.

## Honest framing

This project is **not** primarily a market opportunity. It is, in ranked order:

1. A tool the author will use daily
2. A large-scale, genuinely cross-platform systems project — the stated ambition
3. A portfolio artifact
4. Something strangers may find useful

Goal 4 is a consequence, never a driver. Naming this openly is what keeps the scope honest: a product chasing users would add sync, accounts and a plugin marketplace. OneMark does not, and the non-goals list in the PRD is binding.

## Audience

**User #1: the author.** READMEs and docs from cloned repos on macOS; light editing on iPad. Files under 100 KB, dozens per week, mostly read.

**Secondary: developers** who write GFM and want to see it correctly without pushing first.

**Not targeted:** general note-takers, students seeking a study tool, prose writers. Those audiences license infinite features.

## The ambition, stated plainly

Part of this project's purpose is *"to have built something fully cross-platform and large scale."* That is an ambition, not a user need — the actual pain is Apple-only. **Naming it as an ambition is what keeps it from silently distorting v1.** The architecture serves the ambition (one engine, six targets) while the *sequencing* serves the pain (macOS second, right after web).

## Non-negotiables

1. **Zero first-party server round-trips.** No document ever leaves the device to be rendered.
2. **One engine.** Two parsers would recreate the exact bug this project exists to fix.
3. **Fidelity must be provable.** A claim that cannot fail a build is marketing.
4. **Ship over perfect.** Every milestone is independently usable.

## Constraints

| Constraint | Consequence |
|---|---|
| Solo developer | No parallel platform work. Strict sequencing. |
| Bandwidth varies from zero to full-time | Milestones must be individually shippable; ADRs must record *why*, so a three-week gap doesn't restart the reasoning. |
| Author is strongest in Swift/macOS and TypeScript | Rust is new. The Rust surface is deliberately small (one crate + one binding + the Tauri shell). |
| No budget | Everything must be free/open tooling. |
