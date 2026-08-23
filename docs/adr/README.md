# Architecture Decision Records

One file per decision. Each records **what was rejected and why** — that is the part worth keeping.

**Rules**
1. Never edit a decided ADR. Supersede it with a new one.
2. Do not relitigate a decision without reading its ADR first.
3. New decisions get the next number, always.

| # | Decision | Status |
|---|---|---|
| [0001](0001-differentiator-github-fidelity-offline.md) | Differentiator: GitHub-identical rendering, offline, everywhere | Accepted |
| [0002](0002-wrap-existing-parser-behind-interface.md) | Wrap an existing parser behind our own interface | Accepted |
| [0003](0003-comrak-single-engine.md) | `comrak` is the single shipped engine; `cmark-gfm` is a test oracle | Accepted |
| [0004](0004-tauri-v2-single-runtime.md) | Tauri v2 as the single runtime for all six platforms | Accepted |
| [0005](0005-ast-plus-html-renderer.md) | Engine emits an AST; a bundled HTML renderer consumes it | Accepted |
| [0006](0006-split-view-editor-v1.md) | Split-view editor for v1; inline live preview deferred | Accepted |
| [0007](0007-storage-platform-conditional.md) | Storage is platform-conditional: folders on desktop, OPFS on web | Accepted |
| [0008](0008-gfm-only-v1.md) | GFM only in v1; Obsidian profile deferred | Accepted |
| [0009](0009-pnpm-cargo-monorepo.md) | pnpm + cargo monorepo | Accepted |
| [0010](0010-polyform-noncommercial-license.md) | PolyForm Noncommercial 1.0.0 | Accepted |
| [0011](0011-web-ships-first.md) | Web ships first | Accepted |
| [0012](0012-latency-budget-scoped-to-real-documents.md) | Latency budget scoped to real documents, not a synthetic 5 MB file | Accepted |
| [0013](0013-wrap-a-proven-html-sanitiser.md) | Wrap a proven HTML sanitiser; do not write one | Accepted |
| [0014](0014-sanitiser-v2-profile-free-allowlist.md) | Sanitiser hardening: profile-free allowlist, URL policy on raw HTML, forced safe path | Accepted · supersedes 0013 |
| [0015](0015-present-layer-verified-by-assertions.md) | Present-layer fidelity verified by structural/style/screenshot assertions, never by eye | Accepted |
| [0016](0016-perf-budgets-arbitrated-in-browser.md) | M1a/M1b perf budgets arbitrated in a browser; Node stays a recorded floor | Accepted |

[Template](0000-template.md)
