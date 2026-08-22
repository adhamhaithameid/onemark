/**
 * **Robustness against hostile and pathological documents.**
 *
 * A markdown viewer opens files it did not write. Nesting depth, document size
 * and malformedness are all attacker-controlled, so "does not crash" is a
 * security property here, not a nicety.
 *
 * These exist because of a real defect. `convert()` in `onemark-engine` was
 * recursive over AST depth. A native 8 MB stack absorbed that; the wasm32 stack
 * is 1 MB, and `"*".repeat(5000)` — which produces a tree ~2500 deep — trapped
 * with `memory access out of bounds`. A wasm trap is not a catchable error at
 * the module level: the instance was left **permanently unusable**, so every
 * later parse in the session failed, including `# hello`. One pathological
 * document killed the renderer until reload.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import { loadNodeEngine } from '../src/wasm-engine.js';
import { GFM_OPTIONS, find, walk } from '../src/index.js';
import type { MarkdownNode } from '../src/index.js';

let engine: Awaited<ReturnType<typeof loadNodeEngine>>;

beforeAll(async () => {
  engine = await loadNodeEngine();
});

function depthOf(node: MarkdownNode): number {
  // Iterative on purpose: a recursive measurement of a deep tree would fail for
  // the same reason the code under test used to.
  let max = 0;
  const stack: [MarkdownNode, number][] = [[node, 1]];
  while (stack.length > 0) {
    const [n, d] = stack.pop()!;
    if (d > max) max = d;
    for (const c of n.children ?? []) stack.push([c, d + 1]);
  }
  return max;
}

const PATHOLOGICAL: [string, () => string][] = [
  ['5000 nested blockquotes', () => '>'.repeat(5000) + ' x'],
  ['50000 nested blockquotes', () => '>'.repeat(50000) + ' x'],
  ['5000 nested emphasis', () => '*'.repeat(5000) + 'x' + '*'.repeat(5000)],
  ['2000 nested list items', () =>
    Array.from({ length: 2000 }, (_, i) => ' '.repeat(i * 2) + '- x').join('\n')],
  ['10000 nested brackets', () => '['.repeat(10000) + 'x' + ']'.repeat(10000)],
  ['2000 column table', () => '|' + 'a|'.repeat(2000) + '\n|' + '-|'.repeat(2000) + '\n'],
];

const MALFORMED: [string, string][] = [
  ['empty', ''],
  ['whitespace only', '   \n\n\t  '],
  ['lone surrogate', 'a\uD800b'],
  ['null character', 'a\u0000b'],
  ['byte order mark', '\uFEFF# heading'],
  ['bidi override', 'a\u202Eb'],
  ['unclosed code fence', '```rust\nfn f() {'],
  ['unclosed html', '<div><span><p>'],
  ['broken entities', '&#xZZZZ; &#99999999999; &notanentity;'],
  ['replacement character', 'caf\u00e9\uFFFD'],
  ['only delimiters', '*_~`|>#-'],
];

describe('pathological nesting is survivable', () => {
  it.each(PATHOLOGICAL)('%s parses without trapping', async (_label, make) => {
    const ast = await engine.parse(make(), GFM_OPTIONS);
    expect(ast.type).toBe('document');
  }, 60_000);

  it('caps depth and says so, rather than dropping content silently', async () => {
    const ast = await engine.parse('>'.repeat(5000) + ' x', GFM_OPTIONS);

    // The cap is the engine's MAX_DEPTH. The exact number is an implementation
    // detail; that it is bounded, and that the boundary is marked, is not.
    expect(depthOf(ast)).toBeLessThan(1000);
    expect(find(ast, 'truncated')).toBeDefined();
  }, 60_000);

  it('leaves normal depth completely untouched', async () => {
    const ast = await engine.parse('> a\n\n- b\n  - c\n\n**d**\n', GFM_OPTIONS);
    let truncated = 0;
    walk(ast, (n) => { if (n.type === 'truncated') truncated += 1; });
    expect(truncated).toBe(0);
  });
});

describe('malformed input fails safely', () => {
  it.each(MALFORMED)('%s produces a valid AST', async (_label, markdown) => {
    const ast = await engine.parse(markdown, GFM_OPTIONS);
    expect(ast.type).toBe('document');
  });
});

describe('large documents', () => {
  it('handles a 5 MB paragraph', async () => {
    const ast = await engine.parse('lorem ipsum '.repeat(450_000), GFM_OPTIONS);
    expect(ast.type).toBe('document');
  }, 120_000);

  it('handles fifty thousand links', async () => {
    const ast = await engine.parse('[a](b) '.repeat(50_000), GFM_OPTIONS);
    expect(ast.type).toBe('document');
  }, 120_000);
});

describe('the engine survives what it has already survived', () => {
  it('still works after every pathological document in this file', async () => {
    // The regression that motivated all of the above: a trap left the module
    // permanently dead. Parsing something trivial afterwards is the assertion
    // that actually catches it.
    for (const [, make] of PATHOLOGICAL) {
      await engine.parse(make(), GFM_OPTIONS);
    }
    for (const [, markdown] of MALFORMED) {
      await engine.parse(markdown, GFM_OPTIONS);
    }

    const ast = await engine.parse('# hello', GFM_OPTIONS);
    expect(find(ast, 'heading')?.attrs?.['level']).toBe(1);
    expect(find(ast, 'text')?.literal).toBe('hello');
  }, 300_000);
});
