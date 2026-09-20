/**
 * OneMark analytics collector — a Cloudflare Worker over D1 (ADR-0019).
 *
 * Aggregate counts only. The worker never reads the IP, never reads the
 * User-Agent, sets no cookies, stores nothing per-visitor: a request carries
 * a batch of allowlisted events and becomes parameterized counter upserts.
 *
 * Secrets/bindings come from the environment only:
 *   DB              — D1 database binding
 *   ALLOWED_ORIGINS — comma-separated origins allowed to POST /collect
 *   ADMIN_TOKEN     — bearer token for GET /summary (optional)
 */
import { validatePayload, bodyTooLarge } from './validate.mjs';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return preflight(request, env);
    }
    if (request.method === 'GET' && url.pathname === '/healthz') {
      return new Response('ok', { status: 200 });
    }
    if (request.method === 'POST' && url.pathname === '/collect') {
      return collect(request, env);
    }
    if (request.method === 'GET' && url.pathname === '/summary') {
      return summary(request, env);
    }
    return new Response('not found', { status: 404 });
  },
};

function corsOrigin(request, env) {
  const origin = request.headers.get('origin') ?? '';
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  // Exact match only; wildcard origins would let any page beacon as us.
  return allowed.includes(origin) ? origin : null;
}

function preflight(request, env) {
  const origin = corsOrigin(request, env);
  if (!origin) return new Response(null, { status: 403 });
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

async function collect(request, env) {
  const origin = corsOrigin(request, env);
  if (!origin) return new Response('origin not allowed', { status: 403 });
  if ((request.headers.get('content-type') ?? '').split(';')[0] !== 'application/json') {
    return new Response('content-type must be application/json', { status: 415 });
  }

  const text = await request.text();
  if (bodyTooLarge(text)) return new Response('body too large', { status: 413 });

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ ok: false, reason: 'invalid json' }, 400);
  }

  const result = validatePayload(body);
  if (!result.ok) return json(result, 400);

  if (!env.DB) return new Response('collector not configured', { status: 503 });

  const day = new Date().toISOString().slice(0, 10);
  const statements = [];
  for (const event of result.events) {
    const propKeys = Object.keys(event.props);
    if (propKeys.length === 0) {
      statements.push(
        env.DB.prepare(
          'INSERT INTO counters (day, event, prop_key, prop_value, count) VALUES (?1, ?2, ?3, ?4, 1) ON CONFLICT(day, event, prop_key, prop_value) DO UPDATE SET count = count + 1',
        ).bind(day, event.name, '', ''),
      );
    }
    for (const key of propKeys) {
      statements.push(
        env.DB.prepare(
          'INSERT INTO counters (day, event, prop_key, prop_value, count) VALUES (?1, ?2, ?3, ?4, 1) ON CONFLICT(day, event, prop_key, prop_value) DO UPDATE SET count = count + 1',
        ).bind(day, event.name, key, event.props[key]),
      );
    }
  }
  // Parameterized D1 batch: values are bound, never interpolated.
  await env.DB.batch(statements);
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': origin } });
}

async function summary(request, env) {
  const token = env.ADMIN_TOKEN ?? '';
  const header = request.headers.get('authorization') ?? '';
  const expected = 'Bearer ' + token;
  // Timing-safe compare; both sides buffered so length never leaks.
  const a = new TextEncoder().encode(header);
  const b = new TextEncoder().encode(expected);
  const ok = a.length === b.length && crypto.subtle && timingSafeEqual(a, b);
  if (!ok) return new Response('unauthorized', { status: 401 });
  if (!env.DB) return new Response('not configured', { status: 503 });

  const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const stmt = env.DB.prepare(
    'SELECT day, event, prop_key, prop_value, sum(count) AS total FROM counters WHERE day >= ?1 GROUP BY day, event, prop_key, prop_value ORDER BY day DESC LIMIT 1000',
  );
  const rows = await stmt.bind(since).all();
  return json({ since, rows: rows.results ?? [] }, 200);
}

function timingSafeEqual(a, b) {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
