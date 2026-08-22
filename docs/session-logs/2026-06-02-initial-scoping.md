# Session log — 2026-06-02 · Initial scoping

**Type:** Scoping · **Output:** problem framing + open questions · **Code written:** none

> Archived verbatim in substance. Several conclusions below were **overturned** on 2026-08-16 — see the corrections section at the end. Kept as-is because the record of having been wrong is the useful part.

---

## Framing at the time

The session deliberately produced *decisions to make* rather than a finished spec.

### 1. The "why"

Open question: what does this engine do that Obsidian, Typora, iA Writer, or CodeMirror+markdown-it don't? "Cross-platform markdown read/write" alone is not a product. One sharp answer needed, because it drives every downstream technical decision.

### 2. What the engine owns

- **Parsing** — text → AST (CommonMark + GFM baseline, or a custom dialect?)
- **Rendering** — AST → output (HTML, native views, or per-platform rendering?)
- **Read/Write** — in-memory only, or does it own file I/O? *Recommendation at the time: keep the engine pure, let each app own storage.*
- **Extensibility** — plugin system from day one, or hardcode and generalize later? *Recommendation: generalize later.*

### 3. The core language decision

- **Path A** — Rust core → WASM (web) + native bindings. Genuinely one engine everywhere; steep solo build across 5+ targets.
- **Path B** — TypeScript core + platform wrappers (React web, React Native, Tauri/Electron). Ships faster; "one logic, several runtimes" rather than one binary.

*Recommendation at the time: Path B, on the assumption the author's stack was React/Svelte/TS.*

### 4. MVP scope

One client only (web), read + write markdown, live preview, no accounts/sync/upload. Prove the parse→AST→render loop feels good. Everything else explicitly out of scope.

### Carried to the next session

- One-sentence differentiator
- Does the engine own storage, or just parse/render?
- Roll a parser, or extend an existing one?
- Plugin system now or later?
- Rough feature list for the web MVP only

---

## Corrections applied 2026-08-16

| Claim here | What was actually true |
|---|---|
| "Your stack is React/Svelte/TS" → therefore Path B | **Wrong premise.** The author is a shipping native macOS developer (KeepAwake, KeepClean, KeepMirror, FitWindow) *as well as* a web developer. Path B's justification did not hold. |
| Path A vs Path B is the language decision | **Incomplete.** The real fork was the *runtime* (ADR-0004), and it resolved to Tauri v2 — neither path as described. |
| Consider rolling your own parser | Resolved: wrap an existing one behind an owned interface (ADR-0002), with `comrak` as the single engine (ADR-0003). |
| Engine should be pure; apps own storage | **Upheld** — and formalized as a separate `StorageProvider` interface (ADR-0007). |
| Generalize plugins later | **Upheld** — no plugin API before v3 (PRD §3.1). |
| Web MVP only, everything else out of scope | **Upheld** (ADR-0011). |

**The one thing this session got most right:** insisting the differentiator be answered before any architecture. That question is what produced ADR-0001.
