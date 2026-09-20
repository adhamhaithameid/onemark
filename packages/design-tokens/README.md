# @onemark/design-tokens

OneMark's design system source of truth (ADR-0017). Every color, spacing step,
radius, shadow, duration, easing, type size, font stack and z-index used by any
OneMark surface — the web app, the marketing site, desktop shells — is defined
in **`tokens.json`** and nowhere else.

## Regenerate

```bash
pnpm --filter @onemark/design-tokens build
```

Reads `tokens.json`, writes:

- `css/tokens.css` — `:root` (light) + `[data-theme="dark"]` custom properties,
  plus semantic aliases (`--om-bg`, `--om-text`, `--om-surface`, …) that switch
  with the theme.
- `src/tokens.ts` — typed TS exports of the same values.

Both outputs are committed; treat them as build artifacts (regenerate, never
hand-edit).

## Adopt in a surface

1. Import the generated sheet once: `import '@onemark/design-tokens/css/tokens.css'`
   (or serve it and `<link>` it before other styles).
2. Toggle themes with the existing attribute: `data-theme="light|dark"` on
   `<html>` — the same attribute `apps/web/src/theme.ts` already stamps.
3. Consume tokens: `var(--om-primary)`, `var(--om-space-4)`,
   `var(--om-font-size-lg)`, `var(--om-shadow-md)`, …

The vendored GitHub markdown CSS (`packages/renderer/css/`) is **not** tokenised
and must not be edited (ADR-0015). Tokens wrap around it; they never rewrite it.

## Naming rules

`--om-{category}-{name}`:

| Category | Examples |
|---|---|
| `color-*` | `--om-color-primary-500`, `--om-color-gray-200` |
| semantic (no category) | `--om-bg`, `--om-surface`, `--om-border`, `--om-text`, `--om-primary`, `--om-on-primary`, `--om-focus-ring` |
| role colors | `--om-success-bg`, `--om-danger-text`, `--om-warning-border`, … |
| `space-*` | `--om-space-4` (= 16px; 4px base) |
| `radius-*` | `--om-radius-sm`, `--om-radius-lg`, `--om-radius-full` |
| `shadow-*` | `--om-shadow-sm/md/lg` (theme-aware) |
| `duration-*`, `ease-*` | `--om-duration-fast`, `--om-ease-spring` |
| `font-*` | `--om-font-ui`, `--om-font-size-lg`, `--om-weight-semibold` |
| `z-*` | `--om-z-modal`, `--om-z-tooltip` |

Adding a token: give it a use case, light **and** dark values, and — if it can
carry text — pass the WCAG AA contrast assertions in `test/tokens.test.mjs`.

## Brand

Primary `#c8412d` (500). Dark mode shifts the interactive primary to the 400
step (`#e57c5f`) for contrast on dark surfaces. Neutrals follow GitHub's gray
scale so app chrome and the vendored markdown CSS share one tonal family. The
red marks identity, focus and primary actions — never large surfaces.

## Prototypes

`design/prototypes/` (repo root) holds the static validation gallery:
app shell, marketing hero, components, typography/spacing/motion. Each embeds a
snapshot of the generated tokens so the files are self-contained; the snapshot
header names the generated source. **These await author validation** — comments
amendments land in `tokens.json`, then a rebuild regenerates everything.
