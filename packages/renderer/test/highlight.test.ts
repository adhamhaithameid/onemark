// @vitest-environment jsdom
/**
 * Task 1.5 — Shiki syntax highlighting, bundled.
 *
 * Verify column: zero network requests during render. The adapter bundles its
 * grammars and themes statically; the assertions below check the rendered HTML
 * carries real token colours, keeps the `language-*` class GitHub's CSS keys on,
 * and contains nothing that could reach the network.
 *
 * The renderer stays synchronous and shiki-free by contract: callers hand in an
 * initialised adapter (`createSyntaxHighlighter()`), so the engine's byte-exact
 * conformance output is untouched unless highlighting is explicitly requested.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { loadNodeEngine, GFM_OPTIONS, type MarkdownEngine } from '@onemark/engine';
import { renderToSafeHtml } from '../src/index.js';
import { createSyntaxHighlighter, type SyntaxHighlighter } from '../src/highlight.js';

let engine: MarkdownEngine;
let highlighter: SyntaxHighlighter;

beforeAll(async () => {
  engine = await loadNodeEngine();
  highlighter = await createSyntaxHighlighter();
});

const RUST_SNIPPET = 'pub const MAX_DEPTH: usize = 400;\nfn f() -> bool { true }\n';

describe('bundled syntax highlighting (task 1.5)', () => {
  it('emits token spans with tk-* classes for a bundled language, surviving the sanitiser', async () => {
    const ast = await engine.parse('```rust\n' + RUST_SNIPPET + '```\n', GFM_OPTIONS);
    const html = renderToSafeHtml(ast, { highlighter });
    expect(html).toContain('<pre><code class="language-rust">');
    expect(html).toMatch(/<span class="tk-light-[0-9a-z]+">MAX_DEPTH<\/span>/);
  });

  it('ships matching CSS rules per theme, colours differing', async () => {
    const light = highlighter.css('light');
    const dark = highlighter.css('dark');
    expect(light).toMatch(/^\.tk-light-[0-9a-z]+ \{ color: #[0-9A-Fa-f]{3,8}; \}$/m);
    expect(dark).toMatch(/^\.tk-dark-[0-9a-z]+ \{ color: #[0-9A-Fa-f]{3,8}; \}$/m);
    expect(light).not.toBe(dark);
  });

  it('falls back to plain escaping for an unknown language', async () => {
    const src = '```not-a-language\nx < y && "z"\n```\n';
    const ast = await engine.parse(src, GFM_OPTIONS);
    const highlighted = renderToSafeHtml(ast, { highlighter });
    const plain = renderToSafeHtml(ast);
    expect(highlighted).toBe(plain);
    expect(highlighted).toContain('<pre><code class="language-not-a-language">');
  });

  it('leaves conformance output untouched when no highlighter is passed', async () => {
    const ast = await engine.parse('```rust\n' + RUST_SNIPPET + '```\n', GFM_OPTIONS);
    expect(renderToSafeHtml(ast)).toBe(
      '<pre><code class="language-rust">pub const MAX_DEPTH: usize = 400;\nfn f() -&gt; bool { true }\n</code></pre>\n',
    );
  });

  it('never emits a network reference (M2)', async () => {
    const ast = await engine.parse('```ts\nconst s: string = "hi";\n```\n', GFM_OPTIONS);
    const html = renderToSafeHtml(ast, { highlighter });
    expect(html).not.toMatch(/https?:\/\//);
  });
});
