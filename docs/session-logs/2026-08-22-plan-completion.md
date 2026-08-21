# Session log — Plan completion: OQs closed, task 1.4 built

| Field | Value |
|---|---|
| Date | 2026-08-22 |
| Phase | **M1.1–1.4 complete** — OQ-1/2/5 resolved, CSS vendored + verified, remaining work fully ticketed |
| Previous | [2026-08-22 records reconciliation](2026-08-22-records-reconciliation.md) |
| Code changed | renderer (+8 default tests, +2 visual tests), fidelity (+spec checker); engine untouched |

## Wayfinder verdict

A wayfinder map was considered and **rejected**: the route already exists as
`docs/04-Build-Plan.md` (every task has a verify column) and the architecture is locked by
ADRs. The only fog was three sharp questions — resolved this session instead of mapped.
The audit handoff had already flagged wayfinder as the wrong tool while scope stays locked.

## Open decisions closed

| Question | Resolution | Where |
|---|---|---|
| Task 1.4's unfalsifiable "visual match" verify column | Three assertion layers: structural + pinned-reference-value (default suite) + Chromium screenshot pixel-diff vs committed baselines (opt-in `test:visual`) | **ADR-0015** |
| OQ-1 golden corpus selection | Deterministic seeded stratified rule (55/25/12/8 strata), committed manifest, frozen once selected | PRD §12 |
| OQ-2 normalization rules | Structural DOM diff via parse5; rules R1–R6 named after the GitHub artifact each neutralises; anything else = a real difference | PRD §12 |
| OQ-5 OPFS library scope | Recent-files store only (`{id,name,size,modifiedAt,content}`); not a managed library | PRD §12 |

## Task 1.4 delivered (TDD)

Red first: `theme.test.ts` written before any CSS existed (8/8 fail). Green:

- `scripts/vendor-github-css.mjs` pins `github-markdown-css@5.8.1` (MIT, attribution in
  `packages/renderer/css/ATTRIBUTION.md`); re-vendoring is deliberately frictional
- `github-light.css` / `github-dark.css` vendored (21 KB each, selectors identical,
  values differ; every `url()` is an inline SVG data URI — M2-offline by construction)
- Reference values in the test are literals transcribed at pin time — an upstream bump
  that changes values fails the suite and forces a conscious re-baseline
- `theme-screenshot.test.ts` renders `fixtures/reference-document.md` through the real
  engine + sanitiser + theme in Chromium and pixel-diffs against committed baselines
  (0.1% threshold). First run generated baselines; second run verified green
- Known tripwire, documented: the renderer does not yet emit `.markdown-alert` markup
  (that is task 1.8), so alerts appear unstyled in the baseline. Landing 1.8 will fail
  the screenshot diff **by design** until baselines are consciously re-baked

## Gaps fixed

- `fidelity/package.json` was missing → root `pnpm spec` matched nothing. Now
  `fidelity/src/spec.mjs` verifies corpus integrity (652 CommonMark · 22 gated GFM · 93 XSS)

## Remaining work — now all ticketed

`OneMark-5gz` Shiki (1.5) · `OneMark-xs8` KaTeX (1.6) · `OneMark-tfg` Mermaid (1.7) ·
`OneMark-7mn` alerts/anchors/emoji (1.8) · `OneMark-apc` M1c editor cluster (1.14–1.19) ·
`OneMark-8b9` perf+budget gates (1.20–1.21) · `OneMark-0pr` deploy (1.22) · `OneMark-42l`
M2 Tauri entry · `OneMark-b5r` golden-corpus implementation work (OQ-1/2 now specified).

Beyond one session honestly: M2–M4 need Tauri scaffolding, devices and signing — they are
planned, ticketed, and blocked on nothing but sessions.

## Environment note

Non-interactive shells on this machine get MacPorts Rust 1.84 (`/opt/local/bin`) ahead of
rustup's shims, which ignores `rust-toolchain.toml` and lacks wasm32 std — the wasm build
fails with E0463. Prefix `PATH="$HOME/.cargo/bin:$PATH"` for cargo/wasm work.

## Verification at close

fmt/clippy clean · rust 17 · engine 57 · renderer 84 default (+2 visual opt-in) ·
typecheck clean after fixing 5 strict-mode errors tsc caught in my new test code ·
wasm rebuilt reproducibly at 455 KB (M6 budget 2 MB).
