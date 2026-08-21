# OneMark reference document

Renders every construct the present layer styles, so a theme regression cannot hide
in an untested corner. Keep in sync with what tasks 1.4–1.8 cover.

## Headings and text

### A third-level heading with `inline code`

Body text with **bold**, *italic*, ~~strikethrough~~, a [link](https://example.com/docs),
and an autolink: https://example.com — plus :tada: emoji once task 1.8 lands.

> A blockquote quoting the done-line.
>
> > Nested, because nesting is where themes drift.

## Lists

- [x] shipped: renderer, sanitiser
- [ ] pending: Shiki, KaTeX, Mermaid
- [ ] maybe never: sync (non-goal)

1. First
2. Second
   - nested unordered
3. Third

## Table

| Layer | Owner | Gate |
|---|---|---|
| Parse | comrak | M3 ≥ 99% |
| Render | OneMark TS | M4 100% |
| Present | CSS + Shiki + KaTeX | this file |

## Code

```rust
pub const MAX_DEPTH: usize = 400;
fn truncates_visibly() -> bool { true }
```

```js
const offline = true; // M2: zero first-party round-trips
```

## Alerts

> [!NOTE]
> Alerts are parser-layer — comrak emits typed nodes.

> [!WARNING]
> The present layer is ~80% of "looks like GitHub".

> [!IMPORTANT]
> Fidelity is verified, not claimed.

---

Footnotes[^1] close the document.

[^1]: A footnote, rendered GitHub-style at the end.
