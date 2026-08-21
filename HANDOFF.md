# OneMark — Handoff

**Read this first when picking the project back up.** Updated at the end of every working session.

| Field | Value |
|---|---|
| Last updated | 2026-08-21 (security-audit session) |
| Phase | **M0 complete · M1.1–1.3 complete + hardened** — M3 100%, M4 100%, XSS 93/93 blocked, 4 defects fixed ([ADR-0014](docs/adr/0014-sanitiser-v2-profile-free-allowlist.md)) |
| Repo | https://github.com/adhamhaithameid/onemark (public, nothing pushed) |
| Local | `~/Desktop/code/OneMark` — git initialised, remote added, **2 local commits** (tooling only: beads init + graphify/session-log; all product code still untracked) |

---

## Where things stand

Two scoping sessions have happened. The second one (2026-08-16) demolished several conclusions of the first and produced the current architecture. **All decisions are recorded as ADRs in [`docs/adr/`](docs/adr/) with the rejected alternatives included.**

The documentation is complete. **M0 is done** — the architecture is proven end to end. See the 2026-08-18 session log.

## What OneMark is, in one sentence

> GitHub-identical Markdown rendering, offline, on every device — because GitHub's fidelity currently only exists inside github.com.

## The decisions, compressed

| Area | Decision | ADR |
|---|---|---|
| Differentiator | GitHub-identical rendering, offline, everywhere — **verified, not claimed** | 0001 |
| Parser strategy | Wrap an existing parser behind our own interface. Do **not** write one. | 0002 |
| Engine | **`comrak`** (Rust). Single engine, all platforms. `cmark-gfm` is a test oracle only, never shipped. | 0003 |
| Runtime | **Tauri v2** — one TypeScript UI, six platforms | 0004 |
| Engine output | AST is the contract; a bundled HTML renderer consumes it | 0005 |
| Editor | **Split view** for v1 (CodeMirror 6). Inline live preview is v2. | 0006 |
| Storage | Platform-conditional: folders on desktop, OPFS on web | 0007 |
| Dialect | **GFM only** in v1. Obsidian profile is v2. | 0008 |
| Repo | pnpm + cargo monorepo | 0009 |
| License | PolyForm Noncommercial 1.0.0 | 0010 |
| Order | **Web ships first** | 0011 |

## The done-line for v1

> *"On web, I can open a markdown file, see it rendered GitHub-identically — with syntax highlighting, math, Mermaid and alerts — edit it in a split view whose preview updates live, and have a typical document (100 KB) render in under 100 ms with zero server calls."*

*(Latency clause revised 2026-08-18 — [ADR-0012](docs/adr/0012-latency-budget-scoped-to-real-documents.md). The old 5 MB / 200 ms gate was ~50× the real workload and unachievable; see PRD §5.2 for the M1a/M1b/M1c tiers that replaced it.)*

**Every "should I build X?" is answered against this sentence.** If X is not required by it, X is v2. No exceptions.

## The three things easiest to forget

1. **The parser is ~20% of "looks like GitHub."** Syntax highlighting, Mermaid, math and CSS — the *render* layer — are the other 80%, and they are yours to build. Do not budget as if the parser is the hard part.
2. **`cmark-gfm` is in the repo but never ships.** It is a test oracle for triaging disputes with `comrak`. Only `comrak` ships. Shipping two engines would recreate the exact bug this project exists to fix.
3. **Web-first does not deliver the daily workflow.** Safari has no File System Access API, so the web build cannot open a cloned repo folder. That arrives at **M2 (macOS)**, which reuses the entire M1 UI. Web-first exists to prove fidelity + editor fast.

## Next action

**M0 and tasks 1.1–1.3 are complete, and a 2026-08-21 security-audit pass hardened the
sanitiser and engine** (three sanitiser defects + the WASM depth trap — see
[ADR-0014](docs/adr/0014-sanitiser-v2-profile-free-allowlist.md) and the
[audit session log](docs/session-logs/2026-08-21-security-audit.md)). The next build task is
**task 1.4 — GitHub Markdown CSS, light and dark**. Verify: visual match on a reference document.
It is the first task judged by eye rather than by byte comparison, so decide up front what "match"
means and how it is checked (Playwright is installed; a screenshot/style-diff against a reference
is the obvious falsifiable form).

**Carry forward on security:** `renderToSafeHtml` is the shipping path; `renderToUnsafeHtml`
exists only for the conformance suites and must never reach a DOM. The jsdom-only caveat is now
partly closed — the sanitiser passed a real-browser matrix (WebKit/Chromium/Firefox: 0 failures,
0 executions) on 2026-08-21; the full-browser conformance pass at task 1.22 remains owed.

### Verified state after hardening (2026-08-21)

| | |
|---|---|
| fmt / clippy -D warnings | clean |
| Rust tests | 17 passing |
| TypeScript tests | 57 engine + 76 renderer |
| M3 CommonMark | 652/652 = 100.00% |
| M4 GFM extensions | 22/22 = 100.00% |
| XSS corpus | **93/93 blocked, 68/93 live unsanitised** |
| Real browsers | WebKit/Chromium/Firefox: 0 failures, 0 executions (sanitised) |

### What M0 delivered

| | |
|---|---|
| **M0.3 — the architecture gate** | ✅ TS → WASM → AST → TS, and WASM output is **byte-identical to native** |
| CommonMark conformance | **652/652 = 100.00%** (M3 needs ≥99%) |
| Rust tests | 15 passing |
| TypeScript tests | 78 passing — 8 cross-build determinism (NFR-6), 43 renderer |
| **M1.1 renderer** | ✅ **CommonMark 652/652 = 100.00%** through OneMark's own render path |
| **M1.2 GFM** | ✅ **GFM extensions 22/22 = 100.00%** (M4) |
| **M1.3 sanitiser** | ✅ **49/49 XSS vectors blocked** (38/49 live unsanitised) *(corpus later expanded to 93 — see hardening note above)* |
| WASM artefact | 454 KB (M6 budget is 2 MB gzipped) |
| Clippy / fmt / typecheck | clean |
| OQ-3 | Resolved — alerts are parser-layer, natively supported |
| OQ-4 | Resolved — WASM design A is ~4× native; 16.9× payload |
| OQ-6 | Resolved — [ADR-0012](docs/adr/0012-latency-budget-scoped-to-real-documents.md), budget re-scoped to real documents |

**Toolchain changed this session:** `rustup` is now installed at `~/.cargo`, alongside the
existing MacPorts Rust at `/opt/local`. `rust-toolchain.toml` pins **1.97.1**. Reverse with
`rustup self uninstall`. `wasm-bindgen-cli` 0.2.127 is installed and must stay version-matched
to the `wasm-bindgen` crate — `scripts/build-wasm.sh` checks this and fails loudly.

### The one thing to distrust

M1a/M1b/M1c are set from **engine-only** measurements. The render layer — Shiki, KaTeX,
Mermaid, sanitisation, CSS — is ~80% of "looks like GitHub" and is completely unmeasured.
The 70 ms of headroom in M1a is an assumption. It gets tested at task 1.20.

## Open questions (from PRD §12)

| # | Question | Blocks |
|---|---|---|
| OQ-1 | Selection rule for the 100-document golden corpus | M5 metric |
| OQ-2 | HTML normalization rules for the GitHub diff (anchors, `dir`, camo proxy) | M5 metric |
| ~~OQ-3~~ | ~~Does `comrak` support GitHub alerts natively?~~ | ✅ **Resolved** — parser-layer, native |
| ~~OQ-4~~ | ~~AST across the WASM boundary — JSON, or HTML inside WASM?~~ | ✅ **Resolved** — JSON stays; the metric moved instead |
| OQ-5 | Is the OPFS library a real library or a recent-files cache? | Web scope |
| ~~OQ-6~~ | ~~Is the 5 MB / 200 ms metric right?~~ | ✅ **Resolved** — ADR-0012 |

## Standing constraints

- **No committing until explicitly instructed.** Still in force — everything M0 produced is on disk and untracked.
- Bandwidth is unpredictable. Milestones must stay individually shippable.
- Anything not required by the done-line is v2. Write it in the PRD's deferred table; do not build it.

## Session log

| Date | Session | Output |
|---|---|---|
| 2026-06-02 | Initial scoping | Problem framing, open questions. [Log](docs/session-logs/2026-06-02-initial-scoping.md) |
| 2026-08-16 | Architecture grilling | 11 ADRs, full doc set, repo created. [Log](docs/session-logs/2026-08-16-architecture-grilling.md) |
| 2026-08-18 | M0 foundation | First code. OQ-3 + OQ-4 resolved, OQ-6 raised, 2 blockers. [Log](docs/session-logs/2026-08-18-m0-foundation.md) |
| 2026-08-21 | Security audit | 4 defects fixed, ADR-0014, corpus 49→93, browser matrix green. [Log](docs/session-logs/2026-08-21-security-audit.md) |
