/**
 * The workspace: split view (task 1.15), debounced live preview, save to the
 * recent-files store (1.17), theme application (1.18) and proportional scroll
 * sync (1.16).
 *
 * Framework-free on purpose — CodeMirror 6 plus a few DOM calls is the whole
 * UI. Everything here runs against injected dependencies so the integration
 * suite drives it under jsdom with the real engine and renderer.
 */

import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';

import type { MarkdownEngine, MarkdownNode } from '@onemark/engine';
import { renderToSafeHtml, hydrateMermaid, type SyntaxHighlighter } from '@onemark/renderer';
import type { DocumentRef, StorageProvider } from '@onemark/storage';

import { applyTheme, type ThemeChoice } from './theme.js';

export interface WorkspaceOptions {
  engine: MarkdownEngine;
  container: HTMLElement;
  storage?: StorageProvider;
  highlighter?: SyntaxHighlighter;
  /** Tests pass 0 to skip debounce waits. Default 150 ms (task 1.15). */
  debounceMs?: number;
  prefersDark?: boolean;
}

export interface Workspace {
  openDocument(ref: DocumentRef): Promise<void>;
  setDocumentText(text: string): void;
  save(): Promise<DocumentRef | undefined>;
  setTheme(choice: ThemeChoice): void;
  currentRef(): DocumentRef | undefined;
  isDirty(): boolean;
  previewHtml(): string;
  destroy(): void;
}

const EDITOR_PANE_CLASS = 'onemark-editor-pane';
const PREVIEW_PANE_CLASS = 'onemark-preview-pane';

export function createWorkspace(options: WorkspaceOptions): Workspace {
  const { engine, container, highlighter } = options;
  const storage: StorageProvider | undefined = options.storage;
  const debounceMs = options.debounceMs ?? 150;

  container.classList.add('onemark-workspace');
  const editorPane = document.createElement('div');
  editorPane.className = EDITOR_PANE_CLASS;
  const previewPane = document.createElement('div');
  previewPane.className = `${PREVIEW_PANE_CLASS} markdown-body`;
  container.append(editorPane, previewPane);

  let current: DocumentRef | undefined;
  let dirty = false;

  async function renderPreview(source: string): Promise<void> {
    const ast: MarkdownNode = await engine.parse(source, {
      dialect: 'gfm',
      extensions: {
        tables: true,
        strikethrough: true,
        autolink: true,
        taskList: true,
        footnotes: true,
        alerts: true,
        math: true,
        frontmatter: true,
      },
    });
    previewPane.innerHTML = renderToSafeHtml(
      ast,
      highlighter ? { highlighter } : {},
    );
    await hydrateMermaid(previewPane);
  }

  const editorView = new EditorView({
    parent: editorPane,
    doc: '',
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      markdown({ base: markdownLanguage }),
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) return;
        dirty = true;
        scheduleRender(update.state.doc.toString());
      }),
    ],
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  let rendering: Promise<void> = Promise.resolve();
  function scheduleRender(source: string): void {
    if (timer !== undefined) clearTimeout(timer);
    if (debounceMs === 0) {
      rendering = rendering.then(() => renderPreview(source)).catch(() => {});
      return;
    }
    timer = setTimeout(() => {
      rendering = rendering.then(() => renderPreview(source)).catch(() => {});
    }, debounceMs);
  }

  // Proportional scroll sync (task 1.16). The AST carries exact positions for
  // a future precise mapping; v1 keeps panes aligned by scroll fraction.
  function bindScrollSync(from: HTMLElement, to: HTMLElement): () => void {
    const handler = (): void => {
      const fromMax = from.scrollHeight - from.clientHeight;
      const toMax = to.scrollHeight - to.clientHeight;
      if (fromMax <= 0 || toMax <= 0) return;
      to.scrollTop = (from.scrollTop / fromMax) * toMax;
    };
    from.addEventListener('scroll', handler, { passive: true });
    return () => from.removeEventListener('scroll', handler);
  }
  const unbindScroll = bindScrollSync(editorPane, previewPane);

  const workspace: Workspace = {
    async openDocument(ref: DocumentRef): Promise<void> {
      if (!storage) throw new Error('no storage attached');
      const content = await storage.read(ref);
      editorView.dispatch({
        changes: { from: 0, to: editorView.state.doc.length, insert: content },
      });
      current = ref;
      dirty = false;
      await renderPreview(content);
    },

    setDocumentText(text: string): void {
      editorView.dispatch({
        changes: { from: 0, to: editorView.state.doc.length, insert: text },
      });
    },

    async save(): Promise<DocumentRef | undefined> {
      if (!storage || !current) return undefined;
      const content = editorView.state.doc.toString();
      const { ref } = await storage.put({ name: current.name ?? current.id, content });
      current = ref;
      dirty = false;
      return ref;
    },

    setTheme(choice: ThemeChoice): void {
      applyTheme(document, choice, options.prefersDark ?? false);
    },

    currentRef(): DocumentRef | undefined {
      return current;
    },

    isDirty(): boolean {
      return dirty;
    },

    previewHtml(): string {
      return previewPane.innerHTML;
    },

    destroy(): void {
      unbindScroll();
      editorView.destroy();
      container.replaceChildren();
    },
  };

  return workspace;
}
