/**
 * Footnote rendering.
 *
 * The GFM spec has no footnote examples — GitHub added them years after 0.29 —
 * so M4 cannot gate them. Instead these compare against **comrak's own HTML
 * formatter**, reached through the WASM boundary's design-B entry point. That is
 * the "reference engine" oracle from tech spec §8, level 3, used in-process:
 * comrak is cmark-gfm-compatible and is the closest available proxy for GitHub
 * until the golden corpus (M5) can arbitrate directly.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import { loadNodeEngine } from '@onemark/engine/node';
import { GFM_OPTIONS } from '@onemark/engine';

import { renderToUnsafeHtml } from '../src/index.js';

let engine: Awaited<ReturnType<typeof loadNodeEngine>>;

/** OneMark's render path: engine → AST → our renderer. */
async function ours(markdown: string): Promise<string> {
  return renderToUnsafeHtml(await engine.parse(markdown, GFM_OPTIONS), { tagfilter: false, urlPolicy: false });
}

/** The oracle: comrak parses *and* renders, entirely inside Rust. */
async function oracle(markdown: string): Promise<string> {
  return engine.renderToUnsafeHtml(markdown, GFM_OPTIONS);
}

beforeAll(async () => {
  engine = await loadNodeEngine();
});

describe('footnotes match the reference engine', () => {
  it.each([
    ['a single footnote', 'text[^a]\n\n[^a]: the note\n'],
    ['two footnotes', 'one[^a] two[^b]\n\n[^a]: first\n\n[^b]: second\n'],
    ['a footnote containing inline markup', 'x[^n]\n\n[^n]: see **bold** and `code`\n'],
    ['a footnote defined before its reference', '[^z]: defined first\n\ntext[^z]\n'],
  ])('%s', async (_label, markdown) => {
    expect(await ours(markdown)).toBe(await oracle(markdown));
  });

  it('places the backref inside the last paragraph, on the same line', async () => {
    const html = await ours('text[^a]\n\n[^a]: the note\n');
    expect(html).toContain('the note <a href="#fnref-a" class="footnote-backref"');
    expect(html).toContain('aria-label="Back to reference 1">↩</a></p>');
  });

  it('collects definitions into one trailing section regardless of source order', async () => {
    const html = await ours('[^z]: defined first\n\ntext[^z]\n');
    expect(html.indexOf('<section class="footnotes"')).toBeGreaterThan(html.indexOf('<p>text'));
  });
});

describe('a known divergence, documented rather than hidden', () => {
  it('emits one backref for a footnote referenced twice, where GitHub emits two', async () => {
    const markdown = 'one[^a] and again[^a]\n\n[^a]: the note\n';
    const mine = await ours(markdown);
    const reference = await oracle(markdown);

    const count = (html: string): number =>
      (html.match(/class="footnote-backref"/g) ?? []).length;

    expect(count(mine)).toBe(1);
    expect(count(reference)).toBe(2);

    // The gap is the per-reference index, which the AST does not carry yet.
    // Recorded here so the divergence is a tracked fact, not a surprise at M5.
    expect(mine).not.toBe(reference);
  });
});
