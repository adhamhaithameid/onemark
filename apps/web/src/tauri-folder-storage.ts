/**
 * FolderStorage (M2 tasks 2.3–2.4): a StorageProvider over a real folder on
 * disk, obtained through the OS folder picker. This is the milestone the
 * project was started for — open a cloned repository, read its README.
 *
 * Architecture: all Tauri plugin calls go through an injected adapter, so the
 * provider logic is fully unit-testable headlessly and the web build never
 * imports Tauri. The main thread constructs the adapter from the Tauri plugin
 * APIs only when running inside the shell.
 *
 * Persistence (2.4): the chosen folder path is stored in the injected kv
 * store; on the next launch the provider restores it. Desktop Tauri builds
 * are not App-Store-sandboxed, so a remembered path stays readable across
 * launches — security-scoped bookmarks are only required for sandboxed
 * (App Store) distribution, which v1 does not target (documented in the
 * M2 tickets).
 */
import type { DocumentRef, StorageProvider } from '@onemark/storage';

/** Minimal shape of the Tauri fs/dialog plugin APIs this provider needs. */
export interface FolderAdapter {
  /** OS folder picker; resolves null when the user cancels. */
  pickFolder(): Promise<string | null>;
  /** Directory listing: child file names of an absolute directory path. */
  readDir(path: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<{ size: number; modifiedAt: number }>;
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, contents: string): Promise<void>;
  remove(path: string): Promise<void>;
  /** Simple string key-value persistence (localStorage in the shell). */
  kvGet(key: string): Promise<string | null>;
  kvSet(key: string, value: string): Promise<void>;
}

const ROOT_KEY = 'onemark.folder.root';
const MD_RE = /\.md$/i;

export class TauriFolderStorage implements StorageProvider {
  readonly id = 'folder' as const;
  readonly capabilities = { canOpenFolder: true, canWrite: true, canWatch: false };

  private root: string | null = null;

  constructor(private readonly adapter: FolderAdapter) {}

  /** Restores the remembered folder, if any. Call once at boot. */
  async restore(): Promise<boolean> {
    const remembered = await this.adapter.kvGet(ROOT_KEY);
    if (!remembered) return false;
    if (!(await this.adapter.exists(remembered))) {
      await this.adapter.kvSet(ROOT_KEY, '');
      return false;
    }
    this.root = remembered;
    return true;
  }

  /** Opens the OS folder picker; remembers the choice across launches. */
  async openFolder(): Promise<boolean> {
    const picked = await this.adapter.pickFolder();
    if (!picked) return false;
    this.root = picked;
    await this.adapter.kvSet(ROOT_KEY, picked);
    return true;
  }

  currentRoot(): string | null {
    return this.root;
  }

  private requireRoot(): string {
    if (!this.root) throw new Error('no folder open — call openFolder() first');
    return this.root;
  }

  async list(): Promise<DocumentRef[]> {
    const root = this.requireRoot();
    const names = await this.adapter.readDir(root);
    const refs: DocumentRef[] = [];
    for (const name of names.filter((n) => MD_RE.test(n))) {
      const path = joinPath(root, name);
      const stat = await this.adapter.stat(path);
      refs.push({ id: path, name, path, size: stat.size, modifiedAt: stat.modifiedAt });
    }
    return refs.sort((a, b) => b.modifiedAt - a.modifiedAt);
  }

  async read(ref: DocumentRef): Promise<string> {
    return this.adapter.readTextFile(ref.path);
  }

  async put(input: { name: string; content: string }): Promise<{ ref: DocumentRef }> {
    const root = this.requireRoot();
    const path = joinPath(root, input.name);
    await this.adapter.writeTextFile(path, input.content);
    const stat = await this.adapter.stat(path);
    return {
      ref: { id: path, name: input.name, path, size: stat.size, modifiedAt: stat.modifiedAt },
    };
  }

  async remove(ref: DocumentRef): Promise<void> {
    await this.adapter.remove(ref.path);
  }
}

function joinPath(root: string, name: string): string {
  return root.endsWith('/') ? root + name : root + '/' + name;
}
