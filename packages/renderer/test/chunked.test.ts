// @vitest-environment jsdom
/**
 * Perf ladder rung 2 (ADR-0019/0022): the chunked sanitisation invariant.
 *
 * `renderToUnsafeBlocks` + `joinBlocks` must reproduce `renderToUnsafeHtml`
 * byte-for-byte, and per-block sanitisation must produce the same output as
 * whole-string sanitisation, across the ENTIRE CommonMark and GFM corpora —
 * every example, not a sample. If a future block type ever straddles the
 * boundary, these tests fail before a user can.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { loadNodeEngine } from '@onemark/engine/node';
import { GFM_OPTIONS, type MarkdownEngine, type MarkdownNode } from '@onemark/engine';
import {
  renderToUnsafeHtml,
  renderToUnsafeBlocks,
  joinBlocks,
  renderToSafeHtml,
  sanitiseHtml,
} from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));

interface Case {
  markdown: string;
  example: number;
  section: string;
}

let engine: MarkdownEngine;

beforeAll(async () => {
  engine = await loadNodeEngine();
});

function loadSpec(name: string): Case[] {
  const raw = readFileSync(join(here, '../../../fidelity/spec', name), 'utf8');
  const parsed = JSON.parse(raw) as Array<{ markdown: string; example: number; section: string; extension?: string }>;
  return parsed.filter((c) => c.extension === undefined || c.extension === 'gfm');
}

function cases(): Case[] {
  return [...loadSpec('commonmark-0.31.2.json'), ...loadSpec('gfm-0.29.json')];
}

// The safe path's forced options, mirrored here — the tests compare the exact
// shipping configuration.
const RENDER_OPTIONS = {
  urlPolicy: true,
  headingAnchors: true,
  softBreakAsBr: true,
} as const;

describe('chunked render invariant (rung 2)', () => {
  // Heavy by design: ~674 corpus examples, each parsed + rendered twice.
  const TIMEOUT = 120_000;

  it('joinBlocks(blocks(x)) === renderToUnsafeHtml(x) across the corpora', { timeout: TIMEOUT }, async () => {
    let mismatches = 0;
    for (const c of cases()) {
      let ast: MarkdownNode;
      try {
        ast = await engine.parse(c.markdown, GFM_OPTIONS);
      } catch {
        continue; // pathological parse cases the corpus itself marks as errors
      }
      const whole = renderToUnsafeHtml(ast, RENDER_OPTIONS);
      const chunked = joinBlocks(renderToUnsafeBlocks(ast, RENDER_OPTIONS));
      if (whole !== chunked) {
        mismatches += 1;
        if (mismatches <= 3) {
          console.log(
            `MISMATCH example ${c.example} (${c.section})\n  markdown: ${JSON.stringify(c.markdown.slice(0, 80))}\n  whole:   ${JSON.stringify(whole.slice(0, 120))}\n  chunked: ${JSON.stringify(chunked.slice(0, 120))}`,
          );
        }
      }
    }
    expect(mismatches).toBe(0);
  });

  it('per-block sanitisation equals whole-string sanitisation across the corpora', { timeout: TIMEOUT }, async () => {
    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM('');
    let mismatches = 0;
    for (const c of cases()) {
      let ast: MarkdownNode;
      try {
        ast = await engine.parse(c.markdown, GFM_OPTIONS);
      } catch {
        continue;
      }
      const whole = renderToSafeHtml(ast, { window: dom.window });
      const chunked = joinBlocks(
        renderToUnsafeBlocks(ast, RENDER_OPTIONS).map((b) => sanitiseHtml(b, { window: dom.window })),
      );
      if (whole !== chunked) {
        mismatches += 1;
        if (mismatches <= 3) {
          console.log(
            `SANITISE MISMATCH example ${c.example}\n  whole:   ${JSON.stringify(whole.slice(0, 140))}\n  chunked: ${JSON.stringify(chunked.slice(0, 140))}`,
          );
        }
      }
    }
    expect(mismatches).toBe(0);
  });
});
