# @onemark/analytics-worker

Privacy-first, aggregate-only analytics for OneMark (ADR-0021): a Cloudflare
Worker over D1 that counts **events, never visitors**. No cookies, no
fingerprints, no IP, no User-Agent, no free-text — the event vocabulary below
is the entire writable surface, enforced by an allowlisting validator.

## Guarantees

- **Aggregate only** — storage is per-day per-event per-property counters.
- **No identifiers** — the client beacon sends a rotating in-memory session id
  (max 30 min, never persisted); the worker ignores it for storage.
- **Disabled by default** — `createBeacon` is inert until `setEnabled(true)`,
  and `localStorage['onemark-analytics-optout'] = '1'` kills it instantly.
- **Allowlist or nothing** — unknown events/props, non-token values, oversized
  bodies: rejected (4xx), never stored.
- **Parameterized SQL only** — every D1 statement binds `?N` values; a test
  asserts no literal ever reaches the VALUES clause.

## Event vocabulary

| Event | Props | Buckets |
|---|---|---|
| `app_open` | `version`, `platform` | platform: web/macos/windows/linux/ios/android |
| `doc_open` | `size_bucket` | <10KB, 10-100KB, 100KB-1MB, >1MB |
| `render` | `size_bucket`, `ms_bucket`, `engine` | ms: <50, 50-100, 100-250, 250-500, 500-1000, >1000 |
| `feature_use` | `feature` | paste, dragdrop, save, theme, export-html, sync, mermaid-hydrated |
| `error` | `kind` | parse-trap, render-failed, storage-full, sync-failed, hydrate-failed |
| `site_view` | `page` | home, docs, app, faq, roadmap |

Buckets are produced by `sizeBucket(bytes)` / `bucketize(ms)` from
`src/validate.mjs` — shared vocabulary, defined once.

## Layout

- `src/validate.mjs` — allowlists, bucket helpers, `validatePayload`
- `src/index.mjs` — the Worker: `POST /collect` (CORS-pinned), `GET /healthz`, `GET /summary` (admin token, timing-safe compare)
- `src/client.mjs` — `createBeacon({endpoint, enabled})` for apps/web: 10-event/30-s flush, `sendBeacon` with `fetch keepalive` fallback
- `src/schema.sql` — two tables, both aggregate
- `test/` — 26 tests, fully offline (mock D1 + stubbed browser globals)

## Deploy (author task — needs a Cloudflare account/token)

```bash
npm i -g wrangler            # once
wrangler d1 create onemark-analytics   # note the database_id
wrangler d1 execute onemark-analytics --file=src/schema.sql
wrangler deploy              # wrangler.toml: bind DB, set ALLOWED_ORIGINS
wrangler secret put ADMIN_TOKEN
```

`.dev.vars.example` documents local development (`wrangler dev`). No Cloudflare
token is committed anywhere; the site works with analytics disabled until this
runs, and the marketing site's needs are met cookielessly or not at all.
