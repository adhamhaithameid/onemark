import { describe, expect, it } from 'vitest';
import worker from '../src/index.mjs';

/** Mock D1: records every statement and its bound values. */
function mockDb() {
  const db = {
    statements: [],
    prepared: [],
    prepare(sql) {
      const stmt = {
        sql,
        binds: [],
        bind(...args) {
          this.binds = args;
          db.statements.push({ sql, binds: args });
          return stmt;
        },
        all: async () => ({ results: [{ day: '2026-09-20', event: 'app_open', prop_key: 'version', prop_value: '0.1.0', total: 5 }] }),
      };
      db.prepared.push(stmt);
      return stmt;
    },
    batch: async (stmts) => {
      db.batched = stmts.length;
    },
  };
  return db;
}

function request(url, init = {}) {
  return new Request(url, init);
}

const ENV = { DB: mockDb(), ALLOWED_ORIGINS: 'https://onemark.example,http://localhost:5173', ADMIN_TOKEN: 'sekrit' };

function post(url, body, origin = 'https://onemark.example') {
  return request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', origin }, body });
}

describe('POST /collect', () => {
  it('stores one parameterized counter per prop and replies 204', async () => {
    const env = { ...ENV, DB: mockDb() };
    const res = await worker.fetch(
      post('https://worker.example/collect', JSON.stringify({ events: [{ name: 'app_open', props: { version: '0.1.0' } }] })),
      env,
    );
    expect(res.status).toBe(204);
    expect(env.DB.batched).toBe(1);
    const { sql, binds } = env.DB.statements[0];
    expect(sql).toContain('ON CONFLICT(day, event, prop_key, prop_value) DO UPDATE SET count = count + 1');
    expect(binds).toHaveLength(4); // day, event, prop_key, prop_value — fully parameterized
    expect(binds[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(binds[1]).toBe('app_open');
  });

  it('rejects invalid payloads with 400 and stores nothing', async () => {
    const env = { ...ENV, DB: mockDb() };
    const res = await worker.fetch(post('https://worker.example/collect', JSON.stringify({ events: [{ name: 'nope' }] })), env);
    expect(res.status).toBe(400);
    expect(env.DB.statements).toHaveLength(0);
  });

  it('rejects oversized bodies with 413', async () => {
    const env = { ...ENV, DB: mockDb() };
    const res = await worker.fetch(post('https://worker.example/collect', JSON.stringify({ events: [{ name: 'error', props: { kind: 'x'.repeat(20000) } }] })), env);
    expect(res.status).toBe(413);
  });

  it('rejects disallowed origins with 403', async () => {
    const env = { ...ENV, DB: mockDb() };
    const res = await worker.fetch(post('https://worker.example/collect', '{"events":[]}', 'https://evil.example'), env);
    expect(res.status).toBe(403);
    expect(env.DB.statements).toHaveLength(0);
  });

  it('requires json content type (415)', async () => {
    const env = { ...ENV, DB: mockDb() };
    const res = await worker.fetch(request('https://worker.example/collect', { method: 'POST', headers: { 'Content-Type': 'text/plain', origin: 'https://onemark.example' }, body: 'x' }), env);
    expect(res.status).toBe(415);
  });

  it('every stored statement is bound-parameterized (no string interpolation)', async () => {
    const env = { ...ENV, DB: mockDb() };
    await worker.fetch(
      post('https://worker.example/collect', JSON.stringify({ events: [{ name: 'render', props: { size_bucket: '10-100KB', ms_bucket: '<50', engine: 'comrak-wasm-worker' } }] })),
      env,
    );
    for (const { sql, binds } of env.DB.statements) {
      // User data must arrive as bound placeholders (?1..?4) — the only
      // literal in VALUES is the constant initial count `1`.
      expect(sql).toContain('VALUES (?1, ?2, ?3, ?4, 1)');
      expect(sql).not.toMatch(/VALUES \('[^']*'/);
      expect(binds.length).toBe(4);
    }
  });
});

describe('CORS + preflight', () => {
  it('preflight from an allowed origin echoes only that origin', async () => {
    const res = await worker.fetch(request('https://worker.example/collect', { method: 'OPTIONS', headers: { origin: 'http://localhost:5173' } }), ENV);
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
  });

  it('preflight from a disallowed origin is 403', async () => {
    const res = await worker.fetch(request('https://worker.example/collect', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }), ENV);
    expect(res.status).toBe(403);
  });
});

describe('GET /healthz and /summary', () => {
  it('healthz is open', async () => {
    const res = await worker.fetch(request('https://worker.example/healthz'), ENV);
    expect(res.status).toBe(200);
  });

  it('summary requires the admin token', async () => {
    const env = { ...ENV, DB: mockDb() };
    const denied = await worker.fetch(request('https://worker.example/summary'), env);
    expect(denied.status).toBe(401);
    const wrong = await worker.fetch(request('https://worker.example/summary', { headers: { authorization: 'Bearer nope' } }), env);
    expect(wrong.status).toBe(401);
    const allowed = await worker.fetch(request('https://worker.example/summary', { headers: { authorization: 'Bearer sekrit' } }), env);
    expect(allowed.status).toBe(200);
  });

  it('summary query is parameterized on the date window', async () => {
    const env = { ...ENV, DB: mockDb() };
    await worker.fetch(request('https://worker.example/summary', { headers: { authorization: 'Bearer sekrit' } }), env);
    expect(env.DB.statements[0].binds[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
