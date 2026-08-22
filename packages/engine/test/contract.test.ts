/**
 * Cross-language contract test.
 *
 * The fixtures in `test/fixtures/` are produced by the real Rust engine
 * (`cargo run -p onemark-engine --example dump_fixtures`). These assertions are
 * deliberately the same ones the Rust tests make, expressed against the
 * TypeScript types — if the two halves of the `MarkdownEngine` boundary ever
 * disagree about shape, one of the two suites goes red.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { assertValidAst, find, isValidAst, walk } from '../src/index.js';
import type { MarkdownNode } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));

function fixture(name: string): MarkdownNode {
  const raw = readFileSync(join(here, 'fixtures', `${name}.json`), 'utf8');
  const parsed: unknown = JSON.parse(raw);
  assertValidAst(parsed);
  return parsed;
}

const ALL = [
  'heading',
  'gfm_table',
  'task_list',
  'alert',
  'math',
  'frontmatter',
  'code_block',
  'footnote',
] as const;

describe('the AST contract', () => {
  it.each(ALL)('fixture %s satisfies the contract', (name) => {
    expect(isValidAst(JSON.parse(readFileSync(join(here, 'fixtures', `${name}.json`), 'utf8')))).toEqual([]);
  });

  it('every fixture roots at a document node', () => {
    for (const name of ALL) {
      expect(fixture(name).type).toBe('document');
    }
  });

  it('every node carries a resolvable source position', () => {
    let checked = 0;
    for (const name of ALL) {
      walk(fixture(name), (node) => {
        expect(node.position).toBeDefined();
        const { start, end } = node.position!;
        expect(end.offset).toBeGreaterThanOrEqual(start.offset);
        checked += 1;
      });
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('node shapes the renderer depends on', () => {
  it('headings expose a level', () => {
    const heading = find(fixture('heading'), 'heading');
    expect(heading?.attrs?.['level']).toBe(1);
    expect(find(heading!, 'text')?.literal).toBe('hello');
  });

  it('tables expose alignments and column count', () => {
    const table = find(fixture('gfm_table'), 'table');
    expect(table?.attrs?.['alignments']).toBe('left,right');
    expect(table?.attrs?.['columns']).toBe(2);
  });

  it('task items expose their checked state', () => {
    const list = find(fixture('task_list'), 'list');
    const items = (list?.children ?? []).filter((n) => n.type === 'task_item');
    expect(items.map((i) => i.attrs?.['checked'])).toEqual([true, false]);
  });

  it('alerts arrive typed rather than as blockquotes (OQ-3)', () => {
    const alert = find(fixture('alert'), 'alert');
    expect(alert).toBeDefined();
    expect(alert?.attrs?.['alert_type']).toBe('warning');
  });

  it('math carries its literal untypeset for KaTeX', () => {
    const doc = fixture('math');
    const nodes: MarkdownNode[] = [];
    walk(doc, (n) => { if (n.type === 'math') nodes.push(n); });
    expect(nodes).toHaveLength(2);
    expect(nodes[0]?.attrs?.['display']).toBe(false);
    expect(nodes[0]?.literal).toBe('x^2');
    expect(nodes[1]?.attrs?.['display']).toBe(true);
  });

  it('code blocks expose the language for Shiki', () => {
    const code = find(fixture('code_block'), 'code_block');
    expect(code?.attrs?.['lang']).toBe('rust');
    expect(code?.literal).toBe('fn main() {}\n');
  });

  it('frontmatter is its own node, not a thematic break', () => {
    expect(find(fixture('frontmatter'), 'frontmatter')?.literal).toContain('title: hi');
  });

  it('footnotes link definition to reference by name', () => {
    const doc = fixture('footnote');
    expect(find(doc, 'footnote_reference')?.attrs?.['name']).toBe('a');
    expect(find(doc, 'footnote_definition')?.attrs?.['name']).toBe('a');
  });
});

describe('the validator actually rejects bad shapes', () => {
  it('rejects a node without a type', () => {
    expect(isValidAst({ children: [] })).not.toEqual([]);
  });

  it('rejects an empty children array', () => {
    const problems = isValidAst({ type: 'document', children: [] });
    expect(problems.map((p) => p.message)).toContain('must be omitted rather than empty');
  });

  it('rejects an attr that is not a scalar', () => {
    const problems = isValidAst({ type: 'heading', attrs: { level: { nested: true } } });
    expect(problems[0]?.path).toBe('$.attrs.level');
  });

  it('rejects a malformed position', () => {
    const problems = isValidAst({ type: 'text', position: { start: { line: 1 }, end: {} } });
    expect(problems.length).toBeGreaterThan(0);
  });
});
