# OneMark — Product Requirements Document

| Field | Value |
|---|---|
| Product | **OneMark** |
| Version | 0.1.0 |
| Status | **Draft — scope approved, pre-implementation** |
| Owner | Adham Haitham Eid ([@adhamhaithameid](https://github.com/adhamhaithameid)) |
| Originated | 2026-06-02 (initial scoping session) |
| This revision | 2026-08-16 (architecture session) |
| Repository | https://github.com/adhamhaithameid/onemark |
| License | PolyForm Noncommercial 1.0.0 |
| Supersedes | `docs/session-logs/2026-06-02-initial-scoping.md` |

---

## 1. Problem

Markdown renders differently everywhere.

The author writes documentation in GitHub Flavored Markdown (GFM), knows that dialect well, and relies on how github.com renders it. But that rendering **only exists inside github.com**:

- On **macOS**, there is no easy way to view a `.md` file from a cloned repository as GitHub would render it. The options are a browser round-trip to github.com, a Mac-only view-only Quick Look plugin, or an editor with a *different* markdown dialect (Obsidian, Typora, iA Writer).
- On **iPhone / iPad**, viewing or creating markdown means either a git client with a non-GitHub-exact preview, or a note app with its own incompatible flavor.
- Every web-based editor sends the document to a server to be rendered, or re-renders through a dialect that is not GFM.

The result: **the same file looks different depending on where you open it**, and the closest thing to a canonical renderer requires an internet connection and a github.com page load.

### Evidence this is real

| Existing tool | What it does | Why it does not solve this |
|---|---|---|
| github.com | The reference rendering | Requires network; requires the file be pushed |
| QLMarkdown | Quick Look preview on macOS | View-only, macOS-only, not GFM-exact |
| Obsidian | Excellent editor | Obsidian dialect ≠ GFM (`[[wikilinks]]`, callouts, no GFM-exact tables/alerts) |
| Typora | WYSIWYG editor | Own dialect, closed source, desktop only |
| iA Writer | Focused writing | Not a fidelity tool, not GFM-exact |
| VS Code preview | Built-in preview | markdown-it based, not GFM-exact, desktop only |
| Working Copy (iOS) | Git client with preview | Preview is not GFM-exact; iOS-only |

**Nothing renders GFM identically, offline, on every platform.**

---

## 2. What OneMark is

> **GitHub-identical Markdown rendering, offline, on every device — because GitHub's fidelity currently only exists inside github.com.**

One parsing engine, one rendering layer, six platforms, no server.

### What "identical" means precisely

OneMark's output is **verifiable against GitHub's own renderer**, not asserted. See §7 (Fidelity) and §8 (Verification).

---

## 3. Goals

Ranked. When two goals conflict, the higher-ranked one wins.

| # | Goal | Why it is ranked here |
|---|---|---|
| **G1** | **Ship.** A usable build exists and the author uses it daily. | Stated primary goal. An unshipped engine teaches nothing and serves nobody. |
| **G2** | **Fidelity is provable.** The "identical to GitHub" claim is backed by a test that can fail. | This *is* the product. An unprovable claim is marketing. |
| **G3** | **Learn systems work deeply** — parsing, AST design, FFI, WASM, cross-platform packaging. | Author's stated learning goal. Served by the *architecture*, not by rewriting a parser. |
| **G4** | **Portfolio artifact** — a large-scale, genuinely cross-platform project. | Falls out of G1–G3 if they are done honestly. |
| **G5** | **Real users beyond the author.** | A consequence, never a driver. Explicitly not allowed to expand scope. |

## 3.1 Non-goals

Explicitly **not** what OneMark is. Each of these is a scope-creep vector that has been named and closed.

- ❌ **Not a note-taking app.** No graph view, no daily notes, no backlinks, no tags-as-database.
- ❌ **Not a knowledge base / PKM tool.** Obsidian's territory. Not competing.
- ❌ **Not a sync service.** No accounts, no server, no cloud storage, no conflict resolution — in v1 or v2.
- ❌ **Not a git client.** OneMark reads folders. It does not clone, pull, commit, or diff.
- ❌ **Not a publishing platform.** No static site generation, no hosting, no sharing links.
- ❌ **Not a plugin platform.** No third-party extension API until the core is proven (see §10).
- ❌ **Not a WYSIWYG editor.** Markdown source stays visible and authoritative.
- ❌ **Not multi-dialect in v1.** GFM only. Obsidian-compatibility profile is deferred (ADR-0008).

---

## 4. Target user

**Primary (User #1): the author.** Reads READMEs and documentation from cloned repositories on macOS; reviews and lightly edits notes on iPad. Files typically under 100 KB, dozens per week, mostly **read** with occasional small edits.

**Secondary: developers.** Anyone who writes GFM for GitHub and wants to see it correctly without pushing it first.

**Explicitly not targeted:** general note-takers, students looking for a study tool, writers looking for a prose environment. Those audiences license infinite features and are how this project dies.

### Primary user journey (v1)

```
1. Developer clones a repo, or has a .md file
2. Opens it in OneMark
3. Sees it rendered EXACTLY as github.com would render it — offline, instantly
4. Makes a small edit in the source pane
5. Preview updates live; file saves in place
```

---

## 5. Success criteria

### 5.1 The done-line for v1

> **"On web, I can open a markdown file, see it rendered GitHub-identically — with syntax highlighting, math, Mermaid and alerts — edit it in a split view whose preview updates live, and have a typical document (100 KB) render in under 100 ms with zero server calls."**

Every "should I build X?" question during v1 is answered against this sentence. If X is not required by it, X is v2.

> **Note on a resolved tension:** the original done-line said "live preview". Per ADR-0006, v1 ships **split view** (source pane + rendered pane, live-updating, scroll-synced), *not* inline live preview. Inline decoration is a v2 upgrade. The done-line above reflects the resolved scope.

### 5.2 Measurable acceptance metrics

| ID | Metric | Target | How measured |
|---|---|---|---|
| **M1a** | Render latency — real workload | 100 KB → first paint **< 100 ms** | Benchmark harness, cold render, reference device below |
| **M1b** | Render latency — large document | 1 MB → first paint **< 500 ms** | Same harness |
| **M1c** | Responsiveness — pathological document | 5 MB **must not block the UI thread**; no first-paint target | Main-thread blocking assertion, not a latency gate |
| **M2** | Network independence | **Zero** first-party server round-trips for parse / render / highlight / math / diagrams | Network-request assertion in E2E test; all assets bundled |
| **M3** | CommonMark conformance | **≥ 99%** of the CommonMark spec suite | `commonmark spec.json` runner in CI |
| **M4** | GFM extension conformance | **100%** of the GFM extension spec suite | GFM spec runner in CI |
| **M5** | GitHub output parity | **≥ 98%** of a 100-document golden corpus matches GitHub's own renderer after normalization | Diff vs `POST /markdown` GitHub API (CI only) |
| **M6** | Bundle size (web) | Initial JS + WASM payload **< 2 MB** gzipped | CI size budget check |

**Reference device for M1a–M1c:** the author's Mac, rendering inside WKWebView, cold start, no warm cache. A performance target without a named machine is unenforceable.

> **Revised 2026-08-18 — see [ADR-0012](adr/0012-latency-budget-scoped-to-real-documents.md).** M1 was
> originally a single gate: 5 MB → 200 ms. Measurement showed native parsing alone
> consumes 186 ms of that, and the WASM engine needs **1641 ms** end-to-end — while at the
> file size §4 actually describes (under 100 KB) the same engine costs **30 ms**. The 5 MB
> figure was ~50× the real workload and was the only thing forcing an architecture
> [ADR-0005](adr/0005-ast-plus-html-renderer.md) rejects. The tiers above replace it.
>
> **Caveat carried forward:** M1a–M1c are set from **engine-only** measurements. The render
> layer — Shiki, KaTeX, Mermaid, sanitisation, CSS — is ~80% of the work and is unmeasured.
> The 70 ms of headroom in M1a is an assumption. Revisit at task 1.20.

### 5.3 The network rule, stated precisely (M2)

> No first-party server round-trip. Parsing, rendering, syntax highlighting, math typesetting, and diagram rendering run **fully on-device** with all assets bundled into the application. The network is used **only** for user-authored remote resources — e.g. `![alt](https://example.com/img.png)` — which are fetched directly by the client, exactly as any document viewer would.

This is the clause that makes M2 enforceable in CI: any request to a OneMark-controlled host during render = test failure.

---

## 6. Scope — v1

### 6.1 In scope

**Rendering (the core)**

| Feature | Layer | Notes |
|---|---|---|
| CommonMark: headings, paragraphs, lists, blockquotes, code, emphasis, links, images, HR, HTML blocks | Parser (`comrak`) | Baseline |
| GFM: tables, task lists, strikethrough, autolinks, footnotes | Parser (`comrak`) | GFM spec extensions |
| GitHub alerts (`> [!NOTE]`, `[!TIP]`, `[!WARNING]`, `[!IMPORTANT]`, `[!CAUTION]`) | Parser + renderer | Requires GitHub's alert CSS |
| YAML frontmatter | Parser | Parsed and displayed as a metadata block |
| Syntax highlighting in fenced code blocks | **Renderer** (Shiki, bundled) | Not a parser feature |
| Math (`$inline$`, `$$block$$`) | Parser delimiters + **renderer** (KaTeX, bundled) | Not a parser feature |
| Mermaid diagrams (```` ```mermaid ````) | **Renderer** (mermaid.js, bundled) | Not a parser feature |
| Emoji shortcodes (`:tada:`) | Renderer | Bundled emoji map |
| GitHub Markdown CSS, light + dark | Renderer | Theme-aware |
| HTML sanitization | Renderer | Security requirement, see §9 |
| Heading anchors + auto table of contents | Renderer | GitHub behavior |

**Editing**

- Split view: source pane (CodeMirror 6, markdown syntax coloring) + rendered pane
- Live preview update on edit (debounced)
- Scroll synchronization between panes
- Undo / redo, selection, IME, mobile touch — inherited from CodeMirror 6
- Save in place

**Files (web target)**

- Drag & drop a `.md` file
- Paste markdown text
- Open from an app-owned library backed by **OPFS** (Origin Private File System)
- Export / download rendered HTML

### 6.2 Out of scope for v1 — deferred, with the release they belong to

| Deferred item | Target | Why not now |
|---|---|---|
| Folder / cloned-repo browsing | **M2 (desktop)** | Safari does not support the File System Access API — impossible on web (ADR-0007) |
| Inline live preview (Obsidian-style decorations) | v2 | Costs a second parser (Lezer) permanently; feel upgrade, not the core |
| Obsidian dialect profile + dialect switch | v2 | GFM must be perfect before it can be a *profile* of anything |
| Sync between devices (iCloud / git / anything) | Not planned | Explicit non-goal |
| Plugin / extension API | v3 at the earliest | Generalize after the core is proven, never before |
| Native Swift Apple app | Optional later track | +12–20 weeks; the AST contract (ADR-0005) keeps the door open |
| Search across documents | v2 | Not required by the done-line |
| Print / PDF export | v2 | Not required by the done-line |

---

## 7. Fidelity — what "GitHub-identical" means

Fidelity is the product. It is defined in **three layers**, and it is important to know which layer a bug lives in.

| Layer | Owner | What can go wrong |
|---|---|---|
| **Parse** | `comrak` (Rust) | Structural divergence — a table not recognized, a list nesting wrong |
| **Render** | OneMark's TS renderer | HTML shape divergence — wrong element, wrong class, missing anchor |
| **Present** | Bundled CSS + Shiki + KaTeX + Mermaid | Visual divergence — wrong font, wrong code colors, wrong spacing |

A rendering difference between two platforms is **always** a Present-layer or Render-layer bug, never a Parse-layer bug — because there is exactly one parser, shipped everywhere (ADR-0003). This is the property that makes the whole architecture worth it.

### Known fidelity gaps that are accepted in v1

- **`linguist` language detection.** GitHub uses its own language classifier for fenced blocks; OneMark uses Shiki's grammar set. Rare divergences on obscure languages are accepted.
- **`#123` / `@user` autolinks.** These are repository-context-dependent. OneMark has no repository context, so these render as plain text. Documented, not a bug.
- **GitHub's HTML sanitizer** is not published in full. OneMark uses an equivalent allowlist; edge cases may differ.

---

## 8. Verification strategy

The claim "identical to GitHub" must be able to **fail a build**.

| Level | What | Gate |
|---|---|---|
| **1. Spec suites** | CommonMark spec (`spec.json`) + GFM extension spec, run against the engine | M3 ≥ 99%, M4 = 100% — CI blocking |
| **2. Golden corpus** | 100 real-world `README.md` files rendered through **GitHub's `POST /markdown` API**, stored as golden files, diffed against OneMark output after HTML normalization | M5 ≥ 98% — CI blocking |
| **3. Reference engine** | `cmark-gfm` (GitHub's actual C engine) kept as a third oracle for triaging disputes | Non-blocking, diagnostic |
| **4. Performance** | Benchmark corpus: 100 KB, 1 MB and a synthetic 5 MB document | M1a/M1b latency + M1c non-blocking — CI blocking |
| **5. Visual regression** | Screenshot diffs of the rendered pane across themes | Non-blocking initially |

**`cmark-gfm` is never shipped.** It exists in the repository solely as a test oracle. Only `comrak` ships. (ADR-0003)

**Note:** levels 2 and 3 use the network **in CI only**. This does not conflict with M2, which governs runtime behavior in the shipped application.

---

## 9. Non-functional requirements

| ID | Requirement |
|---|---|
| **NFR-1** | **Offline-first.** The application must be fully functional with the network disabled, except for user-authored remote images. |
| **NFR-2** | **Security.** All rendered HTML must be sanitized. Raw HTML in markdown must not be able to execute scripts, exfiltrate data, or load first-party-looking resources. `javascript:` URLs blocked. Mermaid runs with `securityLevel: strict`. |
| **NFR-3** | **Performance.** M1 must hold. Rendering must not block the UI thread — parsing runs off the main thread (Web Worker on web, native thread elsewhere). |
| **NFR-4** | **Accessibility.** Rendered output must be keyboard-navigable and screen-reader-correct; semantic HTML, not `div` soup. Both themes must meet WCAG AA contrast. |
| **NFR-5** | **Theme.** Light and dark, following system preference, with manual override. |
| **NFR-6** | **Determinism.** The same input produces byte-identical output on every platform. Verified by running the golden corpus on every CI target. |
| **NFR-7** | **Size.** M6 must hold. This is what disqualifies Electron. |

---

## 10. Platform plan

One UI codebase (TypeScript), one engine (`comrak`), six targets via Tauri v2. (ADR-0004)

| Milestone | Platform | Shell | Engine build | Storage | Status |
|---|---|---|---|---|---|
| **M1** | Web | browser | `comrak` → **WASM** | OPFS (import) | v1 target |
| **M2** | macOS | Tauri v2 / WKWebView | `comrak` native | Folder + security-scoped bookmarks | Unlocks the real workflow |
| **M3** | Windows, Linux | Tauri v2 / WebView2, WebKitGTK | `comrak` native | Folder | |
| **M4** | iOS, iPadOS, Android | Tauri v2 | `comrak` native | Files app / SAF | Highest risk |

**Sequencing rationale:** web ships first because it has the fastest feedback loop — no code signing, no store review, instant dogfooding of the hard part (fidelity). It proves the engine and the editor. It does **not** deliver the author's actual daily workflow — that arrives at M2, which reuses the entire M1 UI.

---

## 11. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Tauri v2 mobile is young** — much newer than its desktop support | High | M4 is last. If it collapses, M1–M3 still ship and still constitute the product. |
| **Linux WebKitGTK is the weakest webview** — slower, more rendering quirks | Medium | M1 must hold on Linux too; if not, Linux gets a documented relaxed budget. |
| **Webview ≠ native feel**, and the author is a native macOS developer who will notice | Medium | Accepted knowingly. The AST contract (ADR-0005) keeps a native Swift app buildable later. |
| **`comrak` diverges from `cmark-gfm`** on edge cases | Medium | Level-3 oracle catches it; divergences get filed upstream or patched in the render layer. |
| **The Present layer is the real work**, and it is easy to underestimate | High | Explicitly budgeted: highlighting, math, diagrams, CSS and sanitization are ~80% of "looks like GitHub". |
| **Intermittent bandwidth** — author has no fixed hours per week | High | Milestones are individually shippable; ADRs record *why* so a 3-week gap does not restart the reasoning. |
| **Scope creep toward "note app"** | High | §3.1 non-goals are binding. Anything not required by §5.1 is v2. |

---

## 12. Open questions

| # | Question | Blocks | Owner | Status |
|---|---|---|---|---|
| OQ-1 | Which 100 documents form the golden corpus? Needs a selection rule, not a vibe. | M5 | Author | ✅ **Resolved 2026-08-22** |
| OQ-2 | HTML normalization rules for the GitHub diff — GitHub adds anchors, `dir` attributes, camo image proxying. What is normalized away vs. what counts as a real difference? | M5 | Author | ✅ **Resolved 2026-08-22** |
| OQ-3 | Does `comrak` support GitHub alerts natively, or is that a render-layer implementation? | §6.1 | To verify | ✅ **Resolved 2026-08-18** |
| OQ-4 | AST transport across the WASM boundary — serialize to JSON, or render to HTML inside WASM and pass a string? Directly affects M1. | M1, ADR-0005 | To benchmark | ✅ **Resolved 2026-08-18** |
| OQ-5 | Where does the app-owned OPFS library live conceptually — a real library, or just a recent-files cache? | §6.1 | Author | ✅ **Resolved 2026-08-22** |
| **OQ-6** | **Is the M1 target (5 MB → 200 ms) the right metric?** Measurement says parsing alone costs 186 ms of it, on native, at ~50× the file size §4 describes. | M1, ADR-0005 | Author | ✅ **Resolved 2026-08-18 — [ADR-0012](adr/0012-latency-budget-scoped-to-real-documents.md)** |

### OQ-3 — resolved: alerts are parser-layer

`comrak` exposes `extension.alerts` and emits a first-class `Alert` AST node carrying a
typed `AlertType` for all five GitHub markers. The renderer receives a typed node rather
than having to sniff a blockquote. Verified in source and by test; see
[the M0 session log](session-logs/2026-08-18-m0-foundation.md).

Every other parser-layer feature in §6.1 is likewise a native `comrak` option.

### OQ-4 — resolved: design A does not survive 5 MB

Benchmarked on the reference Mac, release build, 9 runs after warmup:

| Document | Native parse | Native A | **WASM A (end-to-end)** | **WASM B (HTML)** |
|---:|---:|---:|---:|---:|
| 100 KB | 4.6 ms | 5.4 ms | **30.0 ms** | 6.7 ms |
| 1 MB | 33.6 ms | 65.1 ms | **335.0 ms** | 80.0 ms |
| **5 MB** | **186.0 ms** | **389.5 ms** | **1640.7 ms** | 352.7 ms |

WASM design A runs ~4× slower than native and produces a payload **16.9× the source
size** (5 MB in, 82.7 MB out). Design B is faster but moves rendering into Rust, which
contradicts ADR-0005 — and at 5 MB it still misses the original 200 ms gate.

**How this was resolved:** not by changing the transport, but by changing the metric —
see OQ-6 below. At the real workload, design A costs 30 ms and ADR-0005 is untouched.

### OQ-6 — resolved: the budget is now scoped to real documents

Parsing alone consumes **93% of the 200 ms budget** at 5 MB. No transport design
recovers that. At the size §4 actually describes — under 100 KB — design A costs 5.4 ms,
or 2.7% of budget.

**Resolved: option 1 — re-scope to the real workload.** M1 is replaced by the tiered
M1a/M1b/M1c in §5.2. Full reasoning and rejected alternatives in
[ADR-0012](adr/0012-latency-budget-scoped-to-real-documents.md).

The consequence worth remembering: **ADR-0005 survives.** Design A — the AST as the
contract, with source positions — is viable at 100 KB (30 ms end-to-end through WASM).
The hybrid transport described in tech spec §5 is deferred, not adopted.

### OQ-1 — resolved: the corpus selection rule (2026-08-22)

A deterministic, reproducible, stratified rule. The corpus is selected once, committed as a
manifest (`fidelity/golden/manifest.json` with source URL, commit SHA, fetch date, file size),
and frozen. Re-selection is a new decision, never a re-roll.

1. **Pool.** Public repositories' rendered markdown fetched via `POST /markdown` — READMEs,
   CONTRIBUTING, ARCHITECTURE and docs/ files. Public repos only (API access without auth
   ambiguity); each document 5–200 KB (below 5 KB exercises too little; above 200 KB is
   outside the §4 workload).
2. **Strata** (targets, filled in order until 100):
   - 55 — READMEs of developer tooling, across ≥ 8 primary languages and 4 star bands
     (< 100, 100–1k, 1k–10k, > 10k stars)
   - 25 — long-form documentation files (docs/, ARCHITECTURE, CONTRIBUTING) with heavy
     prose, tables and nested lists
   - 12 — feature-rich GFM documents (tables + task lists + alerts + code fences combined)
   - 8 — adversarial/edge documents: deep nesting, raw HTML blocks, footnotes, autolinks
3. **Determinism.** Candidates drawn with a seeded PRNG (seed committed next to the
   manifest); any reviewer can re-run the selection and get the same 100 files.
4. **Exclusions.** Documents whose rendering depends on repository context OneMark cannot
   know (e.g. `#123` issue autolinks resolving, wikis, gists with Liquid). Known-gap
   documents are allowed but tagged in the manifest so a known-gap failure ≠ corpus failure.

### OQ-2 — resolved: normalization rules (2026-08-22)

Comparison is **structural, not textual**: both GitHub's response and OneMark's output are
parsed to a DOM (`parse5`), normalizations are applied to both sides, then trees are diffed.
String-level diffing would drown in attribute ordering and whitespace. The rules live in
`fidelity/src/normalize.ts` with a unit test per rule, each rule named after the GitHub
artifact it neutralises:

| Rule | GitHub artifact normalized away | Why it is not a real difference |
|---|---|---|
| R1 strip heading anchors | `<a id="user-content-…" class="anchor">` injected into every heading | GitHub-side chrome, not rendering semantics; OneMark adds its own anchors by design (§6.1) |
| R2 strip `dir` attributes | `dir="auto"` on containers | Bidirectional-text hint, not content |
| R3 camo images | `<img src="https://camo.githubusercontent.com/…">` | Proxy detail: both sides must simply render a remote image at the same position with the same alt; final URL compared only when neither side is camo |
| R4 comment/whitespace between blocks | inter-block whitespace and HTML comments | Parser-dependent formatting |
| R5 attribute order + boolean attrs | attribute serialization order | DOM-equivalent |
| R6 `g-emoji` wrapping | GitHub wraps some emoji in `<g-emoji>` | Presentation wrapper |

Anything not covered by R1–R6 **counts as a real difference**. The rule set is extensible
but each addition needs a named GitHub artifact and a test — the same discipline as the
XSS corpus. The M5 ≥ 98% gate is computed after R1–R6, per document, then averaged.

### OQ-5 — resolved: the OPFS library is a recent-files store (2026-08-22)

Minimal surface, deliberately not a "library" app: OPFS holds the **imported documents and
nothing else** — `{ id, name, size, modifiedAt, content }` per file, restored across
sessions. No folders, no tags, no collections, no metadata editing. Reasons:

- The primary workflow (cloned repo) arrives at M2 via `FolderStorage` (ADR-0007); on web,
  files arrive by drag/drop or paste, and the only question worth answering is "can I get
  back to yesterday's file".
- A managed library invites staleness (the exact problem ADR-0007 rejected for folders)
  and licenses note-app scope creep (§3.1).
- Task 1.17's verify column ("Open, edit, save, reopen") is fully satisfied by the store.

---

## 13. Decision record

Every decision in this document traces to an ADR in [`docs/adr/`](./adr/). If a decision here seems wrong later, read the ADR first — it records the alternatives that were rejected and why.

| ADR | Decision |
|---|---|
| [0001](./adr/0001-differentiator-github-fidelity-offline.md) | Differentiator: GitHub-identical rendering, offline, everywhere |
| [0002](./adr/0002-wrap-existing-parser-behind-interface.md) | Wrap an existing parser behind our own interface; do not write one |
| [0003](./adr/0003-comrak-single-engine.md) | `comrak` is the single shipped engine; `cmark-gfm` + GitHub API are oracles |
| [0004](./adr/0004-tauri-v2-single-runtime.md) | Tauri v2 as the single runtime for all six platforms |
| [0005](./adr/0005-ast-plus-html-renderer.md) | Engine emits an AST; a bundled HTML renderer consumes it |
| [0006](./adr/0006-split-view-editor-v1.md) | Split-view editor for v1; inline live preview deferred |
| [0007](./adr/0007-storage-platform-conditional.md) | Storage is platform-conditional: folders on desktop, OPFS on web |
| [0008](./adr/0008-gfm-only-v1.md) | GFM-only dialect in v1; Obsidian profile deferred |
| [0009](./adr/0009-pnpm-cargo-monorepo.md) | pnpm + cargo monorepo |
| [0010](./adr/0010-polyform-noncommercial-license.md) | PolyForm Noncommercial 1.0.0 |
| [0011](./adr/0011-web-ships-first.md) | Web ships first |
