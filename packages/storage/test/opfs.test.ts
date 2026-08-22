import { storageContract } from './contract.js';
import { OpfsStorage, type OpfsDirectoryHandle } from '../src/index.js';

/**
 * A structural fake of the OPFS surface the provider touches — the real
 * browser handles satisfy these interfaces by construction. Running the full
 * contract suite here means OPFS semantics are proven outside a browser.
 */
function makeFakeRoot(): OpfsDirectoryHandle {
  const files = new Map<string, { content: string; lastModified: number }>();

  const fileHandle = (name: string) => ({
    async getFile() {
      const file = files.get(name);
      if (!file) throw new DOMException('NotFoundError', 'NotFoundError');
      return {
        text: async () => file.content,
        lastModified: file.lastModified,
        size: file.content.length,
      };
    },
    async createWritable() {
      let written: string | null = null;
      return {
        write: async (data: string | BufferSource | Blob) => {
          if (typeof data !== 'string') throw new Error('fake accepts strings only');
          written = data;
        },
        close: async () => {
          files.set(name, { content: written ?? '', lastModified: Date.now() });
        },
      };
    },
  });

  return {
    // eslint-disable-next-line require-yield
    async *values() {
      for (const name of [...files.keys()]) yield { kind: 'file' as const, name };
    },
    async getFileHandle(name, options) {
      if (!files.has(name)) {
        if (!options?.create) throw new DOMException('NotFoundError', 'NotFoundError');
        files.set(name, { content: '', lastModified: 0 });
      }
      return fileHandle(name);
    },
    async removeEntry(name) {
      if (!files.delete(name)) throw new DOMException('NotFoundError', 'NotFoundError');
    },
  };
}

storageContract('opfs (fake root)', async () => new OpfsStorage(makeFakeRoot()));
