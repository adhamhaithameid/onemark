# Spec suites

Language-neutral test data. Consumed by the Rust engine tests (parser layer) and by
`packages/renderer` (render layer, which is what metrics M3 and M4 actually gate).

| File | Source | Gates |
|---|---|---|
| `commonmark-0.31.2.json` | <https://spec.commonmark.org/0.31.2/spec.json> | **M3** — CommonMark conformance ≥ 99% |
| `gfm-0.29.json` | cmark-gfm `test/spec.txt`, via `scripts/vendor-gfm-spec.mjs` | **M4** — GFM extension conformance = 100% |

Regenerate deliberately, never automatically: an auto-refresh would silently absorb a
regression as the new truth.

## A note on the GFM suite

Each case carries an `extension` field taken from its fence label — `table`,
`strikethrough`, `autolink`, `tagfilter`, `disabled`, or `""` for a plain CommonMark case.

**M4 gates the 22 cases upstream actually runs.** Two further cases, in
*Task list items (extension)*, are labelled `disabled` — cmark-gfm skips them in its own
test runner because its output disagrees with the spec prose on attribute order and the
self-closing slash:

| Source | Output for `- [x] bar` |
|---|---|
| spec prose | `<input checked="" disabled="" type="checkbox">` |
| cmark-gfm (GitHub's engine) | `<input type="checkbox" checked="" disabled="" />` |

OneMark follows **cmark-gfm**, not the prose. The prose is stale, and cmark-gfm is the
engine GitHub actually runs — which is the target ADR-0001 names. The two disabled cases
are reported by the runner but excluded from the gate, and they are tracked separately so
the exclusion stays visible rather than silently swallowed. M5 (golden corpus vs GitHub's
own API) is what finally arbitrates this.
