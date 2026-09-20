# Changelog

All notable changes to OneMark are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

**Campaign 2026-09-20 — M1 done-line within reach.** First push in project history; CI green; golden corpus frozen with a real M5 number; design system landed; deploy pipeline live.

### Added — 2026-09-20 (campaign: backup, corpus, M5, design, deploy)
- **Repo backup (P0)** — the entire Rust engine, CI, workspace manifests, README and
  license were untracked on a single disk. Committed one logical change at a time,
  pushed, tagged `v0.1.0-alpha`. CI green (4/4 jobs) on first run in history.
- **Golden corpus (P3, `OneMark-b5r`/`OneMark-911` closed)** — 74 documents frozen by the
  seeded OQ-1 rule from a committed 249-candidate pool mined out of 38 real repo trees
  (blob-size aware, 5–200 KB band, real commit SHAs). Goldens fetched from
  `POST /markdown` with `gh auth token`. **M5 parity: 100.00% of 49 gated documents**,
  with 25 known-gaps excluded *with reasons* (frontmatter oracle divergence, @mentions,
  issue-link shortening, math delimiters, footnote pipeline, raw-HTML sanitiser
  boundaries).
- **Normalizer R7–R28** — 22 new named rules, each with a test, discovered by triaging
  every corpus diff: API link chrome (`rel=nofollow`), camo metadata, image style
  stamping, linguist-tokenisation collapse (R10), code-block trailing newlines (R11),
  `notranslate`, ARIA roles, presentation wrappers around lone images, accessibility
  tables, hovercard/data chrome, raw ids, task-list class vocabulary, sanitised raw-HTML
  classes, block-level lone images, http→https upgrades, legacy table attributes,
  colgroup, `abbr` unwrap, empty/attribute-less anchors, checkbox chrome.
- **Renderer GitHub parity** — safe path renders soft breaks as `<br>` (GitHub .md
  behaviour; conformance raw path untouched); mermaid fences emit GitHub's
  `<pre><code class="language-mermaid">` pre-hydration shape, hydration swaps the pre
  for strict-mode SVG.
- **Web app fixes** — the Shiki token stylesheet had never been injected (highlighted
  code rendered unstyled); rendering now passes the resolved theme (dark mode previously
  rendered light tokens) and theme switches re-render code spans.
- **Design system (P2)** — `@onemark/design-tokens`: `tokens.json` single source →
  generated CSS custom properties + typed TS; brand `#c8412d` with a designed dark-mode
  shift; WCAG contrast asserted in tests (42). Prototype gallery in `design/prototypes/`
  (app shell, marketing hero, components, typography/motion) awaiting author validation.
  ADR-0017.
- **Deploy pipeline (P4)** — `.github/workflows/deploy.yml`: GitHub Pages via
  actions/deploy-pages at `/onemark/app/`, M6 bundle gate re-enforced before upload;
  `scripts/perf-arbitrate.mjs` arbitrates the M1a/M1b budgets in real Chromium per
  ADR-0016. CI web job now runs the M6 bundle gate on every push.
- **Fidelity report template** — `.github/ISSUE_TEMPLATE/fidelity-report.yml`: markdown
  source + GitHub reference URL + platform; every real divergence triages into
  parse/render/present and becomes a regression fixture.

### Added — 2026-08-22 (M1b runner + gates)
- **Normalizer R1–R6** (`fidelity/src/normalize.mjs`, OQ-2): parse5 structural diff;
  12 tests, each rule named for its GitHub artifact
- **M5 diff runner** (`fidelity/src/diff.mjs`): renders ours through the real safe path
  (jsdom DOM supplied), normalizes both sides, ≥ 98% gate; mechanics proven offline
- **Golden fetcher** (`fidelity/src/fetch-goldens.mjs`): `POST /markdown`, GITHUB_TOKEN
  required, rate-limit-aware, manifest frozen at fetch — awaiting the author's corpus run
- **Perf floor** (`bench/test/perf-floor.test.ts`) + **[ADR-0016](docs/adr/0016-perf-budgets-arbitrated-in-browser.md)**:
  Node/jsdom cannot arbitrate M1a/M1b (~1.6 s @ 100 KB render+sanitise; super-linear
  scaling; 250 KB OOMs a 2 GB heap). Budgets move to browser arbitration at deploy
- **M6 bundle gate** (`scripts/check-bundle.mjs`): initial payload **0.67 MB / 2 MB** gzipped

### Added — 2026-08-22 (M1a render layer complete: tasks 1.5–1.8)
- **Task 1.5 — Shiki highlighting** (`src/highlight.ts`): grammars + github-light/dark
  themes bundled statically; adapter handed to the renderer via options, so the
  conformance path stays byte-exact. Token colours ship as `tk-*` classes plus a
  generated stylesheet — inline styles would be stripped by the sanitiser allowlist
- **Task 1.6 — KaTeX math**: renderer emits inert `onemark-math` placeholders;
  `renderToSafeHtml` hydrates them with bundled KaTeX *after* sanitisation
  (`trust: false`; hostile `\href` renders in KaTeX's error colour, never a live link)
- **Task 1.7 — Mermaid**: ```mermaid fences render as inert escaped-text divs;
  `hydrateMermaid()` runs the bundled mermaid at `securityLevel: 'strict'`.
  Chromium test proves offline SVG with zero network requests
- **Task 1.8 — GitHub specifics**: alert nodes emit `markdown-alert` divs matching the
  vendored CSS; GitHub-style `user-content-` heading anchors on the safe path (raw
  path stays byte-exact for conformance); gemoji shortcodes (1913) replaced in text
  nodes only; flat YAML frontmatter renders as GitHub's key/value table
- Screenshot baselines consciously re-baked ([ADR-0015](docs/adr/0015-present-layer-verified-by-assertions.md))
  after 1.8: reference fixture now covers frontmatter table, styled alerts and emoji

### Added — 2026-08-22 (task 1.4 + open questions closed)
- **Task 1.4 — GitHub Markdown CSS, light and dark** (`packages/renderer/css/`): vendored
  from `github-markdown-css@5.8.1` (MIT) via `scripts/vendor-github-css.mjs`
  - **ADR-0015** — present-layer fidelity verified by assertions, never by eye:
    structural + pinned-reference-value tests run in the default suite
    (`test/theme.test.ts`, 8 tests); screenshot pixel-diff against committed baselines
    runs opt-in (`pnpm --filter @onemark/renderer test:visual`)
- **OQ-1 resolved** — golden-corpus selection rule: deterministic, seeded, stratified,
  committed manifest, frozen (PRD §12)
- **OQ-2 resolved** — HTML normalization rules R1–R6, structural DOM diff via parse5,
  each rule named after the GitHub artifact it neutralises; anything else counts as a
  real difference (PRD §12)
- **OQ-5 resolved** — OPFS library is a recent-files store, not a managed library (PRD §12)
- `fidelity/package.json` + `src/spec.mjs` — `pnpm spec` now verifies corpus integrity
  (CommonMark 652 · GFM gated 22 · XSS 93)

### Fixed — 2026-08-21 (security audit + hardening, [ADR-0014](docs/adr/0014-sanitiser-v2-profile-free-allowlist.md))
- **Dead allowlist config** (`packages/renderer/src/sanitize.ts`): `USE_PROFILES` overrode
  the curated `ALLOWED_TAGS`/`ALLOWED_ATTR`, so DOMPurify's broad default HTML profile
  governed — `<audio>/<video>/<track> src`, `<marquee>`, `tabindex`, `download` survived.
  Removed; the curated allowlist is now the single source of truth. Guarded by
  `allowlist.test.ts` (verified to fail when the defect is reintroduced).
- **`data:image/svg+xml` bypass via raw HTML** (`packages/renderer/src/sanitize.ts`):
  the URL policy only covered AST link/image nodes; raw HTML skipped it. An
  `afterSanitizeAttributes` hook now applies the same policy to every URL regardless of
  origin, so both paths agree.
- **Safe path could be disarmed** (`packages/renderer/src/safe.ts`):
  `SafeRenderOptions` extended `Partial<RenderOptions>`, so `{ urlPolicy: false }`
  compiled. It now `Omit`s the key and `renderToSafeHtml` forces `urlPolicy: true`.
- **WASM stack-exhaustion DoS** (`crates/onemark-engine/src/lib.rs`): AST conversion
  recursed over attacker-controlled depth; wasm32's 1 MB stack trapped with
  `memory access out of bounds` and left the module **permanently dead** for all later
  parses. `convert()` is now iterative, with a deliberate `MAX_DEPTH = 400` product limit
  emitting a visible `truncated` marker node. Regression-tested in
  `packages/engine/test/robustness.test.ts` + `crates/onemark-engine/tests/parse.rs`.

### Added — 2026-08-21 (hardening, continued)
- XSS corpus expanded **49 → 93 vectors** (`fidelity/xss/corpus.json`);
  **93/93 blocked, 68/93 confirmed live unsanitised** through the unsafe path
- Real-browser security matrix via Playwright (WebKit 26.5 / Chromium 151 / Firefox 153):
  sanitised path **0 failures, 0 script executions** across all three engines

### Added — 2026-08-18 (M0 foundation)
- `crates/onemark-engine` — wraps `comrak` behind OneMark's own AST contract (ADR-0002)
- `crates/onemark-wasm` — wasm-bindgen boundary exposing both transport designs
- `packages/engine` — the `MarkdownEngine` TypeScript interface, AST types, runtime validator
- Cross-language contract fixtures: the Rust engine emits them, TypeScript asserts against them
- CommonMark 0.31.2 spec runner — **652/652, 100.00%**, blocking below 99% (M3)
- `transport_bench` harness answering OQ-4
- CI: fmt, clippy, Rust tests, wasm32 build, typecheck, TypeScript tests, fixture-drift gate
- pnpm + cargo workspaces, `rust-toolchain.toml` pinned to 1.84.0

### Added — 2026-08-18 (M1.1)
- `packages/renderer` — AST → semantic HTML, modelled on `cmark`'s reference formatter
- CommonMark suite re-pointed at OneMark's own render path: **652/652 = 100.00%** (M3)
- NFR-4 semantic-HTML tests: no `div`/`span` emitted across the whole spec corpus

### Added — 2026-08-18 (M1.2)
- GFM extension rendering: tables (with column alignment), task lists, strikethrough, footnotes
- GFM's "Disallowed Raw HTML" tagfilter — render-layer, as the spec defines it
- `fidelity/spec/gfm-0.29.json` + `scripts/vendor-gfm-spec.mjs` — **GFM extensions 22/22 = 100.00%** (M4)
- Footnote tests using comrak's own formatter as an in-process oracle (tech spec §8, level 3)

### Added — 2026-08-18 (M1.3)
- `packages/renderer/src/sanitize.ts` — DOMPurify behind OneMark's own `Sanitizer` interface
- `packages/renderer/src/url-policy.ts` — context-aware scheme allowlist (`data:` differs for
  link vs image; `data:image/svg+xml` refused)
- `renderToSafeHtml` — the shipping render path. `renderToUnsafeHtml` remains for the
  conformance suites only
- `fidelity/xss/corpus.json` — 49 attack vectors; **49/49 blocked**, and **38/49 confirmed live**
  through the unsanitised path, so the gate demonstrably fails when the control is removed
- **ADR-0013** — wrap a proven HTML sanitiser; do not write one

### Changed — 2026-08-18 (AST contract)
- **`footnote_reference` no longer carries `ref_num`.** comrak assigns footnote numbering
  during rendering, not parsing, so the field was always `1` — authoritative-looking and
  wrong. Numbering is now computed by `packages/renderer` from document order of first
  reference, which is where it belongs.

### Resolved — 2026-08-18
- **OQ-3** — GitHub alerts are parser-layer in `comrak`, emitted as typed `Alert` nodes
- **OQ-4** — AST-as-JSON costs ~2× the M1 budget at 5 MB and produces a 16.9× payload

- **OQ-6** — raised and resolved the same day: the 5 MB / 200 ms metric was ~50× the real
  workload and unachievable on any transport design

### Changed — 2026-08-18
- **ADR-0012** — the latency budget is scoped to real documents. M1 becomes M1a (100 KB
  < 100 ms), M1b (1 MB < 500 ms) and M1c (5 MB must not block the UI thread).
  **ADR-0005 is preserved:** the AST remains the contract.
- Toolchain pinned to Rust 1.97.1 via `rust-toolchain.toml`

### Added — 2026-08-16 (architecture session)
- Full documentation set: Brief, PRD, Technical Spec, Build Plan, Learning Roadmap
- 11 Architecture Decision Records covering every decision, with rejected alternatives
- `HANDOFF.md` for resuming work after a gap
- Repository created — public, PolyForm Noncommercial 1.0.0

### Decided — 2026-08-16
- `comrak` as the single shipped engine; `cmark-gfm` retained as a test oracle only
- Tauri v2 as the single runtime across all six platforms
- Split-view editor for v1; inline live preview deferred to v2
- GFM-only dialect for v1; Obsidian-compatibility profile deferred
- Web ships first; macOS second

### Context — 2026-06-02 (initial scoping)
- Problem framed: markdown renders differently everywhere; GitHub's fidelity exists only inside github.com
- Open questions recorded for the follow-up session

---

*Milestone completions will be recorded here as they land. See [`docs/04-Build-Plan.md`](docs/04-Build-Plan.md).*
