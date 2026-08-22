# ADR-0004 — Tauri v2 as the single runtime for all six platforms

**Status:** Accepted · **Date:** 2026-08-16

## Context

Two requirements were stated together: *"build it for all platforms available"* and *"I want to ship it anyway."* These conflict — building N native UIs solo is the most reliable way to never ship.

An initial proposal mixed stacks: Swift for Apple, Tauri for Windows/Linux, TypeScript for web, Flutter for Android. Two corrections applied:

- **Tauri is not native** — it is a Rust shell around the OS webview, so its UI *is* the web UI. That is one stack shipped three ways, not two stacks.
- **Flutter is not native Android** — native Android is Kotlin + Jetpack Compose. Flutter draws its own widgets.

Applying "best per platform" consistently would require Swift + Kotlin/Compose + WinUI3 + GTK4 + TypeScript: **five UI codebases, five editors, five release pipelines**.

Rough cost, solo, full-time-equivalent:

| Path | UIs | Platforms | Total |
|---|---|---|---|
| Mixed native (Swift + Tauri + TS + Flutter) | 3 real UIs, 3 hand-built editors | 6 | **~9–15 months** |
| Tauri v2 everywhere | 1 UI + packaging | 6 | **~4–6 months** |

The engine is ~15–20% of the code. **The UI is the app** — each additional native UI is ~80% of a whole product, not 25%.

## Decision

**Tauri v2 as the single runtime.** One TypeScript UI, six targets: web, macOS, Windows, Linux, iOS/iPadOS, Android.

A native Swift Apple app remains an **optional later track**, not a v1 requirement — kept possible by ADR-0005.

## Alternatives rejected

| Option | Why rejected |
|---|---|
| Native UI per platform | ~1–3 years solo. Incompatible with shipping. |
| Apple-only native (Swift) | Best craft, matches the author's strongest skill, but abandons the explicitly stated cross-platform ambition. |
| Electron | Familiar and easy, but ~120 MB binaries — **directly violates metric M6** and the "data saver" premise. |
| Flutter | One codebase, all six, but Dart is new, FFI to `comrak` is required anyway, and markdown rendering would be hand-drawn with no HTML — the worst fit for a fidelity product. |

## Consequences

**Good:** the only branch where "all platforms" and "ship" coexist. Binaries ~5–10 MB. `comrak` links natively in Tauri and compiles to WASM for web — the same engine, genuinely everywhere. The UI is TypeScript, already a strength.

**Bad / accepted cost — three named risks:**
1. **Tauri v2 mobile is young** relative to its desktop support. M4 carries real risk and includes an explicit go/no-go spike.
2. **Linux WebKitGTK is the weakest webview** — the 200 ms budget is hardest to hit there.
3. **Webview ≠ native feel.** The author is a native macOS developer and *will* notice. Accepted knowingly.

**Reversibility:** the AST contract (ADR-0005) is what keeps a native Swift app buildable later without re-architecting.
