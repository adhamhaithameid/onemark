# ADR-0014 — Sanitizer hardening: profile-free allowlist, URL policy on raw HTML, forced safe path

**Status:** Accepted · **Date:** 2026-08-21
**Supersedes:** [ADR-0013](0013-wrap-a-proven-html-sanitiser.md) (whose core decision — wrap DOMPurify, never hand-roll — is unchanged and stands)

## Context

An adversarial security audit of the M1.3 sanitizer found three real defects in the *implementation* of ADR-0013's decision. The choice of library was correct; how it was wired was not.

1. **The curated allowlist was dead configuration.** `sanitize.ts` passed both `ALLOWED_TAGS`/`ALLOWED_ATTR` **and** `USE_PROFILES: { html: true }`. DOMPurify applies `USE_PROFILES` after and *overwrites* the explicit allowlists, so the broader default HTML profile governed — permitting `<audio src>`, `<video src>`, `<track src>`, `<marquee>`, `tabindex`, `download`, `loading`. The media elements fetch arbitrary remote URLs, violating PRD §5.3 (remote *images* are the sole permitted network use). No test caught it because the XSS corpus only proves scripted vectors are blocked, and they were — this was a policy failure, not a scripting one.
2. **`data:image/svg+xml` bypass via raw HTML.** The URL policy ran only on AST link/image nodes. Raw HTML reached DOMPurify without it, and DOMPurify permits `data:` on `img` by default — so `![x](data:image/svg+xml,…)` was refused while the equivalent `<img>` tag was allowed.
3. **The safe path could be disarmed by its caller.** `SafeRenderOptions extended Partial<RenderOptions>`, so `{ urlPolicy: false }` compiled and flowed through to the unsafe renderer.

Separately (engine, not sanitizer): AST conversion recursed over document depth with an attacker-controlled depth. Native's 8 MB stack absorbed it; wasm32's 1 MB stack trapped with `memory access out of bounds`, leaving the module instance permanently dead for all later parses.

## Decision

Four changes, all regression-tested at the public seams:

1. **Profile-free allowlist.** `USE_PROFILES` is removed and must never be set; the curated `ALLOWED_TAGS`/`ALLOWED_ATTR` lists are the single source of truth. Guarded by `allowlist.test.ts`, verified to fail (6 tests) if the defect is reintroduced.
2. **URL policy as a DOMPurify hook.** An `afterSanitizeAttributes` hook applies the same URL policy to every attribute URL regardless of whether the node came from AST or raw HTML. Both paths now agree.
3. **Forced safe path.** `SafeRenderOptions` now `Omit`s `urlPolicy` instead of extending it, and `renderToSafeHtml` forces `urlPolicy: true` — even a cast cannot disarm it.
4. **Depth cap in the engine.** `convert()` is iterative with an explicit heap stack (`crates/onemark-engine/src/lib.rs`). A deliberate product limit `MAX_DEPTH = 400` emits a visible `truncated` marker node rather than dropping content silently. Regression-tested in `packages/engine/test/robustness.test.ts` and `crates/onemark-engine/tests/parse.rs`.

## Alternatives rejected

| Option | Why rejected |
|---|---|
| Hand-roll the sanitizer now that DOMPurify config proved subtle | ADR-0013's reasoning is stronger, not weaker: hand-rolled sanitizers fail on mutation XSS. The defects were configuration errors, caught and fixed in a wrapped proven library. |
| Fix `USE_PROFILES` interaction by ordering keys carefully | Fragile against DOMPurify internals; the explicit allowlist alone is deterministic and auditable. |
| Catch the WASM trap and reinitialize the module | Treats the symptom; a trap is not catchable across the boundary in all embedders, and re-initialization costs more than bounding recursion. |
| Raise the wasm32 stack size | Moves the cliff rather than removing it; depth remains attacker-controlled. |

## Consequences

**Good:** the shipping render path now enforces exactly the curated policy on every URL from either source; the safe API cannot be misconfigured by its caller; pathological documents degrade visibly (truncation marker) instead of killing the renderer session-wide.

**Bad / accepted cost:** documents deeper than `MAX_DEPTH = 400` lose their deeper structure behind an explicit marker — accepted, since no realistic markdown approaches it. The corpus gate still only proves *scripted* vectors blocked; policy-level failures (defect 1) need allowlist assertions, which is why the guard test exists.

**Reversibility:** each change is independently revertible; the guard tests make silent regressions fail loudly.
