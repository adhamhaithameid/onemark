# OneMark — Build Plan

| Field | Value |
|---|---|
| Revised | 2026-08-16 |
| Constraint | Solo · bandwidth varies from zero to full-time |

---

## Principles

1. **Every milestone is independently shippable and usable.** No milestone leaves the project in a half-refactored state — bandwidth is unpredictable and a three-week gap must never land mid-surgery.
2. **The riskiest thing goes first inside each milestone.** If the WASM round-trip doesn't work, nothing else matters, so it is task one.
3. **Anything not required by the done-line ([PRD §5.1](02-PRD.md)) is deferred.** No exceptions, no "while I'm in here".

> Effort estimates below are **full-time-equivalent** and deliberately rough. With variable bandwidth, treat them as ordering information, not dates.

---

## M0 · Foundation — *prove the architecture*

**~1–2 weeks FTE**

| # | Task | Verify |
|---|---|---|
| 0.1 | pnpm workspace + cargo workspace skeleton | `pnpm install` and `cargo build` both succeed |
| 0.2 | `crates/onemark-engine` wrapping `comrak` | Rust test: markdown in → AST out |
| 0.3 | `crates/onemark-wasm` — wasm-bindgen boundary | **A markdown string goes from TS → WASM → AST → TS** |
| 0.4 | `packages/engine` — `MarkdownEngine` interface + WASM loader | TS test parses `# hello` to an AST node |
| 0.5 | CommonMark spec runner in CI | Prints a real pass-rate number |
| 0.6 | CI: lint, typecheck, clippy, test | Green on a clean checkout |
| 0.7 | **Answer OQ-3** — does `comrak` do GitHub alerts natively? | Documented in the PRD |
| 0.8 | **Answer OQ-4** — benchmark AST-across-boundary on 5 MB | Number recorded; §5 of the tech spec updated |

**Done when:** a markdown string round-trips through WASM into a typed AST, and CI prints a CommonMark pass-rate.

> **✅ Complete 2026-08-18.** All eight verify columns satisfied.
> CommonMark prints **652/652 = 100.00%**. Task 0.3 — the architecture gate — passes:
> a markdown string goes TS → WASM → AST → TS, and the WASM build's AST is
> **byte-identical** to the native build's on every fixture (NFR-6). OQ-3, OQ-4 and the
> newly-raised OQ-6 are all resolved. Nothing has been committed.

> ⚠️ **Task 0.3 is the whole architecture in one step.** If it doesn't work, stop and rethink before writing any UI. This is the cheapest possible place to discover the plan is wrong.

---

## M1 · Web — *the first shippable thing*

**~8–12 weeks FTE** · delivers the v1 done-line

### M1a — Render (the differentiator)
| # | Task | Verify |
|---|---|---|
| 1.1 | `packages/renderer` — AST → semantic HTML | ✅ **CommonMark 652/652 = 100.00%** through our own renderer |
| 1.2 | GFM extensions: tables, task lists, strikethrough, autolinks, footnotes | ✅ **GFM extensions 22/22 = 100.00%** (M4) |
| 1.3 | HTML sanitizer + allowlist | ✅ **49/49 XSS vectors blocked** ([ADR-0013](adr/0013-wrap-a-proven-html-sanitiser.md)) |
| 1.4 | GitHub Markdown CSS, light + dark | ✅ **2026-08-22** — vendored `github-markdown-css@5.8.1` light+dark ([ADR-0015](adr/0015-present-layer-verified-by-assertions.md)): structural + reference-value assertions in the default suite, screenshot diff opt-in (`test:visual`) |
| 1.5 | Shiki syntax highlighting, **bundled** | ✅ **2026-08-22** — adapter bundles grammars/themes statically; zero network asserted; sanitiser-surviving `tk-*` classes |
| 1.6 | KaTeX math, **bundled fonts** | ✅ **2026-08-22** — `$x^2$` typesets offline; hydration runs *after* sanitisation (trust:false) |
| 1.7 | Mermaid, `securityLevel: 'strict'`, **bundled** | ✅ **2026-08-22** — offline SVG proven in Chromium via file:// bundle; strict strips htmlLabels |
| 1.8 | GitHub alerts, heading anchors, emoji, frontmatter | ✅ **2026-08-22** — markdown-alert divs per vendored CSS; user-content anchors; gemoji map; frontmatter table. Baselines re-baked per ADR-0015 |

### M1b — Fidelity proof
| # | Task | Verify |
|---|---|---|
| 1.9 | Golden corpus: select 100 documents (**OQ-1**) | Selection rule written down |
| 1.10 | GitHub `POST /markdown` fetcher + committed goldens | Goldens in `fidelity/golden/` |
| 1.11 | HTML normalization rules (**OQ-2**) | Rules documented, not ad-hoc |
| 1.12 | Diff runner in CI | **M5 ≥ 98%** — blocking |
| 1.13 | Vendor `cmark-gfm` as triage oracle | Runs, never bundled |

### M1c — Editor & shell
| # | Task | Verify |
|---|---|---|
| 1.14 | CodeMirror 6 source pane, markdown coloring | ✅ **2026-08-22** — CM6 in split view, integration-tested under jsdom ([session log](session-logs/2026-08-22-m1c-editor.md)) |
| 1.15 | Split view, debounced live preview | ✅ **2026-08-22** — preview tracks typing (debounce 150 ms, 0 in tests) |
| 1.16 | Scroll sync (uses AST `position`) | ✅ **2026-08-22** — proportional sync; precise position mapping deferred (noted) |
| 1.17 | `OpfsStorage` + drag/drop + paste (**OQ-5**) | ✅ **2026-08-22** — contract suite on memory + fake-OPFS providers; open/edit/save/reopen byte-identical |
| 1.18 | Theme following system preference + override | ✅ **2026-08-22** — system/light/dark cycle, instant swap, data-theme stamped |
| 1.19 | Parsing off the main thread (Web Worker) | ✅ **2026-08-22** — worker behind the same `MarkdownEngine` seam; M1c non-blocking gate measured at 1.20 |
| 1.20 | Benchmark harness in CI | ✅/⚠️ **2026-08-22** — harness built; **[ADR-0016](adr/0016-perf-budgets-arbitrated-in-browser.md)**: Node/jsdom cannot arbitrate (render+sanitise ~1.6 s @ 100 KB, super-linear scaling, 250 KB OOMs the heap). Floor recorded; M1a/M1b budgets arbitrated in-browser at 1.22 |
| 1.21 | Bundle size budget | ✅ **2026-08-22** — `scripts/check-bundle.mjs`: initial payload **0.67 MB / 2 MB** gzipped (entry + preloads + WASM + worker; lazy grammar chunks excluded by design) |
| 1.22 | Deploy the web build | Publicly reachable URL |

**Done when the done-line sentence is literally true.** ✅ v1 shipped.

---

## M2 · macOS — *the real daily workflow*

**~2–4 weeks FTE** — reuses the entire M1 UI

| # | Task | Verify |
|---|---|---|
| 2.1 | Tauri v2 shell wrapping `apps/web` | App launches |
| 2.2 | `comrak` **native** (no WASM) behind the same interface | Same AST as web — determinism test |
| 2.3 | `FolderStorage` — open a folder, browse `.md` files | **Open a cloned repo, read its README** |
| 2.4 | Security-scoped bookmarks (folder access persists) | Access survives relaunch |
| 2.5 | Native menus, file associations, `.md` "Open With" | Double-click a `.md` opens OneMark |
| 2.6 | File watching — external edits refresh | `git pull` updates the view |
| 2.7 | Determinism: web output ≡ macOS output | Byte-identical on the corpus |
| 2.8 | Signed build / release artifact | Installable |

**Done when:** the original 2026-06-02 pain is solved on macOS. **This is the milestone the project was started for.**

---

## M3 · Windows + Linux

**~3–5 weeks FTE**

| # | Task | Verify |
|---|---|---|
| 3.1 | Windows build (WebView2) | Launches, renders, opens folders |
| 3.2 | Linux build (WebKitGTK) | Launches, renders, opens folders |
| 3.3 | Perf on WebKitGTK — **known weak point** | M1 holds, or a relaxed Linux budget is documented |
| 3.4 | CI matrix across all three desktop targets | Determinism green everywhere |
| 3.5 | Release packaging (`.msi`, `.AppImage`/`.deb`) | Installable on both |

---

## M4 · iOS · iPadOS · Android — *highest risk*

**~4–8 weeks FTE, wide variance**

| # | Task | Verify |
|---|---|---|
| 4.1 | Spike: Tauri v2 mobile viability — **timeboxed** | Go / no-go decision, written down |
| 4.2 | iOS/iPadOS build | Runs on device |
| 4.3 | Files app / document picker integration | Open a `.md` from Files |
| 4.4 | Android build + Storage Access Framework | Open a `.md` |
| 4.5 | Touch editing ergonomics in CodeMirror 6 | Usable one-handed |
| 4.6 | Determinism across mobile targets | Byte-identical |

> ⚠️ **Task 4.1 is a genuine go/no-go.** Tauri v2 mobile is far younger than its desktop support. If the spike fails, **M1–M3 still constitute the shipped product** — record the outcome in an ADR and move on. Do not sink weeks into rescuing it.

---

## v2 candidates — *not scheduled, not promised*

Ordered by expected value, all deferred until v1 ships and gets used daily:

1. **Inline live preview** (CodeMirror 6 decorations, Obsidian-style) — costs a permanent second parser (Lezer)
2. **Obsidian dialect profile + switch** — the original two-engine idea, done correctly as one engine with profiles
3. **Search across documents**
4. **Native Swift Apple app** consuming the same AST (ADR-0005 keeps this open)
5. **Print / PDF export**
6. **Replace `comrak` with a from-scratch parser** behind the same interface — the deep-learning payoff of ADR-0002, with a working reference to diff against

---

## Progress

| Milestone | Status |
|---|---|
| M0 · Foundation | ✅ **complete** — see [session log](session-logs/2026-08-18-m0-foundation.md) |
| M1 · Web | ✅ **v0.1.0 shipped + deployed** — [app](https://adhamhaithameid.github.io/onemark/app/); M3/M4 100%, M5 100% gated, M6 0.95 MB; perf ladder rung 1 done ([ADR-0019](adr/0019-browser-perf-arbitration-results.md)) |
| M2 · macOS | 🟡 **started** — spike GO + task 2.1/2.2 done (shell compiles, native comrak behind the same interface, determinism proven in-shell; [ADR-0020](adr/0020-tauri-v2-spike-gonogo.md)); 2.3–2.8 ticketed |
| M3 · Windows + Linux | ⬜ not started |
| M4 · Mobile | ⬜ not started |
