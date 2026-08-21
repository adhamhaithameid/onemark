# Handoff — OneMark, security audit + hardening session

**Date:** 2026-08-21 · **Repo:** `~/Desktop/code/OneMark` · **Commits: 0** (nothing has ever been committed)

Next session's focus: **review the codebase, confirm the plan, separate done from not-done, restate goals and acceptance criteria.** This document is written for exactly that.

---

## 1. Read these first — do not re-derive

Everything about scope, architecture and decisions already exists in the repo. Read, don't rebuild.

| Path | What it holds |
|---|---|
| `HANDOFF.md` | Project-level handoff: decisions table, done-line, next action |
| `docs/02-PRD.md` | Goals G1–G5, non-goals, **acceptance metrics M1a/M1b/M1c, M2–M6**, open questions OQ-1…OQ-6 |
| `docs/03-Technical-Spec.md` | Repo layout, `MarkdownEngine`/`StorageProvider` interfaces, WASM boundary §5, sanitisation rules §6, CI gates §8 |
| `docs/04-Build-Plan.md` | M0–M4, every task with a verify column. **The task list and its status live here.** |
| `docs/adr/` | 13 ADRs with rejected alternatives. 0012 (latency budget) and 0013 (sanitiser) are the recent ones |
| `docs/session-logs/2026-08-18-m0-foundation.md` | M0 + tasks 1.1–1.3, including corrections made |

**Do not restate these in a new document.** Update them in place.

---

## 2. Verified current state — measured this session, not inherited

All numbers below were re-run from scratch at the end of this session.

```
cargo fmt --all -- --check                          clean
cargo clippy --workspace --all-targets -D warnings  clean
cargo test --workspace                              17 passed, 0 failed
./scripts/build-wasm.sh                             454 KB (M6 budget 2 MB gzipped)
pnpm -r typecheck                                   clean
pnpm --filter @onemark/engine test                  57 passed
pnpm --filter @onemark/renderer test                76 passed
fixture drift                                       no diff
```

Gates:

| Metric | Target | Actual |
|---|---|---|
| M3 CommonMark | ≥ 99% | **652/652 = 100.00%** |
| M4 GFM extensions | 100% | **22/22 = 100.00%** |
| NFR-2 XSS corpus | all blocked | **93/93 blocked; 68/93 live unsanitised** |
| Real-browser security | — | **WebKit / Chromium / Firefox: 0 failures, 0 executions sanitised; 68 failures + 17–19 executions unsanitised** |

The unsanitised column is the load-bearing control: if it ever drops near zero, the corpus has gone inert and the green column proves nothing.

---

## 3. Done vs not done

### Done and verified
- **M0** (all 8 tasks) — workspaces, engine crate, WASM boundary, TS interface, CommonMark runner, CI file, OQ-3, OQ-4
- **M1.1** renderer — AST → semantic HTML, 100% CommonMark
- **M1.2** GFM extensions — tables, task lists, strikethrough, footnotes, tagfilter, 100% M4
- **M1.3** sanitiser — DOMPurify wrapped, URL policy, 93-vector corpus, **now cross-engine verified**

### Not done
- **M1.4 onwards** — GitHub Markdown CSS (light/dark) has **not been started**. This is the next task.
- **1.5–1.8** Shiki, KaTeX, Mermaid, alerts/anchors/emoji — not started
- **M1b (1.9–1.13)** golden corpus vs GitHub API — not started; **OQ-1 and OQ-2 still open**
- **M1c (1.14–1.22)** editor, split view, scroll sync, OPFS, theme, worker, benchmarks, deploy — not started
- **CI has never executed.** The workflow file is written and every step passes locally, but nothing has been pushed.

### Outstanding from *this* session — important
- **Docs were not updated for this session's work.** `CHANGELOG.md`, `docs/04-Build-Plan.md`, `HANDOFF.md` and a new session log still describe the pre-audit state. The three defects below are undocumented outside this file.
- **ADR-0013 is now partly inaccurate.** It describes the sanitiser design but predates the `USE_PROFILES` defect and the raw-HTML URL-policy hook. It needs a correction or a superseding ADR.

---

## 4. What changed this session — three real defects, all fixed

Full detail is in the code comments at each site; summarised here because it exists nowhere else yet.

### 4.1 The allowlist was dead configuration (`packages/renderer/src/sanitize.ts`)
The config passed `ALLOWED_TAGS`/`ALLOWED_ATTR` **and** `USE_PROFILES`. DOMPurify applies `USE_PROFILES` *after* and overwrites both, so the curated allowlist never applied and DOMPurify's much broader default HTML profile did.

Consequence: `<audio src>`, `<video src>`, `<track src>`, `<marquee>`, `tabindex`, `download`, `loading` all survived. The media elements fetch arbitrary remote URLs — a direct violation of **PRD §5.3**, which makes remote *images* the sole permitted network use.

Why no test caught it: the XSS corpus stayed green throughout, because the denylist and DOMPurify's defaults still stopped every *scripted* vector. It was a policy failure, not a scripting one.

Fixed by removing `USE_PROFILES`. Guarded by `packages/renderer/test/allowlist.test.ts`, which was **verified to fail** (6 failures) when the defect is reintroduced.

### 4.2 `data:image/svg+xml` bypass via raw HTML
`url-policy.ts` refuses it, but it only ran on AST link/image nodes — raw HTML never passed through it, and DOMPurify permits `data:` on `img`. So `![x](data:image/svg+xml,…)` was refused while `<img src="data:image/svg+xml,…">` was allowed.

Fixed with an `afterSanitizeAttributes` hook applying the same policy to every URL regardless of origin. Both paths now agree.

### 4.3 Denial of service — WASM trap left the module permanently dead
`convert()` in `crates/onemark-engine/src/lib.rs` recursed over AST depth. Nesting depth is attacker-controlled; `"*".repeat(5000)` yields a tree ~2500 deep. A native 8 MB stack absorbs that, **the wasm32 stack is 1 MB**.

The trap was not a catchable error: `RuntimeError: memory access out of bounds` left the module instance **permanently unusable**, so every later parse failed — including `# hello`. One pathological document killed the renderer for the session.

Root cause was confirmed to be *our* converter, not comrak: comrak parses depth-20000 input in ~0 ms without deep recursion.

Fixed by making `convert()` iterative with an explicit heap stack, plus a deliberate `MAX_DEPTH = 400` product limit that emits a visible `truncated` marker node rather than dropping content silently. Regression-tested in `packages/engine/test/robustness.test.ts` and `crates/onemark-engine/tests/parse.rs`.

### 4.4 API hardening
`SafeRenderOptions` previously extended `Partial<RenderOptions>`, so a caller could pass `{ urlPolicy: false }` and disarm the safe path. It now `Omit`s that key, and `renderToSafeHtml` **forces** `urlPolicy: true` so even a cast cannot bypass it.

---

## 5. Goals and acceptance criteria — where they actually live

Do not invent new ones. They are specified:

- **Goals G1–G5 (ranked):** `docs/02-PRD.md` §3. G1 ship · G2 fidelity provable · G3 learn systems · G4 portfolio · G5 real users.
- **Non-goals (binding):** §3.1.
- **The v1 done-line:** §5.1. Note it was **revised** — the latency clause is now "a typical document (100 KB) render in under 100 ms", not the old 5 MB/200 ms.
- **Acceptance metrics:** §5.2 — M1a (100 KB < 100 ms), M1b (1 MB < 500 ms), M1c (5 MB must not block the UI thread), M2 zero first-party network, M3 ≥99%, M4 100%, M5 ≥98%, M6 <2 MB gzipped.
- **Why M1 was re-tiered:** `docs/adr/0012-latency-budget-scoped-to-real-documents.md`.
- **Per-task acceptance:** the **verify column** in `docs/04-Build-Plan.md`. That column is the contract for "done".

**Known soft spot:** M1a/M1b were set from **engine-only** measurements. The render layer — Shiki, KaTeX, Mermaid, sanitisation, CSS — is ~80% of the work and is entirely unmeasured. The 70 ms of headroom in M1a is an assumption, due to be tested at task 1.20.

---

## 6. Environment changes made on this machine

| Change | Detail | Reverse with |
|---|---|---|
| `rustup` installed | `~/.cargo`, alongside pre-existing MacPorts Rust at `/opt/local`; modified shell profile | `rustup self uninstall` |
| Toolchain pinned | `rust-toolchain.toml` → 1.97.1 | edit the file |
| `wasm-bindgen-cli` | 0.2.127, must stay version-matched to the crate; `scripts/build-wasm.sh` checks and fails loudly | `cargo uninstall wasm-bindgen-cli` |
| Playwright + engines | devDependency of `@onemark/renderer`; WebKit 26.5, Chromium 151, Firefox 153 in `~/Library/Caches/ms-playwright` | `pnpm remove`, delete cache |

---

## 7. Standing constraints — carry these forward

1. **No commits, no pushes, until the user explicitly says so.** In force since repo creation. `git rev-list --all --count` = 0. Everything is untracked on disk, so `git checkout` cannot undo doc edits.
2. **Never self-attribute.** No `Co-Authored-By`, no "Generated with Claude", no trailers anywhere. Overrides harness defaults.
3. **Caveman mode is active (full).** Terse output; code, commits and security notes written normally.
4. **Never edit a decided ADR** — supersede it with a new one.
5. Anything not required by the done-line (PRD §5.1) is v2.
6. The user's `~/.claude/CLAUDE.md` requires: blast radius on every change, an end-of-session ledger saved to `docs/session-logs/<date>-<slug>.md`, and search queries (not explanations) for general/external concepts.

---

## 8. Recommended first moves for the next session

1. Read `docs/04-Build-Plan.md` and `HANDOFF.md`, then run the sweep in §2 to confirm the state independently.
2. **Write the missing session log** for 2026-08-21 and update `CHANGELOG.md`, `docs/04-Build-Plan.md` and `HANDOFF.md` with §4 of this document.
3. **Correct or supersede ADR-0013** so it matches the implementation.
4. Then start **task 1.4 — GitHub Markdown CSS, light and dark.** Its verify column is "visual match on a reference document", which is unfalsifiable as written. Decide up front what "match" means and how it is checked (computed styles, screenshot diff against a reference, DOM/typography/spacing/contrast assertions) — G2 forbids a claim that cannot fail a build. Playwright is now installed and is the obvious tool.

---

## 9. Suggested skills

Call the `Skill` tool for these:

| Skill | When |
|---|---|
| `mattpocock-skills:code-review` | First, to review the codebase independently — it runs Standards and Spec reviews in parallel. Note it reviews "changes since a fixed point" and **there are no commits**, so give it a path scope rather than a git ref. |
| `mattpocock-skills:grilling` | Before task 1.4's verification approach, and before any architecture choice. The user's CLAUDE.md mandates this for non-trivial decisions, and it produced every good decision so far. |
| `mattpocock-skills:tdd` | Task 1.4 onward. Every build-plan task carries a verify column; write the failing check first. |
| `mattpocock-skills:domain-modeling` | If touching ADRs or project vocabulary. |
| `mattpocock-skills:diagnosing-bugs` | If anything in the sweep is red. |
| `caveman` | Already active; keep it. |
| `superpowers:verification-before-completion` | Before claiming any task done — evidence before assertions. |

Skills to **avoid** re-running: `superpowers:brainstorming` and `wayfinder` — scope is locked and the map already exists in `docs/04-Build-Plan.md`.

---

## 10. Nothing is blocked

No credentials, permissions or infrastructure are required to continue. The only genuinely gated action is **committing/pushing**, which needs the user's explicit instruction.
