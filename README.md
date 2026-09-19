<div align="center">

# OneMark

**GitHub-identical Markdown rendering — offline, on every platform.**

One engine. Six targets. No server.

</div>

---

> **Status: pre-implementation.** Scope is locked, architecture is decided, no code has been written yet. Everything below is a commitment, not a claim. See [`docs/02-PRD.md`](docs/02-PRD.md).

## The problem

Markdown renders differently everywhere. You write GitHub Flavored Markdown, you know that dialect, and you rely on how github.com renders it — but **that rendering only exists inside github.com**.

Open the same `.md` file on your Mac and you get a different dialect, or a browser round-trip. Open it on your iPad and you get another one. Every web editor either ships the document to a server to render it, or renders a flavor that isn't GFM.

## What OneMark does

Renders GFM **exactly as GitHub does**, entirely on your device, identically on every platform you own — and proves it with a test suite that diffs against GitHub's own renderer.

## Fidelity is verified, not claimed

| Level | Method | Gate |
|---|---|---|
| CommonMark spec suite | ~650 cases | ≥ 99% |
| GFM extension spec suite | full suite | 100% |
| Golden corpus | 100 real READMEs diffed against GitHub's `POST /markdown` API | ≥ 98% |
| Reference engine | `cmark-gfm` (GitHub's actual C engine) as a triage oracle | diagnostic |

`cmark-gfm` never ships. It exists only to be diffed against.

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
| Runtime | [Tauri v2](https://tauri.app) — Rust shell, ~5–10 MB binaries |
| Editor | [CodeMirror 6](https://codemirror.net) |
| Highlighting / math / diagrams | Shiki · KaTeX · Mermaid — all **bundled**, never CDN |
| Package managers | `pnpm` (TypeScript) + `cargo` (Rust) |

## Targets

| Milestone | Platform | Storage |
|---|---|---|
| **M1** | Web | OPFS |
| **M2** | macOS | folders + security-scoped bookmarks |
| **M3** | Windows · Linux | folders |
| **M4** | iOS · iPadOS · Android | Files app / SAF |

## What OneMark is not

Not a note app · not a PKM tool · not a sync service · not a git client · not a publishing platform · not a plugin host · not WYSIWYG.

Full list with reasoning: [`docs/02-PRD.md` §3.1](docs/02-PRD.md).

## Documentation

| Doc | What |
|---|---|
| [`docs/00-README.md`](docs/00-README.md) | Documentation index |
| [`docs/01-Brief.md`](docs/01-Brief.md) | Why this exists — pain, differentiator, audience |
| [`docs/02-PRD.md`](docs/02-PRD.md) | **Scope, requirements, metrics, risks** |
| [`docs/03-Technical-Spec.md`](docs/03-Technical-Spec.md) | Interfaces, repo layout, data flow |
| [`docs/04-Build-Plan.md`](docs/04-Build-Plan.md) | Milestones, each independently shippable |
| [`docs/05-Learning-Roadmap.md`](docs/05-Learning-Roadmap.md) | Rust · WASM · Tauri · CM6, in the order you'll need them |
| [`docs/adr/`](docs/adr/) | Architecture decisions — **including the rejected alternatives** |
| [`HANDOFF.md`](HANDOFF.md) | Read this first when picking the project back up |

## License

[PolyForm Noncommercial 1.0.0](LICENSE.md) — free for noncommercial use, commercial rights reserved.
