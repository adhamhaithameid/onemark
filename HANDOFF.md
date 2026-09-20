# OneMark — Handoff

**Read this first when picking the project back up.** Updated at the end of every working session.

| Field | Value |
|---|---|
| Last updated | 2026-09-20 (campaign session) |
| Phase | **v0.1.0 shipped** — app + marketing LIVE on Pages; corpus frozen with M5 at 100% gated; design system, sync v1, analytics worker landed. Open: P5 perf ladder, P6 E2E/coverage |
| Live | https://adhamhaithameid.github.io/onemark/ (site) · [/app/](https://adhamhaithameid.github.io/onemark/app/) (the app) |
| Repo | https://github.com/adhamhaithameid/onemark — pushed, `v0.1.0` + `v0.1.0-alpha` tagged, [release notes](https://github.com/adhamhaithameid/onemark/releases/tag/v0.1.0) |

---

## Where things stand

The 2026-09-20 campaign executed the full plan: repo backup (the whole engine
had been untracked on one disk — fixed first), baseline verification, the
golden corpus with a real M5 number, the design system, deployment with
gates, sync v1, the analytics worker, the Tauri spike, the marketing site, and
launch prep. Beads has the per-phase history (`bd list`); the open work is
`OneMark-9ct` (P5) and `OneMark-zpy` (P6).

## The verified scoreboard (all gates green)

| Gate | Result |
|---|---|
| CommonMark 0.31.2 | **652/652 (100%)** |
| GFM extensions | **22/22 (100%)** |
| M5 GitHub parity | **100.00% of 49 gated docs** (74-doc corpus, 25 named known-gaps) |
| XSS corpus | **93/93 blocked** in WebKit/Chromium/Firefox |
| Bundle (M6) | **0.67 MB / 2 MB** — gated in CI *and* before deploy |
| Real-workload perf | **20 KB → 79 ms adjusted** (ADR-0019: 100 KB/1 MB tiers not yet met) |
| Tests | 17 rust · 360+ TS across engine/renderer/storage/web/fidelity/design-tokens/sync/analytics |

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

## Next actions (in order)

1. **P5 perf ladder (ADR-0019)** — rung 1: move render+sanitise into the
   worker. Note: DOMPurify needs a DOM, so the worker needs `linkedom` —
   design that seam before coding. Then re-run
   `node scripts/perf-arbitrate.mjs --url …/app/` and append numbers to
   ADR-0019's successor.
2. **P6** — Playwright E2E (open/edit/save/reopen ×3 engines), coverage
   thresholds (~80% engine/renderer/storage), a11y checks in CI.
3. **M2** — after the xcode unlock: finish the spike, then tasks 2.3–2.8.
4. **Dogfood** — use the deployed app daily; file fidelity reports against the
   new issue template. Soft-launch when it feels solid.

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
