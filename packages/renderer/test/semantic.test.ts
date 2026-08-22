/**
 * NFR-4 — the output must be semantic HTML, not `div` soup.
 *
 * The spec suite checks byte equality against CommonMark. It does not check the
 * property NFR-4 actually cares about: that a screen reader encounters real
 * elements. These do.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { loadNodeEngine } from '@onemark/engine/node';
import { GFM_OPTIONS } from '@onemark/engine';

import { renderToUnsafeHtml } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));

let engine: Awaited<ReturnType<typeof loadNodeEngine>>;

async function html(markdown: string): Promise<string> {
  return renderToUnsafeHtml(await engine.parse(markdown, GFM_OPTIONS));
}

beforeAll(async () => {
  engine = await loadNodeEngine();
});

describe('semantic elements', () => {
  it('renders headings as real heading elements at the right level', async () => {
    expect(await html('# one')).toBe('<h1>one</h1>\n');
    expect(await html('### three')).toBe('<h3>three</h3>\n');
    expect(await html('###### six')).toBe('<h6>six</h6>\n');
  });

  it('renders lists as ul/ol with li children', async () => {
    expect(await html('- a\n- b')).toBe('<ul>\n<li>a</li>\n<li>b</li>\n</ul>\n');
    expect(await html('1. a')).toBe('<ol>\n<li>a</li>\n</ol>\n');
  });

  it('preserves an ordered list that does not start at one', async () => {
    expect(await html('7. seven')).toContain('<ol start="7">');
  });

  it('renders quotes as blockquote and rules as hr', async () => {
    expect(await html('> quoted')).toBe('<blockquote>\n<p>quoted</p>\n</blockquote>\n');
    expect(await html('---')).toBe('<hr />\n');
  });

  it('marks up code blocks with a language class for Shiki to pick up', async () => {
    expect(await html('```rust\nfn f() {}\n```')).toBe(
      '<pre><code class="language-rust">fn f() {}\n</code></pre>\n',
    );
  });

  it('gives images an alt derived from their description', async () => {
    expect(await html('![a cat](/c.png)')).toContain('alt="a cat"');
  });
});

describe('no div soup, across the whole spec corpus', () => {
  it('never emits a div or a presentational span', async () => {
    const cases: { markdown: string }[] = JSON.parse(
      readFileSync(join(here, '../../../fidelity/spec/commonmark-0.31.2.json'), 'utf8'),
    );

    const offenders: string[] = [];
    for (const c of cases) {
      const out = await html(c.markdown);
      // Raw HTML in the *source* legitimately contains divs; those are the
      // document's, not ours, and the sanitiser decides their fate in task 1.3.
      if (c.markdown.includes('<div') || c.markdown.includes('<span')) continue;
      if (/<div\b/.test(out) || /<span\b/.test(out)) offenders.push(c.markdown);
    }

    expect(offenders).toEqual([]);
  });
});

describe('escaping', () => {
  it('escapes text that would otherwise be markup', async () => {
    expect(await html('a < b & c > d')).toBe('<p>a &lt; b &amp; c &gt; d</p>\n');
  });

  it('escapes ampersands inside link destinations', async () => {
    expect(await html('[x](/a?b=1&c=2)')).toContain('href="/a?b=1&amp;c=2"');
  });

  it('escapes quotes in text, matching the reference implementation', async () => {
    expect(await html('say "hi"')).toBe('<p>say &quot;hi&quot;</p>\n');
  });
});
