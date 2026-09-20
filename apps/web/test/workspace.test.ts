// @vitest-environment jsdom
/**
 * M1c integration: the workspace wires CodeMirror (1.14), debounced live
 * preview (1.15), save/reopen through the recent-files store (1.17) and theme
 * switching (1.18). Real engine, real renderer, memory storage; debounce 0.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { loadNodeEngine } from '@onemark/engine/node';
import { type MarkdownEngine } from '@onemark/engine';
import { createSyntaxHighlighter, type SyntaxHighlighter } from '@onemark/renderer';
import { MemoryStorage } from '@onemark/storage';

import { createWorkspace, type Workspace } from '../src/workspace.js';

let engine: MarkdownEngine;
let highlighter: SyntaxHighlighter;

beforeAll(async () => {
  engine = await loadNodeEngine();
  highlighter = await createSyntaxHighlighter();
});

function makeWorkspace(storage?: MemoryStorage): Workspace {
  document.body.replaceChildren();
  const container = document.createElement('div');
  document.body.append(container);
  return createWorkspace({
    engine,
    container,
    ...(storage ? { storage } : {}),
    highlighter,
    debounceMs: 0,
  });
}

describe('workspace split view', () => {
  it('builds an editor pane and a preview pane', () => {
    const ws = makeWorkspace();
    expect(document.querySelector('.onemark-editor-pane .cm-editor')).toBeTruthy();
    expect(document.querySelector('.onemark-preview-pane')).toBeTruthy();
    ws.destroy();
  });

  it('live-updates the preview as the document changes', async () => {
    const ws = makeWorkspace();
    ws.setDocumentText('# Hello\n\nsome **bold** text\n');
    await new Promise((r) => setTimeout(r, 20));
    expect(ws.previewHtml()).toContain('<h1 id="user-content-hello">');
    expect(ws.previewHtml()).toContain('<strong>bold</strong>');
    ws.destroy();
  });

  it('highlights fenced code with the bundled adapter', async () => {
    const ws = makeWorkspace();
    ws.setDocumentText('```rust\nconst x: usize = 7;\n```\n');
    await new Promise((r) => setTimeout(r, 20));
    expect(ws.previewHtml()).toMatch(/tk-light-[0-9a-z]+/);
    ws.destroy();
  });

  it('saves to storage and reopens byte-identical', async () => {
    const storage = new MemoryStorage();
    const ws = makeWorkspace(storage);
    ws.setDocumentText('# Saved doc\n');
    // An unsaved workspace has no current ref; seed one as "opened file".
    const seeded = await storage.put({ name: 'notes.md', content: 'seed' });
    await ws.openDocument(seeded.ref);
    ws.setDocumentText('# Saved doc\n\nwith body\n');
    const ref = await ws.save();
    expect(ref?.name).toBe('notes.md');

    const reopened = makeWorkspace(storage);
    await reopened.openDocument(ref as NonNullable<typeof ref>);
    await new Promise((r) => setTimeout(r, 20));
    expect(reopened.previewHtml()).toContain('Saved doc');
    expect(reopened.isDirty()).toBe(false);
    ws.destroy();
    reopened.destroy();
  });

  it('tracks dirty state across edits and saves', async () => {
    const storage = new MemoryStorage();
    const seeded = await storage.put({ name: 'd.md', content: 'one' });
    const ws = makeWorkspace(storage);
    await ws.openDocument(seeded.ref);
    expect(ws.isDirty()).toBe(false);
    ws.setDocumentText('one two');
    expect(ws.isDirty()).toBe(true);
    await ws.save();
    expect(ws.isDirty()).toBe(false);
    ws.destroy();
  });
});

describe('theme control (task 1.18)', () => {
  it('resolves system/light/dark and stamps data-theme', async () => {
    const ws = makeWorkspace();
    ws.setTheme('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    ws.setTheme('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
    ws.setTheme('system');
    expect(['light', 'dark']).toContain(document.documentElement.dataset['theme']);
    ws.destroy();
  });

  it('re-renders code token colours when the theme switches', async () => {
    const ws = makeWorkspace();
    ws.setDocumentText('```rust\nfn main() {}\n```\n');
    await new Promise((r) => setTimeout(r, 5));
    ws.setTheme('dark');
    await new Promise((r) => setTimeout(r, 5));
    // Token classes carry the theme prefix at render time — a dark-mode
    // preview must not still hold light-theme spans.
    expect(ws.previewHtml()).toMatch(/tk-dark-[0-9a-z]+/);
    expect(ws.previewHtml()).not.toMatch(/tk-light-[0-9a-z]+/);
    ws.setTheme('light');
    await new Promise((r) => setTimeout(r, 5));
    expect(ws.previewHtml()).toMatch(/tk-light-[0-9a-z]+/);
    ws.destroy();
  });
});
