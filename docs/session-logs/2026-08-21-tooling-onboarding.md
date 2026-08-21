# Session log — Tooling onboarding (graphify + beads)

| Field | Value |
|---|---|
| Date | 2026-08-21 |
| Phase | M1.1–1.3 complete (unchanged) — tooling + project-understanding session |
| Previous | [2026-08-18 M0 foundation](2026-08-18-m0-foundation.md) |
| Code changed | none (tooling + docs only) |

## Result

Project tooling installed and a persistent knowledge graph built. No product code touched.

### What was done

1. **Full project read.** All docs (PRD, tech spec, build plan, brief, roadmap), ADRs, HANDOFF,
   CHANGELOG, CI, plus the Aug 18–21 Claude session log from `~/.claude/projects/`
   (`e25aa1e8…jsonl`, 1017 lines) — which is **not** reflected in any repo doc.
2. **graphify** installed (`uv tool install graphifyy`, v0.9.48) and full pipeline run on the
   repo → `graphify-out/` (graph.json 434 nodes / 640 edges, graph.html, GRAPH_REPORT.md).
   Semantic extraction was done inline by the host agent: the subagent provider returned
   502/504 on every dispatch, so the skill's no-subagent fallback was used.
   Health check: 53 dangling-endpoint edges (AST references to external symbols such as
   `dompurify`, `jsdom` — expected noise), 81 collapsed parallel edges (normal undirected
   dedup). No missing endpoints, no self-loops.
3. **beads** (`bd` 1.2.2, Homebrew) initialised via `bd init`. Note: `bd init` itself made
   the repo's **first-ever commit** `4e73031` ("bd init: initialize beads issue tracking")
   containing `.beads/` and AGENTS.md updates. Issue prefix is `OneMark-*`.
4. **Four beads filed** for discovered open work:
   - `OneMark-jy0` P0 bug — WASM stack-exhaustion DoS
   - `OneMark-8ij` P1 task — M1.4 GitHub Markdown CSS light+dark
   - `OneMark-b5r` P2 task — OQ-1/OQ-2 golden corpus rules
   - `OneMark-orl` P2 task — XSS corpus count reconciliation

## The finding that matters: unlogged Aug 18–21 session

The last Claude session ran 2026-08-18 → 2026-08-21 and produced real results that exist
only in the session JSONL, not in HANDOFF/CHANGELOG/session-logs:

- DOMPurify allowlist was **dead config** — `USE_PROFILES: { html: true }` overrides
  `ALLOWED_TAGS`/`ALLOWED_ATTR`. Fixed along with two more defects; browser-matrix verified
  via Playwright (sanitised path: 0 script executions across Blink/WebKit/Gecko).
- XSS corpus grew **49 → 93 vectors** (`fidelity/xss/corpus.json` dated today).
- Rust tests now 17 (was 15); TS renderer tests grew accordingly.
- **Session ended mid-debug on a critical open item:** `'*'×5000 + x + '*'×5000` traps the
  WASM module with `memory access out of bounds`, and **the module stays dead for all later
  parses** — a real DoS for the shipping app. Filed as `OneMark-jy0`.

## Next actions

| Bead | What |
|---|---|
| `OneMark-jy0` (P0) | Reproduce + guard the WASM stack exhaustion |
| `OneMark-8ij` (P1) | Task 1.4 GitHub CSS (build plan's declared next step) |
| `OneMark-orl` (P2) | Reconcile 49→93 XSS corpus in records |
| `OneMark-b5r` (P2) | OQ-1/OQ-2 before golden-corpus work |

## Standing constraints (unchanged)

- No committing until explicitly instructed (this session committed only what the user's
  instruction covered: graphify-out, this log, beads state).
- Anything not required by the done-line is v2.
