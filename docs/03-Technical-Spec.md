# OneMark — Technical Specification

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft |
| Revised | 2026-08-16 |
| Depends on | [02-PRD.md](02-PRD.md) |

---

## 1. System overview

```
┌───────────────────────────────────────────────────────────────┐
│                      OneMark UI  (TypeScript)                 │
│                                                               │
│   ┌─────────────────┐              ┌──────────────────────┐   │
│   │  Source pane    │   markdown   │   Rendered pane      │   │
│   │  CodeMirror 6   │─────────────▶│   sanitized HTML     │   │
│   └─────────────────┘              └──────────▲───────────┘   │
│            │                                  │               │
│            │  text                            │  HTML         │
│            ▼                                  │               │
│   ┌──────────────────────────────────────────┴────────────┐   │
│   │  MarkdownEngine  (interface — ADR-0002)                │   │
│   └───────────────────────┬───────────────────────────────┘   │
└───────────────────────────┼───────────────────────────────────┘
                            │  parse(text) → AST
              ┌─────────────┴──────────────┐
              │   comrak  (Rust)           │   ONE parser, all platforms
              │   CommonMark + GFM         │
              └─────────────┬──────────────┘
                            │  AST
              ┌─────────────┴──────────────┐
              │  HtmlRenderer  (TS)        │
              │  Shiki · KaTeX · Mermaid   │   ← the 80% of "looks like GitHub"
              │  GitHub CSS · sanitizer    │
              └────────────────────────────┘

     Storage is separate and platform-conditional (ADR-0007):
     ┌──────────────────────────────────────────────────────┐
     │  StorageProvider (interface)                         │
     │  ├── OpfsStorage      (web)                          │
     │  └── FolderStorage    (Tauri: desktop + mobile)      │
     └──────────────────────────────────────────────────────┘
```

**Two interfaces carry the whole architecture:** `MarkdownEngine` and `StorageProvider`. Everything else is an implementation detail that can be replaced.

---

## 2. Repository layout

```
onemark/
├── README.md
├── LICENSE.md
├── CHANGELOG.md
├── HANDOFF.md
├── pnpm-workspace.yaml
├── Cargo.toml                       # rust workspace root
├── package.json
│
├── crates/
│   ├── onemark-engine/              # comrak wrapper → AST (Rust)
│   │   ├── src/lib.rs
│   │   └── Cargo.toml
│   └── onemark-wasm/                # wasm-bindgen boundary for web
│       ├── src/lib.rs
│       └── Cargo.toml
│
├── packages/
│   ├── engine/                      # TS: MarkdownEngine interface + WASM loader
│   ├── renderer/                    # TS: AST → sanitized HTML (Shiki/KaTeX/Mermaid)
│   ├── storage/                     # TS: StorageProvider interface + impls
│   └── ui/                          # TS: shared components, CodeMirror setup, themes
│
├── apps/
│   ├── web/                         # M1 — Vite + TS
│   └── desktop/                     # M2+ — Tauri v2 shell (wraps apps/web build)
│
├── fidelity/                        # the proof that the differentiator is real
│   ├── spec/                        # CommonMark + GFM spec suites
│   ├── corpus/                      # 100 real-world .md documents
│   ├── golden/                      # GitHub API output, committed
│   ├── normalize.ts                 # HTML normalization rules (OQ-2)
│   └── runner.ts
│
├── bench/                           # perf harness for M1a/M1b (ADR-0012)
│
└── docs/
    ├── 00-README.md … 05-Learning-Roadmap.md
    ├── adr/
    └── session-logs/
```

**Why the engine is a versioned internal package:** semver, a changelog and breaking-change discipline are applied to `packages/engine` even though it is not published. It costs almost nothing and it is what keeps the boundary honest enough that ADR-0002's "swap in our own parser later" stays possible.

---

## 3. Interface: `MarkdownEngine`

The contract that makes ADR-0002 (wrap now, replace later) real. Any parser that satisfies this can be swapped in without touching the UI.

```ts
/** Stable AST — the contract. Modelled on CommonMark + GFM node types. */
export interface MarkdownNode {
  type: NodeType;
  children?: MarkdownNode[];
  literal?: string;
  /** node-specific: level, url, title, lang, checked, align, … */
  attrs?: Record<string, string | number | boolean | null>;
  /** source range, required for scroll-sync and future inline preview */
  position?: { start: Point; end: Point };
}

export interface Point { line: number; column: number; offset: number; }

export interface ParseOptions {
  /** GFM in v1. Additional profiles are ADR-0008 / v2. */
  dialect: 'gfm';
  extensions: {
    tables: boolean; strikethrough: boolean; autolink: boolean;
    taskList: boolean; footnotes: boolean;
    alerts: boolean;      // > [!NOTE]
    math: boolean;        // $…$ / $$…$$ delimiters only; typesetting is renderer-side
    frontmatter: boolean;
  };
}

export interface MarkdownEngine {
  readonly id: string;        // 'comrak-wasm' | 'comrak-native' | future
  readonly version: string;
  parse(source: string, options: ParseOptions): Promise<MarkdownNode>;
}
```

**Deliberately absent from this interface:** anything about HTML, themes, highlighting or diagrams. Those live in the renderer. A parser swap must never require a renderer change.

## 4. Interface: `StorageProvider`

```ts
export interface DocumentRef {
  id: string;
  name: string;
  /** display path; not necessarily a real filesystem path (OPFS has none) */
  path: string;
  size: number;
  modifiedAt: number;
}

export interface StorageProvider {
  readonly id: 'opfs' | 'folder';
  readonly capabilities: {
    /** false on web — Safari has no File System Access API (ADR-0007) */
    canOpenFolder: boolean;
    canWrite: boolean;
    canWatch: boolean;
  };
  list(scope?: string): Promise<DocumentRef[]>;
  read(ref: DocumentRef): Promise<string>;
  write(ref: DocumentRef, content: string): Promise<void>;
  watch?(ref: DocumentRef, cb: (content: string) => void): () => void;
}
```

The UI **must** branch on `capabilities`, never on platform. That is what keeps the web and desktop builds a single codebase.

---

## 5. The WASM boundary — the one real performance risk (OQ-4)

The latency budget lives or dies here. Two candidate designs:

| Design | Flow | Pro | Con |
|---|---|---|---|
| **A — AST across the boundary** | Rust parses → serialize AST (JSON or bincode) → TS renders | Renderer is pure TS; AST reusable for a future Swift app | Serialization cost scales with document size — the risk |
| **B — HTML inside WASM** | Rust parses **and** renders → one HTML string crosses | One string, minimal marshalling, fastest | Renderer moves to Rust; Shiki/KaTeX/Mermaid are JS, so they'd need a second pass anyway |

**Planned resolution:** design **A**, benchmarked in M0 against a 5 MB document. If serialization blows the budget, fall back to a **hybrid**: block-level HTML generated in Rust, with AST exposed only for the nodes the renderer must post-process (code blocks, math, Mermaid).

### Measured 2026-08-18 — serialization does blow the budget

Reference Mac, `--release` (`opt-level = 3`, LTO), 9 runs after warmup. Harness:
`crates/onemark-engine/examples/transport_bench.rs`.

| Document | parse only | A: parse + JSON | B: parse + HTML in Rust | JSON payload |
|---:|---:|---:|---:|---:|
| 100 KB | 4.6 ms | 5.4 ms | 2.4 ms | 16.2× source |
| 1 MB | 33.6 ms | 65.1 ms | 62.4 ms | 16.6× source |
| **5 MB** | **186.0 ms** | **389.5 ms** | **165.1 ms** | **16.9× source (84.7 MB)** |

Design A costs roughly double the M1 budget at 5 MB — before the wasm-bindgen copy,
before `JSON.parse` on an 84 MB string, before rendering, and on native, where WASM is
the slower environment. Restricting `position` to block-level nodes halves the payload
(45.2 MB) but does not improve the time; the cost is JSON encoding itself.

**The hybrid fallback is therefore live, not hypothetical** — but note what the same table
says about parsing: **186 ms of the 200 ms budget is consumed before transport is even
considered**. No transport design recovers that, so the hybrid alone does not save M1.
That was raised as **OQ-6** and **resolved the same day**: see
[ADR-0012](adr/0012-latency-budget-scoped-to-real-documents.md). The budget moved to the
real workload rather than the transport moving to design B — which is why **design A, and
therefore ADR-0005, survives unchanged**. The hybrid described above remains specified but
unadopted; it is the first move if the render layer eats M1a's headroom.

### Measured across the boundary — the WASM half

The table above is native. Through wasm-bindgen into Node (`bench/transport.mjs`):

| Document | A: JSON across boundary | A: + `JSON.parse` | B: HTML across boundary |
|---:|---:|---:|---:|
| 100 KB | 22.6 ms | **30.0 ms** | 6.7 ms |
| 1 MB | 227.8 ms | **335.0 ms** | 80.0 ms |
| 5 MB | 1159.5 ms | **1640.7 ms** | 352.7 ms |

WASM design A runs roughly **4× slower than native**, and `JSON.parse` alone accounts for
about 30% of it. At the real workload — 100 KB — the whole engine path costs 30 ms, which
is what makes ADR-0012's M1a budget reachable.

At the file size PRD §4 actually describes — under 100 KB — design A costs 5.4 ms and
every consideration above is moot.

**Non-negotiable regardless of outcome:** parsing never runs on the UI thread. Web Worker on web; native thread under Tauri (NFR-3).

---

## 6. Render pipeline

```
AST
 ├─▶ structural nodes ──────────▶ semantic HTML  (NFR-4: no div soup)
 ├─▶ code blocks ───▶ Shiki ────▶ highlighted HTML     (bundled grammars)
 ├─▶ math nodes ────▶ KaTeX ────▶ typeset HTML          (bundled fonts)
 ├─▶ ```mermaid ────▶ mermaid ──▶ SVG   (securityLevel: 'strict')
 └─▶ raw HTML ──────▶ sanitizer ▶ allowlisted HTML      (NFR-2)
                          │
                          ▼
             GitHub Markdown CSS (light + dark)
```

**Bundling is a hard requirement (M2).** Shiki grammars, KaTeX fonts and Mermaid must ship inside the application. Any CDN reference is a metric failure, not a preference.

### Sanitization rules (NFR-2)

- Allowlist of elements and attributes; everything else stripped
- `javascript:`, `data:` (except images), `vbscript:` URLs blocked
- No `<script>`, no inline event handlers, no `<iframe>`
- Mermaid renders with `securityLevel: 'strict'`
- Remote images allowed (they are the sole permitted network use — PRD §5.3) but never given first-party credentials

**Implemented 2026-08-18 — [ADR-0013](adr/0013-wrap-a-proven-html-sanitiser.md).** DOMPurify is
wrapped behind OneMark's own `Sanitizer` interface rather than a hand-written sanitiser, for the
mutation-XSS and namespace-confusion reasons the ADR records. Two refinements to the rules above
fell out of implementing them:

1. **`data:image/svg+xml` is refused**, even though it is an image type — an SVG is a document
   and can carry `<script>`. Only raster `data:` images are permitted.
2. **The URL rule is context-dependent and therefore cannot live in the sanitiser.** DOMPurify's
   URI policy is a single global regex with no notion of the element it guards, so
   `packages/renderer/src/url-policy.ts` applies the link-vs-image distinction in the renderer,
   where that context still exists. The sanitiser catches everything arriving via raw HTML.

`renderToSafeHtml` is the shipping path. `renderToUnsafeHtml` exists **only** for the
conformance suites, which must compare against CommonMark and GFM reference output before
sanitisation — those specs describe a parser, not a viewer, and require raw `<script>` and
exotic URL schemes to survive. It must never reach a DOM.

**Verification and its limit:** the 49-vector corpus in `fidelity/xss/` is fully blocked, and
38 of those 49 are confirmed live through the unsanitised path, so the gate fails if the control
is removed. But it runs under **jsdom, which is not a browser** — mutation XSS lives in the gap
between parsers. The real-browser pass is owed at task 1.22.

---

## 7. Fidelity harness

```
fidelity/
├── spec/       CommonMark spec.json + GFM extension suite   → M3, M4
├── corpus/     100 real .md documents                       → OQ-1
├── golden/     GitHub POST /markdown output, committed      → M5
└── normalize.ts  strip anchors, dir attrs, camo proxying    → OQ-2
```

Golden files are **regenerated deliberately**, never automatically — an auto-refresh would silently absorb a regression as the new truth.

**`cmark-gfm` is vendored as a third oracle only.** When `comrak` and GitHub disagree, `cmark-gfm` says which side is at fault. It is never built into a shipped artifact.

---

## 8. CI

| Job | Gate |
|---|---|
| lint + typecheck + `cargo clippy` | blocking |
| unit tests (TS + Rust) | blocking |
| CommonMark spec suite | **≥ 99%** — blocking |
| GFM extension suite | **100%** — blocking |
| Golden corpus diff | **≥ 98%** — blocking |
| Benchmark: 100 KB → first paint | **< 100 ms** (M1a) — blocking |
| Benchmark: 1 MB → first paint | **< 500 ms** (M1b) — blocking |
| 5 MB does not block the UI thread | **M1c** — blocking |
| Bundle size budget | **< 2 MB** gzipped — blocking |
| Network assertion (no first-party requests during render) | blocking |
| Cross-target determinism (same output on every platform) | blocking from M3 |

CI reaches the network to call GitHub's `/markdown` API. This does not conflict with M2, which governs the **shipped application at runtime**.

---

## 9. Two package managers

| Manager | Owns | Lockfile |
|---|---|---|
| `pnpm` | everything under `packages/`, `apps/` | `pnpm-lock.yaml` |
| `cargo` | everything under `crates/`, the Tauri shell | `Cargo.lock` |

Two dependency graphs, two caches, two CI cache strategies. Normal for Tauri — expect it rather than being surprised by it.

`pnpm` specifically (not npm) because its strict symlinked `node_modules` prevents phantom dependencies, which is the failure mode monorepos hit. See ADR-0009.
