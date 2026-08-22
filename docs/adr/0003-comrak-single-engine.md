# ADR-0003 — `comrak` is the single shipped engine; `cmark-gfm` is a test oracle

**Status:** Accepted · **Date:** 2026-08-16

## Context

An early proposal was to ship **`cmark-gfm` on some platforms and `comrak` on others** — "the base is cmark-gfm, and on any other platform it would be comrak."

**That proposal recreates the exact bug this project exists to fix.** `comrak` is a *port* of `cmark-gfm`, not a clone; edge cases can diverge. Two engines would mean:

- every dialect extension implemented twice, in C and in Rust
- the fidelity suite running twice, able to pass on one platform and fail on another
- the same document potentially rendering differently on macOS and Windows — the precise failure ADR-0001 promises to eliminate

Given ADR-0004 (Tauri everywhere), v1 targets are **WASM (web)** and **native Rust (Tauri)**. `comrak` covers both. `cmark-gfm` would only become relevant for a native Swift app — and even then `comrak` compiles to a C-ABI static library that Swift can link.

## Decision

**`comrak` is the only engine that ships. Everywhere. No exceptions.**

`cmark-gfm` is vendored in the repository **as a test oracle only** — never built into a shipped artifact. When `comrak` and GitHub disagree, `cmark-gfm` identifies which side is wrong.

Three verification oracles: GitHub's `POST /markdown` API (ground truth) · CommonMark + GFM spec suites (floor) · `cmark-gfm` (triage).

## Alternatives rejected

| Option | Why rejected |
|---|---|
| `cmark-gfm` everywhere | Maximum fidelity, but the C→WASM (Emscripten) toolchain would cost weeks, and it does not fit the Tauri/Rust runtime naturally. |
| Two engines split by platform | Recreates the cross-platform divergence bug. Doubles the extension and test surface. |
| A JS parser (`remark` / `markdown-it`) | Easiest start, but not GFM-exact, cannot meet the 200 ms / 5 MB budget on mobile, and forecloses the native path entirely. |

## Consequences

**Good:** one parser everywhere makes cross-platform determinism *structural* rather than aspirational. Any rendering difference between platforms is provably a render- or present-layer bug — never a parse bug. One Rust crate serves web (WASM) and every Tauri target.

**Bad / accepted cost:** `comrak` may diverge from `cmark-gfm` on edge cases; those must be caught by the oracle and either patched in the render layer or filed upstream. The project takes a dependency on a crate it does not control.

**Reversibility:** moderate — the `MarkdownEngine` interface (ADR-0002) is what makes an engine swap possible at all.
