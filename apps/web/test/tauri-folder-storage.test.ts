import { describe, expect, it } from 'vitest';
import { TauriFolderStorage, type FolderAdapter } from '../src/tauri-folder-storage.js';

/** In-memory filesystem + kv implementing the adapter contract. */
function fakeAdapter(files: Record<string, string> = {}) {
  const files_ = new Map(Object.entries(files));
  const kv = new Map<string, string>();
  let pickResult: string | null = null;
  const calls: string[] = [];
  const adapter: FolderAdapter = {
    async pickFolder() {
      calls.push('pickFolder');
      return pickResult;
    },
    async readDir(path) {
      calls.push('readDir:' + path);
      // Depth-1 listing like the real fs plugin: direct children only, no
      // nested paths.
      return [...files_.keys()]
        .filter((p) => p.startsWith(path + '/'))
        .map((p) => p.slice(path.length + 1))
        .filter((n) => !n.includes('/'));
    },
    async exists(path) {
      return files_.has(path) || path === pickResult;
    },
    async stat(path) {
      return { size: files_.get(path)?.length ?? 0, modifiedAt: 1000 };
    },
    async readTextFile(path) {
      return files_.get(path) ?? (() => { throw new Error('not found: ' + path); })();
    },
    async writeTextFile(path, contents) {
      calls.push('write:' + path);
      files_.set(path, contents);
    },
    async remove(path) {
      calls.push('remove:' + path);
      files_.delete(path);
    },
    async kvGet(k) {
      return kv.get(k) ?? null;
    },
    async kvSet(k, v) {
      kv.set(k, v);
    },
  };
  return {
    adapter,
    calls,
    files: files_,
    kv,
    setPick(path: string | null) {
      pickResult = path;
    },
  };
}

const REPO = '/Users/me/notes-repo';

describe('TauriFolderStorage (tasks 2.3–2.4)', () => {
  it('list() returns only markdown files, newest first, with joined paths', async () => {
    const h = fakeAdapter({
      [`${REPO}/README.md`]: 'readme',
      [`${REPO}/logo.png`]: 'png',
      [`${REPO}/docs/GUIDE.md`]: 'nested stays out (flat listing v1)',
    });
    const storage = new TauriFolderStorage(h.adapter);
    h.setPick(REPO);
    await storage.openFolder();
    const refs = await storage.list();
    expect(refs.map((r) => r.name)).toEqual(['README.md']);
    expect(refs[0]?.path).toBe(`${REPO}/README.md`);
  });

  it('read() returns file bytes; put() writes into the open folder', async () => {
    const h = fakeAdapter({ [`${REPO}/README.md`]: 'hello' });
    const storage = new TauriFolderStorage(h.adapter);
    h.setPick(REPO);
    await storage.openFolder();

    expect(await storage.read({ id: `${REPO}/README.md`, name: 'README.md', path: `${REPO}/README.md`, size: 5, modifiedAt: 1 })).toBe('hello');

    const { ref } = await storage.put({ name: 'notes.md', content: 'my notes' });
    expect(ref.path).toBe(`${REPO}/notes.md`);
    expect(h.files.get(`${REPO}/notes.md`)).toBe('my notes');
  });

  it('remove() deletes through the adapter', async () => {
    const h = fakeAdapter({ [`${REPO}/a.md`]: 'x' });
    const storage = new TauriFolderStorage(h.adapter);
    h.setPick(REPO);
    await storage.openFolder();
    await storage.remove({ id: `${REPO}/a.md`, name: 'a.md', path: `${REPO}/a.md`, size: 1, modifiedAt: 1 });
    expect(h.files.get(`${REPO}/a.md`)).toBeUndefined();
  });

  it('openFolder() remembers the choice across launches (2.4 persistence)', async () => {
    const h = fakeAdapter({ [`${REPO}/README.md`]: 'readme' });
    h.setPick(REPO);
    const first = new TauriFolderStorage(h.adapter);
    await first.openFolder();
    expect(h.kv.get('onemark.folder.root')).toBe(REPO);

    // "Relaunch": a fresh provider instance over the same kv restores the root.
    const second = new TauriFolderStorage(h.adapter);
    expect(await second.restore()).toBe(true);
    expect(second.currentRoot()).toBe(REPO);
    const refs = await second.list();
    expect(refs.map((r) => r.name)).toEqual(['README.md']);
  });

  it('restore() clears a remembered folder that no longer exists', async () => {
    const h = fakeAdapter();
    h.kv.set('onemark.folder.root', '/gone/repo');
    const storage = new TauriFolderStorage(h.adapter);
    expect(await storage.restore()).toBe(false);
    expect(h.kv.get('onemark.folder.root')).toBe('');
  });

  it('a cancelled picker changes nothing', async () => {
    const h = fakeAdapter();
    h.setPick(null);
    const storage = new TauriFolderStorage(h.adapter);
    expect(await storage.openFolder()).toBe(false);
    expect(storage.currentRoot()).toBeNull();
    await expect(storage.list()).rejects.toThrow('no folder open');
  });

  it('advertises folder + write capabilities, watch deferred (v1)', () => {
    const storage = new TauriFolderStorage(fakeAdapter().adapter);
    expect(storage.capabilities).toEqual({ canOpenFolder: true, canWrite: true, canWatch: false });
  });
});
