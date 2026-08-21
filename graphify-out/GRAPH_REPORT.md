# Graph Report - OneMark  (2026-08-21)

## Corpus Check
- 100 files · ~67,790 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 434 nodes · 640 edges · 36 communities (25 shown, 11 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Engine TS AST Types
- Renderer HTML Escaping
- onemark-engine Rust Core
- Render Entry Points
- Renderer Deps DOMPurify
- Spec Harness and Examples
- Engine TSConfig
- Renderer TSConfig
- Root Package Config
- Engine Package Config
- PRD and Roadmap Concepts
- Transport Bench Example
- GFM Rust Tests
- WASM Boundary Crate
- Bench Package Config
- Bench Transport Script
- GFM Spec Vendor Script
- Agent Tooling Docs
- CI Contract Gate
- CI Web and Monorepo
- Session State Records
- Engine Interface ADRs
- Sanitiser ADR Cluster
- Storage Web-First ADRs
- ADR Process Records
- Beads Checkout Hook
- Beads Merge Hook
- Beads Pre-commit Hook
- Beads Pre-push Hook
- Beads Commit-msg Hook
- GFM Scope ADR
- License ADR
- Rust Crate Manifests
- WASM Build Script
- Network Rule
- Windows Linux Milestone

## God Nodes (most connected - your core abstractions)
1. `renderToUnsafeHtml()` - 15 edges
2. `MarkdownNode` - 14 edges
3. `render()` - 14 edges
4. `MarkdownNode` - 13 edges
5. `compilerOptions` - 12 edges
6. `compilerOptions` - 12 edges
7. `loadNodeEngine()` - 11 edges
8. `ParseOptions` - 10 edges
9. `renderToSafeHtml()` - 10 edges
10. `GFM_OPTIONS` - 9 edges

## Surprising Connections (you probably didn't know these)
- `OneMark Project Positioning` --references--> `ADR-0001 GitHub-Identical Fidelity Offline`  [INFERRED]
  README.md → docs/adr/0001-differentiator-github-fidelity-offline.md
- `Changelog M0–M1.3 Record` --references--> `Session Log 2026-08-18 M0 Foundation`  [INFERRED]
  CHANGELOG.md → docs/session-logs/2026-08-18-m0-foundation.md
- `CI Web Job (WASM build/typecheck/tests)` --shares_data_with--> `pnpm + Cargo Monorepo Layout`  [INFERRED]
  .github/workflows/ci.yml → pnpm-workspace.yaml
- `Fidelity Spec Suites (CommonMark 0.31.2 / GFM 0.29)` --shares_data_with--> `CI Contract Job (fixture drift gate)`  [INFERRED]
  fidelity/spec/README.md → .github/workflows/ci.yml
- `CLAUDE.md Agent Behaviour Directives` --conceptually_related_to--> `AGENTS.md Beads Workflow`  [INFERRED]
  CLAUDE.md → AGENTS.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Three Verification Oracles** — docs_adr_0003_comrak_single_engine, docs_02_prd_verification_strategy, docs_02_prd_acceptance_metrics [EXTRACTED 0.75]
- **Two Interfaces Carrying the Architecture** — docs_03_technical_spec_markdownengine_interface, docs_03_technical_spec_storageprovider_interface, docs_adr_0002_wrap_parser_interface [EXTRACTED 0.75]
- **Agent Tooling Stack (bd + skills)** — agents_md_beads_workflow, claude_md_agent_directives, _beads_dolt_issue_database [EXTRACTED 0.75]

## Communities (36 total, 11 thin omitted)

### Community 0 - "Engine TS AST Types"
Cohesion: 0.08
Nodes (29): ADR-0003, ADR-0005, AlertType, AttrValue, find(), MarkdownNode, NodeType, Point (+21 more)

### Community 1 - "Renderer HTML Escaping"
Cohesion: 0.09
Nodes (36): escapeHref(), escapeHtml(), HREF_SAFE, applyTagfilter(), Ctx, DEFAULTS, Emitter, isTight() (+28 more)

### Community 2 - "onemark-engine Rust Core"
Cohesion: 0.09
Nodes (35): AstNode, AttrValue, BTreeMap, alert_name(), alignment_name(), AttrValue, build(), convert() (+27 more)

### Community 3 - "Render Entry Points"
Cohesion: 0.07
Nodes (29): GFM_OPTIONS, loadNodeEngine(), numberFootnotes(), renderToUnsafeHtml(), renderToSafeHtml(), defaultWindow(), safe(), Case (+21 more)

### Community 4 - "Renderer Deps DOMPurify"
Cohesion: 0.07
Nodes (28): dompurify, jsdom, dependencies, dompurify, @onemark/engine, devDependencies, jsdom, playwright (+20 more)

### Community 5 - "Spec Harness and Examples"
Cohesion: 0.10
Nodes (15): ast_depth(), main(), MarkdownNode, Case, commonmark_conformance_meets_m3(), render_commonmark(), String, spec_path() (+7 more)

### Community 6 - "Engine TSConfig"
Cohesion: 0.10
Nodes (19): compilerOptions, exactOptionalPropertyTypes, lib, module, moduleResolution, noEmit, noUncheckedIndexedAccess, resolveJsonModule (+11 more)

### Community 7 - "Renderer TSConfig"
Cohesion: 0.10
Nodes (19): compilerOptions, exactOptionalPropertyTypes, lib, module, moduleResolution, noEmit, noUncheckedIndexedAccess, resolveJsonModule (+11 more)

### Community 8 - "Root Package Config"
Cohesion: 0.11
Nodes (18): devDependencies, typescript, vitest, engines, node, typescript, vitest, license (+10 more)

### Community 9 - "Engine Package Config"
Cohesion: 0.11
Nodes (18): devDependencies, @types/node, typescript, vitest, @types/node, typescript, vitest, license (+10 more)

### Community 10 - "PRD and Roadmap Concepts"
Cohesion: 0.11
Nodes (18): GFM Offline Rendering Gap, Acceptance Metrics M1a–M6, v1 Done-Line, Fidelity Layers (Parse/Render/Present), Five-Level Verification Strategy, WASM Transport Boundary (OQ-4), M0 Foundation Milestone, M1 Web Milestone (+10 more)

### Community 11 - "Transport Bench Example"
Cohesion: 0.26
Nodes (11): count(), main(), median(), MarkdownNode, String, Vec, strip_inline_positions(), synthetic_document() (+3 more)

### Community 12 - "GFM Rust Tests"
Cohesion: 0.31
Nodes (7): fenced_code_blocks_keep_their_info_string_and_body(), first_of(), links_and_images_expose_url_and_title(), ordered_lists_report_start_and_tightness(), MarkdownNode, tables_carry_column_alignments(), task_items_report_their_checked_state()

### Community 13 - "WASM Boundary Crate"
Cohesion: 0.40
Nodes (9): decode_options(), engine_id(), engine_version(), parse_to_json(), render_to_html(), String, JsError, ParseOptions (+1 more)

### Community 14 - "Bench Package Config"
Cohesion: 0.22
Nodes (8): license, name, private, scripts, bench, typecheck, type, version

### Community 15 - "Bench Transport Script"
Cohesion: 0.25
Nodes (7): median(), OPTIONS, require, rows, RUNS, time(), wasm

### Community 16 - "GFM Spec Vendor Script"
Cohesion: 0.29
Nodes (6): byExtension, cases, extensions, here, lines, outDir

### Community 17 - "Agent Tooling Docs"
Cohesion: 0.67
Nodes (3): Beads Dolt Issue Database (.beads), AGENTS.md Beads Workflow, CLAUDE.md Agent Behaviour Directives

### Community 18 - "CI Contract Gate"
Cohesion: 0.67
Nodes (3): CI Contract Job (fixture drift gate), CI Rust Job (fmt/clippy/tests/CommonMark gate), Fidelity Spec Suites (CommonMark 0.31.2 / GFM 0.29)

### Community 19 - "CI Web and Monorepo"
Cohesion: 0.67
Nodes (3): CI Web Job (WASM build/typecheck/tests), ADR-0009 pnpm + Cargo Monorepo, pnpm + Cargo Monorepo Layout

### Community 20 - "Session State Records"
Cohesion: 0.67
Nodes (3): Changelog M0–M1.3 Record, Session Log 2026-08-18 M0 Foundation, HANDOFF Session State Record

### Community 21 - "Engine Interface ADRs"
Cohesion: 0.67
Nodes (3): MarkdownEngine Interface, ADR-0002 Wrap Existing Parser Behind Interface, ADR-0005 AST Is the Contract + Bundled HTML Renderer

### Community 22 - "Sanitiser ADR Cluster"
Cohesion: 0.67
Nodes (3): Render Pipeline (Shiki/KaTeX/Mermaid/Sanitiser), ADR-0013 Wrap a Proven HTML Sanitiser, renderToSafeHtml Shipping Path Rule

### Community 23 - "Storage Web-First ADRs"
Cohesion: 0.67
Nodes (3): StorageProvider Interface, ADR-0007 Platform-Conditional Storage (OPFS/Folders), ADR-0011 Web Ships First

### Community 24 - "ADR Process Records"
Cohesion: 0.67
Nodes (3): ADR Template and Format Convention, Session Log 2026-06-02 Initial Scoping, Session Log 2026-08-16 Architecture Grilling

## Knowledge Gaps
- **158 isolated node(s):** `name`, `version`, `private`, `type`, `license` (+153 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@onemark/engine` connect `Spec Harness and Examples` to `Renderer Deps DOMPurify`, `Transport Bench Example`, `GFM Rust Tests`, `WASM Boundary Crate`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Why does `main()` connect `Transport Bench Example` to `onemark-engine Rust Core`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `parse_to_json()` connect `onemark-engine Rust Core` to `Transport Bench Example`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _158 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Engine TS AST Types` be split into smaller, more focused modules?**
  _Cohesion score 0.08418367346938775 - nodes in this community are weakly interconnected._
- **Should `Renderer HTML Escaping` be split into smaller, more focused modules?**
  _Cohesion score 0.09158186864014801 - nodes in this community are weakly interconnected._
- **Should `onemark-engine Rust Core` be split into smaller, more focused modules?**
  _Cohesion score 0.09302325581395349 - nodes in this community are weakly interconnected._