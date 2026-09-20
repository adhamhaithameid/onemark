<div align="center">

# OneMark

**GitHub-identical Markdown rendering — offline, on every platform.**

One engine. Six targets. No server. *Verified, not claimed.*

[![CI](https://github.com/adhamhaithameid/onemark/actions/workflows/ci.yml/badge.svg)](https://github.com/adhamhaithameid/onemark/actions/workflows/ci.yml)
[![Deploy](https://github.com/adhamhaithameid/onemark/actions/workflows/deploy.yml/badge.svg)](https://github.com/adhamhaithameid/onemark/actions/workflows/deploy.yml)
![CommonMark](https://img.shields.io/badge/CommonMark_0.31.2-652%2F652-brightgreen)
![GFM](https://img.shields.io/badge/GFM_extensions-22%2F22-brightgreen)
![GitHub parity](https://img.shields.io/badge/golden_corpus_parity-100%25%20gated-c8412d)
![Bundle](https://img.shields.io/badge/initial_payload-0.67%20MB%20%2F%202%20MB-c8412d)
[![License](https://img.shields.io/badge/license-PolyForm_NC_1.0.0-blue)](LICENSE.md)

**[▶ Open the app](https://adhamhaithameid.github.io/onemark/app/)** · [Marketing site](https://adhamhaithameid.github.io/onemark/) · [v0.1.0 release notes](https://github.com/adhamhaithameid/onemark/releases/tag/v0.1.0)

</div>

---

## The problem

Markdown renders differently everywhere. You write GitHub Flavored Markdown, you know that dialect, and you rely on how github.com renders it — but **that rendering only exists inside github.com**. Open the same `.md` file on your Mac and you get a different dialect, or a browser round-trip.

## What OneMark does

Renders GFM **exactly as GitHub does**, entirely on your device, identically on every platform you own — and *proves it* with test suites that diff against GitHub's own renderer.

## Fidelity is verified, not claimed

| Level | Method | Result |
|---|---|---|
| CommonMark spec suite | 652 cases, 0.31.2 | **652/652 (100%)** — gate ≥ 99% |
| GFM extension spec suite | 22 gated cases | **22/22 (100%)** — gate 100% |
| Golden corpus | real docs diffed against GitHub's `POST /markdown` API | **100% of 49 gated docs** (25 documented known-gaps) |
| XSS corpus | 93 attack vectors, 3 real browser engines | **93/93 blocked**, 0 executions |
| Reference engine | `cmark-gfm` (GitHub's actual C engine) | triage oracle only, **never ships** |

The harnesses live in [`fidelity/`](fidelity/) and run in CI. Divergences become *named* normalization rules (R1–R28, each with a test) or bugs — never vibes.

## Architecture

```
                    ┌──────────────────────────┐
                    │   comrak  (Rust)         │   ← ONE parser, everywhere
                    │   CommonMark + GFM → AST │
                    └────────────┬─────────────┘
                                 │  AST
                    ┌────────────┴─────────────┐
                    │   OneMark renderer (TS)  │   ← Shiki · KaTeX · Mermaid
                    │   AST → sanitized HTML   │     GitHub CSS · all bundled
                    └────────────┬─────────────┘
                                 │
     ┌──────────┬────────────┬───┴────┬───────────┬──────────┐
     │   Web    │   macOS    │  Win   │   Linux   │ iOS/Andr │
     │  (WASM)  │  (native)  │(native)│  (native) │ (native) │
     └──────────┴────────────┴────────┴───────────┴──────────┘
                    all six via ONE TypeScript UI
```

| Layer | Choice |
|---|---|
| Parser | [`comrak`](https://github.com/kivikakk/comrak) — Rust, CommonMark + GFM |
| Runtime | [Tauri v2](https://tauri.app) — one TypeScript UI, six platforms |
| Editor | [CodeMirror 6](https://codemirror.net), split view, parse in a Web Worker |
| Highlighting / math / diagrams | Shiki · KaTeX · Mermaid — all **bundled**, never CDN |
| Package managers | `pnpm` (TypeScript) + `cargo` (Rust) |

## Status

| Milestone | Platform | Status |
|---|---|---|
| **M0** | — architecture gate | ✅ WASM output byte-identical to native |
| **M1** | Web | ✅ **v0.1.0 deployed** — [app](https://adhamhaithameid.github.io/onemark/app/) |
| **M2** | macOS (Tauri) | 🟡 spike done — [ADR-0020](docs/adr/0020-tauri-v2-spike-gonogo.md) go-leaning, one local command from unblocked |
| **M3** | Windows · Linux | ⬜ reuses the M1 UI |
| **M4** | iOS · Android | ⬜ highest risk, last |

**Known perf state (ADR-0019):** 20 KB documents render in ~79 ms (within budget); the formal 100 KB / 1 MB tiers do not hold yet — the optimization ladder (worker sanitisation, streaming, lazy grammars) is scheduled, numbers recorded.

**Known fidelity gaps (accepted, documented):** repository-context autolinks (`#123`, `@user`, issue-link shortening), `linguist` language detection (OneMark uses Shiki), footnote DOM shape, `$` math delimiter heuristics.

## What OneMark is not

Not a note app · not a PKM tool · not a sync service · not a git client · not a publishing platform · not a plugin host · not WYSIWYG. Full list with reasoning: [PRD §3.1](docs/02-PRD.md). (Sync *to storage you already own* is opt-in and serverless — [ADR-0018](docs/adr/0018-opt-in-sync-adapters.md).)

## Repository layout

| Path | What |
|---|---|
| `crates/onemark-engine` | comrak wrapped behind OneMark's AST contract |
| `crates/onemark-wasm` | wasm-bindgen boundary |
| `packages/engine` | `MarkdownEngine` interface, AST types, validators |
| `packages/renderer` | AST → sanitized HTML (Shiki, KaTeX, Mermaid, anchors, alerts) |
| `packages/storage` | StorageProvider: memory + OPFS recent-files |
| `packages/design-tokens` | brand tokens: one JSON source → CSS + TS ([ADR-0017](docs/adr/0017-design-tokens-single-source.md)) |
| `packages/sync` | opt-in sync: WebDAV + engine + SSRF guard ([ADR-0018](docs/adr/0018-opt-in-sync-adapters.md)) |
| `apps/web` | the app: split view, worker parse, themes |
| `apps/marketing` | this site (Next.js static export) |
| `apps/analytics-worker` | aggregate-only counter ([ADR-0021](docs/adr/0021-privacy-first-aggregate-analytics.md)) |
| `fidelity/` | spec suites, golden corpus, XSS corpus, normalizer R1–R28 |
| `docs/` | PRD, technical spec, build plan, [ADRs](docs/adr/) with rejected alternatives |

## Report a fidelity bug

The most valuable issue you can file is a **[fidelity report](https://github.com/adhamhaithameid/onemark/issues/new?template=fidelity-report.yml)**: paste the markdown, link the GitHub rendering, and it becomes a regression fixture. Parse / render / present — every real divergence is triaged and fixed.

## Documentation

| Doc | What |
|---|---|
| [`docs/02-PRD.md`](docs/02-PRD.md) | scope, requirements, metrics, risks |
| [`docs/03-Technical-Spec.md`](docs/03-Technical-Spec.md) | interfaces, repo layout, data flow |
| [`docs/04-Build-Plan.md`](docs/04-Build-Plan.md) | milestones, each independently shippable |
| [`docs/adr/`](docs/adr/) | 20+ architecture decisions — **including the rejected alternatives** |
| [`HANDOFF.md`](HANDOFF.md) | read this first when picking the project back up |

## License

[PolyForm Noncommercial 1.0.0](LICENSE.md) — free for noncommercial use, commercial rights reserved.
