import './styles.css';

import { loadWebEngine } from '@onemark/engine';
import { createSyntaxHighlighter } from '@onemark/renderer';
import { MemoryStorage, OpfsStorage, openOpfsRoot, type StorageProvider } from '@onemark/storage';

import { applyTheme, onSystemThemeChange, type ThemeChoice } from './theme.js';
import { createWorkspace } from './workspace.js';
import { startWorkerEngine } from './worker-engine.js';

const THEME_CYCLE: ThemeChoice[] = ['system', 'light', 'dark'];

async function pickStorage(): Promise<StorageProvider> {
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
  const workspace = createWorkspace({ engine, container, storage, highlighter });

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
