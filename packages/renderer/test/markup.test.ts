// @vitest-environment jsdom
/**
 * Task 1.8 — GitHub alerts markup, heading anchors, emoji shortcodes,
 * frontmatter display. All output must survive the sanitiser unchanged
 * (renderToSafeHtml === renderToUnsafeHtml here), because every construct is
 * generated from typed AST nodes, never from raw document HTML.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { loadNodeEngine } from '@onemark/engine/node';
import { GFM_OPTIONS, type MarkdownEngine } from '@onemark/engine';
import { renderToSafeHtml, renderToUnsafeHtml } from '../src/index.js';

let engine: MarkdownEngine;

beforeAll(async () => {
  engine = await loadNodeEngine();
});

describe('GitHub alert markup (task 1.8)', () => {
  const CASES: [string, string][] = [
    ['[!NOTE]', 'note'],
    ['[!TIP]', 'tip'],
    ['[!IMPORTANT]', 'important'],
    ['[!WARNING]', 'warning'],
    ['[!CAUTION]', 'caution'],
  ];

  for (const [marker, kind] of CASES) {
    it(`renders a ${kind} alert as GitHub's div structure`, async () => {
      const ast = await engine.parse(`> ${marker}\n> Body line\n`, GFM_OPTIONS);
      const html = renderToSafeHtml(ast);
      expect(html).toContain(`<div class="markdown-alert markdown-alert-${kind}">`);
      expect(html).toMatch(new RegExp(`<p class="markdown-alert-title">${kind.charAt(0).toUpperCase() + kind.slice(1)}</p>`));
      expect(html).toContain('Body line');
      expect(html).not.toContain('<blockquote>');
    });
  }

  it('keeps a plain blockquote a blockquote', async () => {
    const ast = await engine.parse('> just quoting\n', GFM_OPTIONS);
    expect(renderToSafeHtml(ast)).toContain('<blockquote>');
    expect(renderToSafeHtml(ast)).not.toContain('markdown-alert');
  });
});

describe('heading anchors (task 1.8)', () => {
  it('adds the user-content id and an anchor link', async () => {
    const ast = await engine.parse('## Install & Setup!\n', GFM_OPTIONS);
    const html = renderToSafeHtml(ast);
    expect(html).toContain('<h2 id="user-content-install--setup">');
    expect(html).toContain('<a class="anchor" href="#install--setup" aria-hidden="true">');
    expect(html).toContain('Install &amp; Setup!');
  });

  it('deduplicates repeated slugs', async () => {
    const ast = await engine.parse('## Same\n\n## Same\n', GFM_OPTIONS);
    const html = renderToSafeHtml(ast);
    expect(html).toContain('id="user-content-same"');
    expect(html).toContain('id="user-content-same-1"');
  });

  it('leaves headings alone when anchors are off', async () => {
    const ast = await engine.parse('## Plain\n', GFM_OPTIONS);
    const html = renderToUnsafeHtml(ast, { headingAnchors: false });
    expect(html).toBe('<h2>Plain</h2>\n');
  });
});

describe('emoji shortcodes (task 1.8)', () => {
  it('replaces known shortcodes', async () => {
    const ast = await engine.parse('Ship it :tada:\n', GFM_OPTIONS);
    expect(renderToSafeHtml(ast)).toContain('🎉');
  });

  it('leaves unknown shortcodes verbatim', async () => {
    const ast = await engine.parse(':not-an-emoji:\n', GFM_OPTIONS);
    expect(renderToSafeHtml(ast)).toContain(':not-an-emoji:');
  });

  it('does not replace inside code', async () => {
    const ast = await engine.parse('`:tada:`\n', GFM_OPTIONS);
    expect(renderToSafeHtml(ast)).toContain('<code>:tada:</code>');
  });
});

describe('frontmatter display (task 1.8)', () => {
  it('renders top-level keys as a GitHub-style table', async () => {
    const ast = await engine.parse('---\ntitle: Hello\nauthor: Adham\n---\n\nBody\n', GFM_OPTIONS);
    const html = renderToSafeHtml(ast);
    expect(html).toContain('<table');
    expect(html).toContain('<th>title</th>');
    expect(html).toContain('<td>Hello</td>');
    expect(html).toContain('Body');
  });

  it('falls back to a pre block for non-flat frontmatter', async () => {
    const ast = await engine.parse('---\nnested:\n  key: value\n---\n\nBody\n', GFM_OPTIONS);
    const html = renderToSafeHtml(ast);
    expect(html).toContain('<pre');
    expect(html).toContain('nested:');
  });
});
