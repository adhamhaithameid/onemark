# ADR-0017: Design tokens — one JSON source, generated CSS + TS

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-09-20 |
| Deciders | Author (delegated to the campaign), per instruction "decide the system design … as design tokens to be applied later on everything" with brand primary `#c8412d` |
| Supersedes | — |

## Context

OneMark ships three render surfaces that must share one visual language: the web app
(`apps/web`, vanilla DOM + CodeMirror 6), the marketing site (Next.js, phase P8), and the
future desktop shells (Tauri, M2+). Today there are **no design tokens**: the app shell
hardcodes six hex values in `styles.css`, the marketing site does not exist yet, and the
GitHub markdown CSS (`github-markdown-css`, vendored light+dark per ADR-0015) is
**do-not-edit by policy** — fidelity CSS is verified against pinned reference values, so
hand-editing it would break the verification model.

Theme switching is already solved at the app level: `data-theme="light"|"dark"` on
`<html>` (`apps/web/src/theme.ts`). Any token system must key off that exact attribute.

The author fixed the brand: primary `#c8412d` (warm vermilion), with white, black, and
supporting colors. Everything else — ramps, neutrals, semantics, spacing, type, motion —
was delegated.

## Decision

1. **One source of truth**: `packages/design-tokens/tokens.json`. Every color, spacing,
   radius, shadow, duration, easing, type size, font stack, weight and z-index lives there
   and nowhere else.
2. **Generated outputs, never hand-written**: `pnpm --filter @onemark/design-tokens build`
   emits `css/tokens.css` (`:root` + `[data-theme="dark"]` custom properties, semantic
   aliases like `--om-bg`/`--om-text` included) and `src/tokens.ts` (typed TS for code).
   Outputs are committed, edits to them are regenerated away.
3. **Brand**: primary ramp 50→950 anchored on `#c8412d` at 500. Dark mode shifts the
   interactive primary to the 400 step (`#e57c5f`) for contrast on dark surfaces; the ramp
   is designed, not inverted.
4. **Neutrals follow GitHub's gray scale** (gray-0…gray-1000) so app chrome and the
   vendored markdown CSS sit in the same tonal family; the brand red is for identity,
   focus, and primary actions — never for painted walls.
5. **Adoption is one CSS import** per surface, keyed on the existing `data-theme`
   attribute. The vendored sheets are wrapped, never modified (ADR-0015 preserved).
6. **Verification**: contrast is tested, not eyeballed — the test suite computes WCAG
   relative-luminance ratios for text-role pairings and fails below AA.

## Rejected alternatives

- **Tailwind-first (config as the source)**: the app is framework-free vanilla CSS;
  Tailwind would add a build step to `apps/web` and make the marketing site the only
  first-class consumer. Tokens-as-CSS-custom-properties work everywhere with zero build.
- **Edit the vendored GitHub CSS to add tokens**: breaks ADR-0015's
  assertions-on-pinned-values model and makes upstream re-vendorship a merge conflict.
- **Hand-maintained CSS variables without a source file**: three surfaces would drift;
  there would be no single place to answer "what is `--om-primary` in dark?"
- **Component library as the unit of design** (ship styled React components): premature —
  the app is not React; the marketing site will use tokens + its own component layer.

## Consequences

- `apps/web/src/styles.css` migrates onto `--om-*` aliases in a later task (P10 shell
  polish), keeping behavior identical.
- The marketing site (P8) imports the same generated sheet; brand changes are one JSON
  diff + `pnpm build`.
- New tokens require: a use case, a name following `--om-{category}-{name}`, light AND
  dark values, and contrast checks when used as text.
- Prototypes in `design/prototypes/` are the author-validation surface for the look; they
  embed a snapshot comment linking back to the generated source.
