import type { DocumentRef, StorageProvider } from './types.js';

/**
 * Minimal structural views of the OPFS surface we use. Real browser handles
 * satisfy these interfaces; tests inject fakes with the same shape, which is
 * what lets the storage contract run outside a browser.
 */
export interface OpfsFileHandle {
  getFile(): Promise<{ text(): Promise<string>; lastModified: number; size: number }>;
  createWritable(options?: { keepExistingData?: boolean }): Promise<{
    write(data: string | BufferSource | Blob): Promise<void>;
    close(): Promise<void>;
  }>;
}

export interface OpfsDirectoryHandle {
  values(): AsyncIterable<{ kind: 'file' | 'directory'; name: string }>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<OpfsFileHandle>;
  removeEntry(name: string): Promise<void>;
}

/**
 * The web provider (ADR-0007): the app-private OPFS sandbox as a
 * **recent-files store** (OQ-5 resolution). Flat namespace — one file per
 * document, filename = id — because that is the whole job: get back to
 * yesterday's file. No folders, no metadata, no collections.
 *
 * The real root comes from `navigator.storage.getDirectory()` at the call site
 * (it needs a browser); everything here only requires the structural handles,
 * so the full contract suite runs against injected fakes.
 */
export class OpfsStorage implements StorageProvider {
  readonly id = 'opfs' as const;
  readonly capabilities = { canOpenFolder: false, canWrite: true, canWatch: false } as const;

  constructor(private readonly root: OpfsDirectoryHandle) {}

  async list(): Promise<DocumentRef[]> {
    const refs: DocumentRef[] = [];
    for await (const entry of this.root.values()) {
      if (entry.kind !== 'file') continue;
      const handle = await this.root.getFileHandle(entry.name);
      const file = await handle.getFile();
      refs.push({
        id: entry.name,
        name: entry.name,
        path: entry.name,
        size: file.size,
        modifiedAt: file.lastModified,
      });
    }
    return refs.sort((a, b) => b.modifiedAt - a.modifiedAt);
  }

  async read(ref: DocumentRef): Promise<string> {
    try {
      const handle = await this.root.getFileHandle(ref.id);
      return await handle.getFile().then((f) => f.text());
    } catch {
      throw new Error(`unknown document: ${ref.id}`);
    }
  }

  async put(input: { name: string; content: string }): Promise<{ ref: DocumentRef }> {
    const handle = await this.root.getFileHandle(input.name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(input.content);
    await writable.close();
    const file = await handle.getFile();
    return {
      ref: {
        id: input.name,
        name: input.name,
        path: input.name,
        size: file.size,
        modifiedAt: file.lastModified || Date.now(),
      },
    };
  }

  async remove(ref: DocumentRef): Promise<void> {
    await this.root.removeEntry(ref.id);
  }
}

/** The real browser root. Browser-only by definition — never import server-side. */
export async function openOpfsRoot(): Promise<OpfsDirectoryHandle> {
  const nav = navigator as Navigator & {
    storage?: { getDirectory(): Promise<OpfsDirectoryHandle> };
  };
  if (!nav.storage?.getDirectory) throw new Error('OPFS unavailable in this context');
  // The runtime handle satisfies the structural interface; the ambient DOM
  // types for OPFS iterators lag behind what browsers ship.
  return nav.storage.getDirectory() as unknown as OpfsDirectoryHandle;
}
