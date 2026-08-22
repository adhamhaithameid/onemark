# OneMark — Learning Roadmap

**Learn things when the build needs them, not before.** Each block is tied to the milestone that forces it. Skipping ahead wastes time you don't have.

Existing strengths: **Swift/macOS** (three shipped apps), **TypeScript/React/Vite** (Rally), **build tooling & repo hygiene** (Classroom-Quick-Downloader). New surface is **Rust**, **WASM**, **Tauri**, and **CodeMirror 6**.

Search queries are given rather than explanations — these are general external topics, and looking them up first-hand builds the research muscle that matters more than any summary.

---

## Before M0 — orientation only, ~a few hours

Enough Rust to read and modify a small crate. **Not** enough to be "good at Rust" — that comes from doing M0, not from reading.

🔎 `rust book chapter 1-6 ownership borrowing`
🔎 `rust cargo workspace multiple crates`
🔎 `rust Result Option error handling basics`

**Stop when:** you can read `comrak`'s public API and understand its signatures. That is the bar. Go no further.

---

## M0 — the WASM boundary

The single highest-leverage block in the whole project. Everything downstream assumes this works.

🔎 `wasm-bindgen tutorial rust to javascript`
🔎 `wasm-pack build target web vite`
🔎 `wasm-bindgen serde serialize struct to javascript`
🔎 `rust wasm performance serialization overhead large payloads`
🔎 `comrak rust api parse to ast arena`

**Understand before writing 0.3:** what actually crosses the JS↔WASM boundary, and why crossing it with a large structure is expensive. That is the entire content of open question OQ-4.

---

## M1a — the render layer (80% of the product)

🔎 `shiki bundled languages offline no cdn`
🔎 `katex bundle fonts self hosted`
🔎 `mermaid securityLevel strict api render`
🔎 `github markdown css light dark theme`
🔎 `html sanitizer allowlist xss markdown`
🔎 `commonmark spec test suite json runner`

**The insight to internalize:** the parser gives you structure; **none** of the above is parsing. This block is where "looks like GitHub" is actually won or lost.

---

## M1b — the fidelity harness

🔎 `github rest api post markdown render gfm`
🔎 `html normalization diff testing golden files`
🔎 `github flavored markdown spec extensions`

**Understand:** why golden files must be regenerated *deliberately* and never auto-refreshed. An auto-refresh silently promotes a regression to the new truth — it turns your only real proof into a rubber stamp.

---

## M1c — the editor

🔎 `codemirror 6 setup vite typescript`
🔎 `codemirror 6 markdown language support`
🔎 `codemirror 6 scroll sync preview pane`
🔎 `web worker offload parsing main thread`
🔎 `origin private file system opfs api browser`

**Understand:** why parsing must leave the main thread, and why OPFS — not File System Access — is the web storage answer (Safari does not implement `showDirectoryPicker`).

---

## M2 — Tauri, and where Swift knowledge finally pays off

🔎 `tauri v2 getting started existing frontend`
🔎 `tauri v2 commands invoke rust from javascript`
🔎 `tauri v2 file system plugin scoped permissions`
🔎 `macos security scoped bookmarks persistent folder access`
🔎 `tauri v2 macos code signing notarization`

**Your macOS background is directly reusable here** — sandboxing, security-scoped bookmarks, signing and notarization are the same concepts you already handled in KeepAwake / KeepClean / KeepMirror. This is the least new block in the project.

---

## M3 — cross-platform packaging

🔎 `tauri v2 windows webview2 bundle msi`
🔎 `tauri v2 linux webkitgtk performance issues`
🔎 `github actions matrix build tauri cross platform`

---

## M4 — mobile

🔎 `tauri v2 ios android setup requirements`
🔎 `tauri v2 mobile limitations known issues`
🔎 `android storage access framework document picker`

**Do the reading before the M4.1 spike**, so the go/no-go decision is informed rather than discovered halfway through.

---

## Deferred — only if v2 happens

🔎 `codemirror 6 decorations widget inline preview`
🔎 `lezer markdown parser extension`
🔎 `writing a commonmark parser from scratch`
🔎 `swift call rust static library c abi uniffi`

---

## The meta-skill this project is actually teaching

Not Rust. Not WASM. **Interface design under uncertainty.**

`MarkdownEngine` and `StorageProvider` are the two decisions that determine whether the parser can be swapped, whether a native Swift app is possible, and whether web and desktop stay one codebase. Every other technology here is replaceable. Those two interfaces are not.

If you can explain *why* the engine interface deliberately knows nothing about HTML, you have learned the transferable thing.
