# ADR-0013 — Wrap a proven HTML sanitiser; do not write one

**Status:** Accepted · **Date:** 2026-08-18 · **Implements:** [NFR-2](../02-PRD.md), [tech spec §6](../03-Technical-Spec.md)

## Context

Task 1.3 required "an allowlist of elements and attributes; everything else stripped", with
`javascript:`, `vbscript:` and non-image `data:` URLs blocked. OneMark renders raw HTML from
untrusted documents — a `.md` file from a cloned repository is not trusted input.

Two properties make hand-written sanitisers fail in ways that unit tests do not reveal:

1. **Mutation XSS.** A sanitiser parses the input, removes what it dislikes, and serialises.
   The browser then *re-parses* that output — and can reconstruct markup the sanitiser never
   saw. `<noscript><p title="</noscript><img src=x onerror=alert(1)>">` is the classic shape.
   The defect is in the round trip, not in the allowlist.
2. **Namespace confusion.** Inside SVG and MathML foreign content, HTML parsing rules change.
   Tag-name allowlists that are correct in HTML are bypassable there.

Both are the kind of bug that passes review, passes a test suite written by the same person,
and fails against an adversary.

## Decision

**Wrap DOMPurify behind OneMark's own sanitiser interface.** Do not implement sanitisation.

This is [ADR-0002](0002-wrap-existing-parser-behind-interface.md)'s reasoning applied where
being wrong costs a vulnerability rather than a wrong pixel. `packages/renderer/src/sanitize.ts`
stays a thin, auditable configuration: an allowlist, a redundant denylist, and nothing clever.

**A second, independent layer handles one rule DOMPurify cannot express.** Tech spec §6 makes
`data:` legal for an image `src` and illegal for a link `href`. DOMPurify's URI policy is a
single global regex with no notion of the element it is attached to, so the context-aware half
lives in `url-policy.ts`, applied by the renderer while it still knows whether it is emitting a
link or an image.

**`data:image/svg+xml` is refused despite being an image type.** An SVG is a document: it
carries `<script>` and event handlers. Permitting it would be a script-delivery channel wearing
an image's clothes.

## Alternatives rejected

| Option | Why rejected |
|---|---|
| Write our own allowlist sanitiser | The two failure modes above are exactly what a from-scratch implementation gets wrong, and neither is visible in self-written tests. The learning goal (G3) is served by parsing and FFI, not by re-deriving a security control that a specialist team maintains. |
| Strip all raw HTML | Safe and wrong. GitHub renders a subset of raw HTML, READMEs rely on `<details>`, and ADR-0001's differentiator is GitHub-*identical* output. This would trade the product's reason to exist for a rule that is easier to enforce. |
| Sanitise in Rust, inside the engine | Puts a render concern behind the parser boundary, contradicting ADR-0005. It would also have to be hand-written — no comparable audited Rust sanitiser with a browser-equivalent parser exists — which is the option above with extra steps. |
| Rely on the GFM tagfilter already implemented in task 1.2 | The tagfilter blocks nine tag names by escaping `<`. It does not touch attributes, event handlers, or URL schemes. Mistaking it for a security control is a live risk precisely because it looks like one; it is labelled as not-a-control in its own source. |
| Content Security Policy alone | Real defence in depth and worth adding later, but it protects the *shell*, not the document: it cannot stop a `javascript:` link the user clicks, and it is not available identically across all six targets. |

## Consequences

**Good:**
- 49/49 corpus vectors blocked; the same corpus leaves **38/49 live** through the unsanitised
  path, so the gate demonstrably fails when the control is removed.
- The security surface is one small configuration file plus one scheme allowlist, both readable
  in a sitting.
- DOMPurify is ~20 KB gzipped against M6's 2 MB budget, and has zero dependencies.

**Bad / accepted cost:**
- A runtime dependency on the critical path, which must be kept updated — a stale sanitiser is
  a worse position than no sanitiser, because it is trusted.
- **The test environment is not the shipping environment.** jsdom is not a browser, and mutation
  XSS lives precisely in the gap between one parser and another. Passing here is necessary and
  **not sufficient**; a real-browser pass belongs with the E2E work at task 1.22.
- Two layers mean two places to look when a URL is unexpectedly stripped.

**Reversibility:** Cheap in one direction, expensive in the other. Swapping DOMPurify for
another library is an afternoon behind the `Sanitizer` interface. Replacing it with our own
implementation should not happen without an adversarial review by someone who did not write it.
