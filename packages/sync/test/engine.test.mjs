import { describe, expect, it } from 'vitest';
import { createSyncEngine, conflictCopyName } from '../src/engine.mjs';

/** In-memory local adapter with mtimes we control. */
function fakeLocal(files) {
  const store = new Map(Object.entries(files).map(([name, m]) => [name, { ...m }]));
  let nextId = 1;
  return {
    store,
    async list() {
      return [...store.values()].map(({ id, name, modifiedAt }) => ({ id, name, modifiedAt }));
    },
    async read(id) {
      const doc = [...store.values()].find((d) => d.id === id);
      if (!doc) throw new Error('unknown id ' + id);
      return doc.content;
    },
    async put({ name, content }) {
      const existing = store.get(name);
      const id = existing?.id ?? 'local-' + nextId++;
      store.set(name, { id, name, content, modifiedAt: existing?.modifiedAt ?? Date.now() });
      return id;
    },
  };
}

/** Fake provider with folder contents and recorded operations. */
function fakeProvider(files) {
  const remote = new Map(Object.entries(files).map(([name, m]) => [name, { ...m }]));
  const ops = [];
  return {
    remote,
    ops,
    id: 'webdav',
    displayName: 'Fake',
    async list() {
      ops.push({ op: 'list' });
      return [...remote.values()].map(({ name, path, modifiedAt, size }) => ({ id: path, name, path, modifiedAt, size }));
    },
    async get(path) {
      ops.push({ op: 'get', path });
      const doc = [...remote.values()].find((d) => d.path === path);
      return { content: doc.content, modifiedAt: doc.modifiedAt, etag: 'e1' };
    },
    async put(path, content) {
      ops.push({ op: 'put', path });
      const name = path.split('/').pop();
      const modifiedAt = (remote.get(name)?.modifiedAt ?? 0) + 1;
      remote.set(name, { name, path, content, modifiedAt, size: content.length });
      return { modifiedAt, etag: 'e2' };
    },
    async remove(path) {
      ops.push({ op: 'remove', path });
    },
  };
}

const NOW = 1_700_000_000_000;

describe('sync engine — the four states', () => {
  it('pulls a remote-only document', async () => {
    const local = fakeLocal({});
    const provider = fakeProvider({ a: { name: 'a.md', path: '/dav/a.md', content: 'remote', modifiedAt: 5, size: 6 } });
    const engine = createSyncEngine(provider, local);
    const report = await engine.syncOnce('/dav');
    expect(report.plan).toEqual([{ doc: 'a.md', action: 'pull' }]);
    expect(local.store.get('a.md').content).toBe('remote');
  });

  it('pushes a local-only document', async () => {
    const local = fakeLocal({ 'b.md': { id: 'l1', name: 'b.md', content: 'local', modifiedAt: 7 } });
    const provider = fakeProvider({});
    const engine = createSyncEngine(provider, local);
    const report = await engine.syncOnce('/dav');
    expect(report.plan).toEqual([{ doc: 'b.md', action: 'push' }]);
    expect(provider.remote.get('b.md').content).toBe('local');
  });

  it('pushes when only the local side changed since the baseline', async () => {
    const local = fakeLocal({ 'c.md': { id: 'l1', name: 'c.md', content: 'edited', modifiedAt: 20 } });
    const provider = fakeProvider({ 'c.md': { name: 'c.md', path: '/dav/c.md', content: 'old', modifiedAt: 10, size: 3 } });
    const lastSynced = new Map([['c.md', 10]]);
    const engine = createSyncEngine(provider, local);
    const report = await engine.syncOnce('/dav', { lastSynced });
    expect(report.plan).toEqual([{ doc: 'c.md', action: 'push' }]);
  });

  it('pulls when only the remote side changed since the baseline', async () => {
    const local = fakeLocal({ 'd.md': { id: 'l1', name: 'd.md', content: 'old', modifiedAt: 10 } });
    const provider = fakeProvider({ 'd.md': { name: 'd.md', path: '/dav/d.md', content: 'new', modifiedAt: 30, size: 3 } });
    const lastSynced = new Map([['d.md', 10]]);
    const engine = createSyncEngine(provider, local);
    const report = await engine.syncOnce('/dav', { lastSynced });
    expect(report.plan).toEqual([{ doc: 'd.md', action: 'pull' }]);
    expect(local.store.get('d.md').content).toBe('new');
  });

  it('leaves untouched documents alone', async () => {
    const local = fakeLocal({ 'e.md': { id: 'l1', name: 'e.md', content: 'same', modifiedAt: 10 } });
    const provider = fakeProvider({ 'e.md': { name: 'e.md', path: '/dav/e.md', content: 'same', modifiedAt: 10, size: 4 } });
    const lastSynced = new Map([['e.md', 10]]);
    const engine = createSyncEngine(provider, local);
    const report = await engine.syncOnce('/dav', { lastSynced });
    expect(report.plan).toEqual([]);
    expect(report.untouched).toBe(1);
  });

  it('first sight without a baseline: newer side wins outright (documented)', async () => {
    const local = fakeLocal({ 'f.md': { id: 'l1', name: 'f.md', content: 'older local', modifiedAt: 5 } });
    const provider = fakeProvider({ 'f.md': { name: 'f.md', path: '/dav/f.md', content: 'newer remote', modifiedAt: 9, size: 3 } });
    const engine = createSyncEngine(provider, local);
    const report = await engine.syncOnce('/dav', {});
    expect(report.plan).toEqual([{ doc: 'f.md', action: 'pull' }]);
  });
});

describe('sync engine — conflicts (lww-with-copy)', () => {
  it('local wins: remote content preserved as conflict copy on both sides', async () => {
    const local = fakeLocal({ 'g.md': { id: 'l1', name: 'g.md', content: 'local edit', modifiedAt: 40 } });
    const provider = fakeProvider({ 'g.md': { name: 'g.md', path: '/dav/g.md', content: 'remote edit', modifiedAt: 30, size: 3 } });
    const lastSynced = new Map([['g.md', 10]]);
    const engine = createSyncEngine(provider, local);
    const report = await engine.syncOnce('/dav', { lastSynced, now: NOW });
    expect(report.conflicts).toBe(1);
    const copyName = conflictCopyName('g.md', NOW);
    expect(report.conflictCopies).toContain(copyName);
    expect(local.store.get(copyName).content).toBe('remote edit');
    expect(provider.remote.get(copyName).content).toBe('remote edit');
    expect(provider.remote.get('g.md').content).toBe('local edit');
  });

  it('remote wins: local content preserved as conflict copy on both sides', async () => {
    const local = fakeLocal({ 'h.md': { id: 'l1', name: 'h.md', content: 'local edit', modifiedAt: 20 } });
    const provider = fakeProvider({ 'h.md': { name: 'h.md', path: '/dav/h.md', content: 'remote edit', modifiedAt: 50, size: 3 } });
    const lastSynced = new Map([['h.md', 10]]);
    const engine = createSyncEngine(provider, local);
    const report = await engine.syncOnce('/dav', { lastSynced, now: NOW });
    expect(report.conflicts).toBe(1);
    const copyName = conflictCopyName('h.md', NOW);
    expect(local.store.get(copyName).content).toBe('local edit');
    expect(provider.remote.get(copyName).content).toBe('local edit');
    expect(local.store.get('h.md').content).toBe('remote edit');
  });
});

describe('sync engine — v1 contract', () => {
  it('deletions are never propagated: a local-only doc pushes, it never deletes remotely', async () => {
    const local = fakeLocal({ 'i.md': { id: 'l1', name: 'i.md', content: 'x', modifiedAt: 1 } });
    const provider = fakeProvider({});
    const engine = createSyncEngine(provider, local);
    await engine.syncOnce('/dav');
    expect(provider.ops.every((o) => o.op !== 'remove')).toBe(true);
  });

  it('dry run writes nothing locally or remotely', async () => {
    const local = fakeLocal({ 'j.md': { id: 'l1', name: 'j.md', content: 'local', modifiedAt: 2 } });
    const provider = fakeProvider({ 'k.md': { name: 'k.md', path: '/dav/k.md', content: 'remote', modifiedAt: 3, size: 6 } });
    const engine = createSyncEngine(provider, local);
    const report = await engine.syncOnce('/dav', { dryRun: true });
    expect(report.plan.length).toBe(2);
    expect(local.store.has('k.md')).toBe(false);
    expect(provider.remote.has('j.md')).toBe(false);
  });

  it('returns an updated baseline for the next run', async () => {
    const local = fakeLocal({ 'l.md': { id: 'l1', name: 'l.md', content: 'x', modifiedAt: 1 } });
    const provider = fakeProvider({});
    const engine = createSyncEngine(provider, local);
    const first = await engine.syncOnce('/dav', { lastSynced: new Map() });
    const before = provider.remote.get('l.md').modifiedAt;
    const second = await engine.syncOnce('/dav', { lastSynced: first.lastSynced });
    expect(second.plan).toEqual([]);
    expect(provider.remote.get('l.md').modifiedAt).toBe(before);
  });

  it('refuses unknown conflict policies', () => {
    expect(() => createSyncEngine(fakeProvider({}), fakeLocal({}), { conflictPolicy: 'crdt' })).toThrow();
  });
});

describe('conflictCopyName', () => {
  it('keeps the extension', () => {
    expect(conflictCopyName('README.md', NOW)).toBe('README.conflict-' + NOW + '.md');
  });

  it('handles extension-less names', () => {
    expect(conflictCopyName('notes', NOW)).toBe('notes.conflict-' + NOW + '.md');
  });
});
