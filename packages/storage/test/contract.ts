/**
 * The StorageProvider contract (tech spec §4) as a runnable suite.
 *
 * Every implementation — memory, OPFS, folder — must satisfy the same
 * semantics, so the UI can branch on `capabilities` and never on platform
 * (ADR-0007). New implementations get this suite for free by feeding
 * `makeStorage()`; if a behaviour differs between providers, it is a bug here,
 * not a test change.
 *
 * Scope per OQ-5 resolution: a **recent-files store**. Flat namespace, no
 * folders, upsert-by-name, newest-first listing. Nothing more.
 */

import { describe, expect, it } from 'vitest';
import type { DocumentRef, StorageProvider } from '../src/index.js';

export function storageContract(name: string, makeStorage: () => Promise<StorageProvider>): void {
  describe(`storage contract: ${name}`, () => {
    it('starts empty', async () => {
      const storage = await makeStorage();
      expect(await storage.list()).toEqual([]);
    });

    it('saves a document and lists it newest-first with metadata', async () => {
      const storage = await makeStorage();
      await storage.put({ name: 'readme.md', content: '# hi' });
      const refs = await storage.list();
      expect(refs).toHaveLength(1);
      const ref = refs[0];
      expect(ref?.name).toBe('readme.md');
      expect(ref?.size).toBe('# hi'.length);
      expect(ref?.modifiedAt).toBeGreaterThan(0);
      expect(ref?.id).toBeTruthy();
    });

    it('reads back byte-identical content by id', async () => {
      const storage = await makeStorage();
      const { ref } = await storage.put({ name: 'notes.md', content: 'line1\nline2\n' });
      expect(await storage.read(ref)).toBe('line1\nline2\n');
    });

    it('upserts by name: same document, new modifiedAt, one entry', async () => {
      const storage = await makeStorage();
      const first = await storage.put({ name: 'a.md', content: 'v1' });
      await new Promise((r) => setTimeout(r, 5));
      const second = await storage.put({ name: 'a.md', content: 'v2 longer' });
      expect(second.ref.id).toBe(first.ref.id);
      expect(second.ref.modifiedAt).toBeGreaterThanOrEqual(first.ref.modifiedAt);
      const refs = await storage.list();
      expect(refs).toHaveLength(1);
      expect(await storage.read(refs[0] as DocumentRef)).toBe('v2 longer');
    });

    it('lists multiple documents newest-first', async () => {
      const storage = await makeStorage();
      await storage.put({ name: 'old.md', content: 'a' });
      await new Promise((r) => setTimeout(r, 5));
      await storage.put({ name: 'new.md', content: 'b' });
      const names = (await storage.list()).map((r) => r.name);
      expect(names).toEqual(['new.md', 'old.md']);
    });

    it('removes documents', async () => {
      const storage = await makeStorage();
      const { ref } = await storage.put({ name: 'gone.md', content: 'x' });
      await storage.remove(ref);
      expect(await storage.list()).toEqual([]);
      await expect(storage.read(ref)).rejects.toThrow();
    });

    it('rejects reading an unknown id', async () => {
      const storage = await makeStorage();
      await expect(storage.read({ id: 'nope', name: 'x', path: 'x', size: 0, modifiedAt: 0 })).rejects.toThrow();
    });
  });
}
