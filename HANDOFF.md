# OneMark — Handoff

**Read this first when picking the project back up.** Updated at the end of every working session.

| Field | Value |
|---|---|
| Last updated | 2026-09-20 (campaign session, wave 2) |
| Phase | **v0.1.0 shipped + hardened** — all 12 campaign issues closed. Live on Pages; M5 at 100% gated; perf ladder rung 1 done (worker render), sanitiser fail-closed hardening, E2E in CI, coverage floors. Remaining: perf rungs 2+ (ADR-0019/0022 roadmap), M2 after xcode unlock |
| Live | https://adhamhaithameid.github.io/onemark/ (site) · [/app/](https://adhamhaithameid.github.io/onemark/app/) (the app) |
| Repo | https://github.com/adhamhaithameid/onemark — pushed, `v0.1.0` + `v0.1.0-alpha` tagged, [release notes](https://github.com/adhamhaithameid/onemark/releases/tag/v0.1.0) |

---

## Where things stand

The 2026-09-20 campaign executed the full plan and **closed all 12 campaign
issues** (P0–P11): repo backup, baseline verification, golden corpus with a
real M5 number, design system, deploy with gates, engine parity + perf ladder
rung 1, E2E + coverage, sync v1, analytics worker, Tauri spike, marketing
site, launch prep. The remaining work is a *roadmap*, not tickets: perf rungs
2+ (ADR-0019/0022), M2 tasks after the xcode unlock, dogfooding.

## The verified scoreboard (all gates green)

| Gate | Result |
|---|---|
| CommonMark 0.31.2 | **652/652 (100%)** |
| GFM extensions | **22/22 (100%)** |
| M5 GitHub parity | **100.00% of 49 gated docs** (74-doc corpus, 25 named known-gaps) |
| XSS corpus | **93/93 blocked** in WebKit/Chromium/Firefox + fail-closed guard tests |
| Bundle (M6) | **0.95 MB / 2 MB** (worker carries the renderer) — gated in CI *and* deploy |
| Real-workload perf | **20 KB → 87 ms adjusted**; M1b 27.4 s after rung 1 (ADR-0019 ladder) |
| E2E | **5 flows green** in real Chromium, blocking CI job |
| Coverage floors | engine 85% · renderer 93% · storage 94% lines |
| Tests | 17 rust · 372+ TS across eight packages |

## What changed the codebase this session (beyond the tickets)

- **Renderer parity fixes with real fidelity impact**: soft breaks render as
  `<br>` on the safe path (GitHub .md behaviour — this single change moved M5
  from 0% to double digits), mermaid fences emit GitHub's pre-hydration
  `<pre><code class="language-mermaid">` shape, Shiki token themes are finally
  injected/theme-aware/re-rendered on switch (three latent web-app bugs).
- **Normalizer R7–R28**: 22 new named rules from corpus triage, each tested —
  API chrome (nofollow, camo, notranslate, hovercard/data-*), linguist
  collapse, trailing newlines, task-list class vocabulary, and more.
  Guardrail test "real differences are never normalized away" still green.
- **Known-gap discipline worked**: frontmatter docs (19), mentions,
  issue-link shortening, math delimiters, footnotes and one raw-HTML
  boundary case are excluded from M5 *with recorded reasons*, not silently.
- **Security hardening (ADR-0022)**: DOMPurify silently no-ops on linkedom and
  half-works on happy-dom — both findings came from pre-wiring tests, and
  `sanitiseHtml` now fails closed (throws) on any DOM that cannot sanitise,
  with a DOM-walked output invariant as the second belt. The worker renders;
  the sanitiser never leaves a complete DOM.
- **Perf ladder rung 1 (ADR-0019/0022)**: parse + render + Shiki highlighting
  in the worker behind `renderUnsafe`/`renderHtml` seams; main thread only
  sanitises + hydrates math. M1b wall time 32.5 → 27.4 s; M1c achieved for
  render (not just parse).

## The two author actions that unlock the next steps

1. **`sudo xcodebuild -license accept`** — unblocks the Tauri spike's
   `cargo check` (ADR-0020 has the exact error; the shell scaffolding is
   committed in `src-tauri/`).
2. **Prototype validation** — open `design/prototypes/index.html`, review the
   four pages, and comment amendments; they land via `tokens.json` + rebuild
   (ADR-0017). Optional: a Cloudflare token for the analytics worker deploy
   (steps in `apps/analytics-worker/README.md`), and OAuth client
   registrations for Drive/OneDrive adapters (documented in
   `packages/sync/README.md`).

## Next actions (roadmap, not tickets)

1. **Perf ladder rung 2 (ADR-0019/0022)** — chunked/blockwise sanitisation to
   attack the DOMPurify super-linearity; re-arbitrate with
   `scripts/perf-arbitrate.mjs` after each rung and append numbers.
2. **M2** — after `sudo xcodebuild -license accept`: finish the spike, then
   tasks 2.3–2.8 (FolderStorage, bookmarks, menus, signing).
3. **Dogfood** — use the deployed app daily; file fidelity reports against the
   new issue template. Soft-launch when it feels solid.
4. **Author validations pending** — prototype gallery
   (`design/prototypes/index.html`), Cloudflare token (analytics deploy), OAuth
   registrations (Drive/OneDrive adapters).

## Standing constraints

- Commit/push freely (the author authorized it for this campaign); keep
  one-logical-change-per-commit and docs-after-every-step discipline.
- Every decision → an ADR (0021 used; next free number 0022).
- The corpus manifest is **frozen** — known-gap tagging is annotation, never
  re-selection. Re-fetching goldens is a decision (new ADR).
- Rust: run with `~/.cargo/bin` first (PATH shadows 1.97.1 with MacPorts
  1.84.0). wasm-bindgen-cli must stay version-matched to the crate.

## Session log

| Date | Session | Output |
|---|---|---|
| 2026-06-02 | Initial scoping | Problem framing. [Log](docs/session-logs/2026-06-02-initial-scoping.md) |
| 2026-08-16 | Architecture grilling | 11 ADRs, doc set. [Log](docs/session-logs/2026-08-16-architecture-grilling.md) |
| 2026-08-18 | M0 foundation | First code, OQ-3/4/6. [Log](docs/session-logs/2026-08-18-m0-foundation.md) |
| 2026-08-21 | Security audit | 4 defects, corpus 49→93. [Log](docs/session-logs/2026-08-21-security-audit.md) |
| 2026-08-22 | Plan completion + M1a/M1b/M1c | Render layer, gates, editor. [Logs](docs/session-logs/) |
| 2026-09-20 | **Campaign** | Backup/corpus/M5/design/deploy/sync/analytics/spike/marketing — see [log](docs/session-logs/2026-09-20-campaign.md) |
