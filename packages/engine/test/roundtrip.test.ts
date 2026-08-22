/**
 * **Task M0.3 — the architecture gate.**
 *
 * The build plan calls this "the whole architecture in one step": a markdown
 * string goes from TypeScript into WebAssembly, comes back as a typed AST, and
 * is still the same AST the native engine produces.
 *
 * That last clause is the one that matters. One parser shipped everywhere
 * (ADR-0003) is only true if the WASM build and the native build agree, so these
 * tests compare WASM output against fixtures the *native* engine emitted.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { loadNodeEngine } from '../src/wasm-engine.js';
import { GFM_OPTIONS, find, walk } from '../src/index.js';
import type { MarkdownNode, WasmMarkdownEngine } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));

function nativeFixture(name: string): MarkdownNode {
  return JSON.parse(readFileSync(join(here, 'fixtures', `${name}.json`), 'utf8')) as MarkdownNode;
}

function fixtureSources(): { name: string; source: string }[] {
  return JSON.parse(readFileSync(join(here, 'fixtures', 'manifest.json'), 'utf8'));
}

let engine: WasmMarkdownEngine;

beforeAll(async () => {
  engine = await loadNodeEngine();
});

describe('M0.3 — the WASM round-trip', () => {
  it('identifies itself as the WASM build', () => {
    expect(engine.id).toBe('comrak-wasm');
    expect(engine.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('takes a markdown string and returns a typed AST', async () => {
    const ast = await engine.parse('# hello', GFM_OPTIONS);

    expect(ast.type).toBe('document');
    const heading = find(ast, 'heading');
    expect(heading?.attrs?.['level']).toBe(1);
    expect(find(heading!, 'text')?.literal).toBe('hello');
  });

  it('rejects a dialect it does not implement', async () => {
    await expect(
      engine.parse('# x', { ...GFM_OPTIONS, dialect: 'obsidian' as 'gfm' }),
    ).rejects.toThrow(/GFM only/);
  });
});

describe('NFR-6 — the WASM build agrees with the native build', () => {
  it.each(fixtureSources())('$name is byte-identical across builds', async ({ name, source }) => {
    const fromWasm = await engine.parse(source, GFM_OPTIONS);
    const fromNative = nativeFixture(name);

    // Byte-identical, not merely equivalent: NFR-6 is a determinism guarantee,
    // and key ordering is part of it.
    expect(JSON.stringify(fromWasm)).toBe(JSON.stringify(fromNative));
  });
});

describe('the AST is usable for what M1 needs', () => {
  it('carries positions that index the real source, for scroll-sync', async () => {
    const source = '# one\n\nsecond para\n';
    const ast = await engine.parse(source, GFM_OPTIONS);

    const para = find(ast, 'paragraph')!;
    const { offset } = para.position!.start;
    expect(source.slice(offset, offset + 6)).toBe('second');
  });

  it('surfaces every node type the renderer must handle', async () => {
    const source = [
      '---', 'title: t', '---', '',
      '# h', '', '> [!TIP]', '> tip body', '',
      '| a | b |', '|:--|--:|', '| 1 | 2 |', '',
      '- [x] done', '', '```js', 'const x = 1;', '```', '',
      'text[^f] and $x^2$', '', '[^f]: note', '',
    ].join('\n');

    const ast = await engine.parse(source, GFM_OPTIONS);
    const seen = new Set<string>();
    walk(ast, (n) => seen.add(n.type));

    for (const required of [
      'frontmatter', 'heading', 'alert', 'table', 'table_row', 'table_cell',
      'list', 'task_item', 'code_block', 'footnote_reference',
      'footnote_definition', 'math',
    ]) {
      expect(seen, `missing ${required}`).toContain(required);
    }
  });
});
