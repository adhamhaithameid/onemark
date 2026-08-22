// @vitest-environment jsdom
/**
 * Task 1.7 — Mermaid diagrams, `securityLevel: 'strict'`, bundled.
 *
 * The renderer emits an inert `<div class="onemark-mermaid">` carrying the
 * diagram source as escaped text — exactly what GitHub's static HTML does
 * before its client-side mermaid run. Hydration into SVG is a browser concern:
 * `configureMermaid()` wires the bundled mermaid with the security level NFR-2
 * mandates, and the real-browser test (`mermaid-browser.test.ts`, opt-in)
 * proves a diagram renders offline.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { loadNodeEngine, GFM_OPTIONS, type MarkdownEngine } from '@onemark/engine';
import { renderToSafeHtml, renderToUnsafeHtml } from '../src/index.js';

let engine: MarkdownEngine;

beforeAll(async () => {
  engine = await loadNodeEngine();
});

const DIAGRAM = 'graph TD\nA[One] -->|label| B{Two}\nB --> C[Three]\n';

describe('mermaid placeholders (task 1.7)', () => {
  it('emits an inert placeholder div for ```mermaid fences', async () => {
    const ast = await engine.parse('```mermaid\n' + DIAGRAM + '```\n', GFM_OPTIONS);
    const html = renderToSafeHtml(ast);
    expect(html).toContain('<div class="onemark-mermaid">');
    expect(html).toContain('A[One] --&gt;|label| B{Two}');
    expect(html).not.toContain('<svg');
  });

  it('escapes hostile-looking diagram source', async () => {
    const ast = await engine.parse('```mermaid\nA --> "<img src=x onerror=alert(1)>"\n```\n', GFM_OPTIONS);
    const html = renderToSafeHtml(ast);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('survives sanitisation unchanged (class + text are allowlisted)', async () => {
    const ast = await engine.parse('```mermaid\n' + DIAGRAM + '```\n', GFM_OPTIONS);
    expect(renderToSafeHtml(ast)).toBe(renderToUnsafeHtml(ast));
  });

  it('leaves ordinary code fences alone', async () => {
    const ast = await engine.parse('```text\ngraph TD\n```\n', GFM_OPTIONS);
    const html = renderToSafeHtml(ast);
    expect(html).not.toContain('onemark-mermaid');
    expect(html).toContain('<pre><code class="language-text">');
  });
});
