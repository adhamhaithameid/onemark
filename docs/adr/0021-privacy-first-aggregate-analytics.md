# ADR-0021: Privacy-first aggregate analytics

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-09-20 |
| Deciders | Author (delegated to the campaign: "a full analytics pipeline, to gather basic info (not mainly about users) and to count the simple things") |
| Amends | — |

## Context

The author wants simple counts — app opens, documents opened, render latency
buckets, feature usage, error counts, site views — explicitly *not* user
analytics. OneMark's product promise is offline-first and privacy-respecting
(NFR-1, NFR-2); any telemetry must not betray that. The web app and the
marketing site both want it.

## Decision

1. **First-party counter, not a third party.** A Cloudflare Worker + D1 under
   OneMark's own domain (`apps/analytics-worker`). Counts live in a per-day
   per-event per-property counter table; there is no table that could hold a
   visitor.
2. **The event vocabulary is the whole surface.** Six events, each with a
   property allowlist and closed bucket enums (e.g. `ms_bucket` ∈
   `<50…>1000`). An event that the vocabulary cannot describe cannot be
   stored — rejected, not stripped.
3. **Client beacon: disabled by default, opt-out trivial.** `createBeacon`
   lights up only when the app calls `setEnabled(true)`; a localStorage flag
   kills it. The only identifier is a rotating in-memory session id (≤30 min,
   never persisted, ignored for storage).
4. **No PII by construction.** Values must be short safe tokens or bucket
   enums; free text, emails, long digit runs and URLs cannot pass. The worker
   never reads IP or User-Agent and sets no cookies.
5. **Parameterized SQL only**, asserted by a test that inspects every stored
   statement for bound placeholders.
6. **The marketing site** uses the same collector for `site_view` or cookieless
   Cloudflare Web Analytics — never cookie-based analytics.

## Rejected alternatives

- **Google Analytics / Mixpanel / Amplitude** — third-party cookies and
  fingerprinting; an identity graph is the opposite of "count the simple
  things", and OneMark's privacy posture would fund it.
- **Self-hosted Umami/Plausible with cookies** — better, but still
  visitor-keyed; the vocabulary allowlist is stricter than any of them allow.
- **No analytics at all** — defensible, but render-latency buckets and error
  counts are exactly the feedback the performance ladder (ADR-0019) needs; the
  vocabulary cannot expand without a code + test change, which keeps scope
  honest.

## Consequences

- `apps/analytics-worker` ships implemented and tested (26 offline tests);
  deployment is an author task (needs a Cloudflare token) and is documented in
  its README.
- The beacon is a later one-line integration in `apps/web` behind the sync
  panel's settings (opt-in UI), staying disabled until then.
- New events require: a use case, an allowlist entry, bucket enums where
  applicable, and tests — the same discipline as the normalizer rules.
