// @vitest-environment jsdom
/**
 * **NFR-2 — the security gate.**
 *
 * Every vector in `fidelity/xss/corpus.json` is rendered through the *shipping*
 * path and the result is inspected structurally, by parsing it, rather than by
 * grepping for strings. String matching on sanitiser output is how sanitisers
 * get shipped broken: it cannot see an `onerror` the parser reconstructed.
 *
 * **Scope of this gate, stated honestly.** jsdom is not a browser. Mutation-XSS
 * lives precisely in the gap between a sanitiser's parse and a *real* browser's
 * re-parse, so passing here is necessary and not sufficient. A Playwright pass
 * against the shipped build is the missing half, and belongs with the M1 E2E
 * work at task 1.22.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';
import { beforeAll, describe, expect, it } from 'vitest';

import { GFM_OPTIONS, loadNodeEngine } from '@onemark/engine';

import { renderToSafeHtml } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));

interface Vector { name: string; markdown: string }

const FORBIDDEN_ELEMENTS = [
  // script execution and navigation control
  'script', 'iframe', 'object', 'embed', 'form', 'base', 'meta',
  'link', 'style', 'noscript', 'template', 'frame', 'frameset',
  // remote fetches that are not images. PRD §5.3 makes remote *images* the sole
  // permitted network use, so any of these surviving is an egress channel the
  // document was never granted.
  'audio', 'video', 'source', 'track', 'marquee', 'portal',
];

/** Attributes that leak, navigate, or fetch, independent of their value. */
const FORBIDDEN_ATTRIBUTES = ['srcdoc', 'ping', 'srcset', 'download', 'target', 'formaction', 'action', 'style'];

const URL_ATTRIBUTES = ['href', 'src', 'action', 'formaction', 'data', 'xlink:href', 'srcdoc', 'background'];

/** Schemes that must never survive sanitisation, in any attribute. */
const DANGEROUS_SCHEME = /^\s*(javascript|vbscript|data|file|blob)\s*:/i;

let engine: Awaited<ReturnType<typeof loadNodeEngine>>;
let vectors: Vector[];

beforeAll(async () => {
  engine = await loadNodeEngine();
  vectors = JSON.parse(readFileSync(join(here, '../../../fidelity/xss/corpus.json'), 'utf8'));
});

async function safeHtml(markdown: string): Promise<string> {
  return renderToSafeHtml(await engine.parse(markdown, GFM_OPTIONS));
}

/** Every way a fragment violates NFR-2. Empty means clean. */
function violations(html: string): string[] {
  const found: string[] = [];
  const { window } = new JSDOM(`<!doctype html><body>${html}`);
  const all = window.document.body.querySelectorAll('*');

  for (const element of all) {
    const tag = element.tagName.toLowerCase();
    if (FORBIDDEN_ELEMENTS.includes(tag)) found.push(`element <${tag}>`);

    for (const attr of Array.from(element.attributes)) {
      const name = attr.name.toLowerCase();

      if (name.startsWith('on')) found.push(`event handler ${name} on <${tag}>`);
      if (FORBIDDEN_ATTRIBUTES.includes(name)) found.push(`${name} on <${tag}>`);

      if (URL_ATTRIBUTES.includes(name) && DANGEROUS_SCHEME.test(attr.value)) {
        // `data:` on an image is the one permitted exception (tech spec §6).
        // Only raster data images are permitted on an `img`. `image/svg+xml` is
        // excluded on purpose: an SVG is a document that can carry script.
        const isPermittedImageData =
          tag === 'img' &&
          name === 'src' &&
          /^\s*data:image\/(png|jpeg|jpg|gif|webp|avif)[;,]/i.test(attr.value);
        if (!isPermittedImageData) found.push(`${name}="${attr.value.slice(0, 40)}" on <${tag}>`);
      }
    }
  }
  return found;
}

describe('NFR-2 — the XSS corpus is fully blocked', () => {
  it('every vector renders to something inert', async () => {
    const surviving: { name: string; problems: string[]; html: string }[] = [];

    for (const vector of vectors) {
      const html = await safeHtml(vector.markdown);
      const problems = violations(html);
      if (problems.length > 0) surviving.push({ name: vector.name, problems, html });
    }

    if (surviving.length > 0) {
      console.log(`\n${surviving.length}/${vectors.length} vectors survived sanitisation:`);
      for (const s of surviving) {
        console.log(`  ${s.name}`);
        for (const p of s.problems) console.log(`      ${p}`);
        console.log(`      output: ${JSON.stringify(s.html.slice(0, 120))}`);
      }
    } else {
      console.log(`\nall ${vectors.length} XSS vectors blocked`);
    }

    expect(surviving.map((s) => s.name)).toEqual([]);
  });

  it('the violation detector actually detects, so a green run means something', () => {
    // A sanitiser test that cannot fail is worthless. Prove the detector bites.
    expect(violations('<img src=x onerror="alert(1)">')).not.toEqual([]);
    expect(violations('<a href="javascript:alert(1)">x</a>')).not.toEqual([]);
    expect(violations('<script>alert(1)</script>')).not.toEqual([]);
    expect(violations('<audio src="https://e.example/a.mp3"></audio>')).not.toEqual([]);
    expect(violations('<img src="data:image/svg+xml,x">')).not.toEqual([]);
    expect(violations('<a href="https://x" ping="https://e.example">x</a>')).not.toEqual([]);
    expect(violations('<p>harmless</p>')).toEqual([]);
    expect(violations('<img src="https://ok.example/i.png" alt="a">')).toEqual([]);
  });
});

describe('the sanitiser is load-bearing, not decorative', () => {
  it('the same corpus DOES get through the unsanitised path', async () => {
    // Without this, a sanitiser that silently became a no-op would still show a
    // green suite — the parser alone neutralises some vectors, and that
    // coincidence would be mistaken for protection. This asserts the gap between
    // the two paths is real and large.
    const { renderToUnsafeHtml } = await import('../src/index.js');

    let survivedUnsanitised = 0;
    for (const vector of vectors) {
      const ast = await engine.parse(vector.markdown, GFM_OPTIONS);
      const raw = renderToUnsafeHtml(ast, { tagfilter: false, urlPolicy: false });
      if (violations(raw).length > 0) survivedUnsanitised += 1;
    }

    console.log(`\n${survivedUnsanitised}/${vectors.length} vectors are live without sanitisation`);
    // The exact count is not the point; that it is substantial is.
    expect(survivedUnsanitised).toBeGreaterThan(20);
  });
});

describe('the sanitiser does not destroy the document', () => {
  it('keeps ordinary formatting intact', async () => {
    const html = await safeHtml('# Title\n\nSome **bold** and `code` and a [link](https://example.com).\n');
    // Task 1.8: the safe path adds GitHub-style heading anchors by default.
    expect(html).toContain('<h1 id="user-content-title"><a class="anchor" href="#title" aria-hidden="true"></a>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('href="https://example.com"');
  });

  it('keeps GFM structures intact', async () => {
    const html = await safeHtml('| a | b |\n|:--|--:|\n| 1 | 2 |\n\n- [x] done\n\n~~gone~~\n');
    expect(html).toContain('<table>');
    expect(html).toContain('<th align="left">a</th>');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('<del>gone</del>');
  });

  it('keeps remote images, the one permitted network use', async () => {
    const html = await safeHtml('![cat](https://example.com/cat.png)');
    expect(html).toContain('src="https://example.com/cat.png"');
    expect(html).toContain('alt="cat"');
  });

  it('keeps a code fence language class for Shiki', async () => {
    expect(await safeHtml('```rust\nfn f() {}\n```')).toContain('class="language-rust"');
  });

  it('keeps benign inline HTML that GitHub also keeps', async () => {
    const html = await safeHtml('<details><summary>more</summary>\n\nhidden\n\n</details>');
    expect(html).toContain('<details>');
    expect(html).toContain('<summary>more</summary>');
  });
});
