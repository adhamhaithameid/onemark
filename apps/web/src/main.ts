import './styles.css';

import { loadWebEngine } from '@onemark/engine';
import { createSyntaxHighlighter } from '@onemark/renderer';
import { MemoryStorage, OpfsStorage, openOpfsRoot, type StorageProvider } from '@onemark/storage';

import { applyTheme, onSystemThemeChange, type ThemeChoice } from './theme.js';
import { createWorkspace } from './workspace.js';
import { startWorkerEngine, type WorkerEngine } from './worker-engine.js';
import { TauriFolderStorage, type FolderAdapter } from './tauri-folder-storage.js';

const THEME_CYCLE: ThemeChoice[] = ['system', 'light', 'dark'];

/** True only inside the Tauri shell (M2 desktop build). */
const IN_TAURI = '__TAURI_INTERNALS__' in window;

async function pickStorage(): Promise<StorageProvider> {
  if (IN_TAURI) {
    // Desktop shell: a real folder on disk (tasks 2.3–2.4). The Tauri plugin
    // APIs are dynamically imported so the web build never pulls them.
    const [dialog, fs] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs'),
    ]);
    const adapter: FolderAdapter = {
      pickFolder: async () => {
        const picked = await dialog.open({ directory: true, multiple: false, title: 'Open a folder' });
        return typeof picked === 'string' ? picked : null;
      },
      readDir: async (path) =>
        (await fs.readDir(path))
          .filter((entry) => entry.isFile)
          .map((entry) => entry.name),
      exists: (path) => fs.exists(path),
      stat: async (path) => {
        const s = await fs.stat(path);
        return {
          size: Number(s.size),
          modifiedAt: s.mtime ? s.mtime.getTime() : 0,
        };
      },
      readTextFile: (path) => fs.readTextFile(path),
      writeTextFile: (path, contents) => fs.writeTextFile(path, contents),
      remove: (path) => fs.remove(path),
      kvGet: async (key) => localStorage.getItem(key),
      kvSet: async (key, value) => localStorage.setItem(key, value),
    };
    return new TauriFolderStorage(adapter);
  }
  try {
    return new OpfsStorage(await openOpfsRoot());
  } catch {
    // No OPFS (non-secure context, old browser): memory keeps the app usable
    // for the session; persistence returns with a fallback store if ever needed.
    return new MemoryStorage();
  }
}

async function boot(): Promise<void> {
  const [engine, highlighter, storage] = await Promise.all([
    startWorkerEngine(() =>
      new Worker(new URL('./parse.worker.ts', import.meta.url), { type: 'module' }),
    ),
    createSyntaxHighlighter(),
    pickStorage(),
    loadWebEngine().catch(() => undefined), // warm the direct build for worker fallback
  ]);

  const container = document.getElementById('app') as HTMLElement;

  // Desktop-only affordance: folder open (tasks 2.3–2.4). Hidden on web.
  const openFolderButton = document.getElementById('open-folder-button');
  if (openFolderButton instanceof HTMLButtonElement) {
    openFolderButton.hidden = !storage.capabilities.canOpenFolder;
    openFolderButton.addEventListener('click', () => {
      void (storage as TauriFolderStorage).openFolder();
    });
  }

  // Perf ladder rungs 1+2 (ADR-0019/0022): parse + render + highlight happen
  // in the worker as top-level blocks; the main thread sanitises the blocks
  // (chunked, linear) with its complete DOM (fail-closed) and hydrates math.
  // The highlighter stays on the main thread only for the token stylesheet.
  const renderHtml = (source: string, theme: 'light' | 'dark'): Promise<string[]> =>
    (engine as WorkerEngine).renderUnsafeBlocks(source, theme);

  const workspace = createWorkspace({ engine, container, storage, renderHtml });

  // Shiki token colours: the adapter emits theme-prefixed `.tk-*` classes, so
  // both sheets can live in one style node and only the rendered spans'
  // classes apply. Without this the highlighted code is unstyled.
  if (highlighter) {
    const style = document.createElement('style');
    style.id = 'shiki-tokens';
    style.textContent = `${highlighter.css('light')}\n${highlighter.css('dark')}`;
    document.head.appendChild(style);
  }

  workspace.setTheme('system');
  onSystemThemeChange(() => {
    const current = (document.getElementById('theme-button')?.dataset['choice'] as ThemeChoice) ?? 'system';
    applyTheme(document, current, matchMedia('(prefers-color-scheme: dark)').matches);
  });

  document.getElementById('save-button')?.addEventListener('click', () => void workspace.save());
  const themeButton = document.getElementById('theme-button') as HTMLButtonElement;
  let choiceIndex = 0;
  themeButton.addEventListener('click', () => {
    choiceIndex = (choiceIndex + 1) % THEME_CYCLE.length;
    const choice = THEME_CYCLE[choiceIndex] as ThemeChoice;
    themeButton.dataset['choice'] = choice;
    themeButton.textContent = `Theme: ${choice}`;
    workspace.setTheme(choice);
  });
  themeButton.dataset['choice'] = 'system';

  // Task 1.17: drag & drop and paste bring documents into the store.
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (!file) return;
    const content = await file.text();
    const { ref } = await storage.put({ name: file.name, content });
    await workspace.openDocument(ref);
  });
  document.addEventListener('paste', async (e) => {
    const text = e.clipboardData?.getData('text/plain');
    if (!text || !(e.target instanceof Element) || e.target.closest('.cm-editor')) return;
    const name = `pasted-${Date.now()}.md`;
    const { ref } = await storage.put({ name, content: text });
    await workspace.openDocument(ref);
  });

  window.addEventListener('beforeunload', (e) => {
    if (!workspace.isDirty()) return;
    e.preventDefault();
  });
}

void boot();
