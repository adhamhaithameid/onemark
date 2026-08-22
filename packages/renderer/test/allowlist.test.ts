// @vitest-environment jsdom
/**
 * **The allowlist must actually be enforced.**
 *
 * This file exists because it once was not. The sanitiser passed `ALLOWED_TAGS`
 * and `ALLOWED_ATTR` *and* `USE_PROFILES`; DOMPurify applies `USE_PROFILES`
 * afterwards and replaces both lists wholesale, so the curated allowlist was
 * inert and DOMPurify's much broader default HTML profile applied instead. The
 * XSS corpus stayed green throughout, because the denylist and DOMPurify's own
 * defaults still caught every scripted vector — the hole was a *policy*
 * failure, not a scripting one, and no scripted test could see it.
 *
 * These assertions are deliberately about elements that are **not dangerous in
 * the XSS sense** but are outside the project's policy. They are the only kind
 * of test that can detect an allowlist quietly ceasing to apply.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import { GFM_OPTIONS, loadNodeEngine } from '@onemark/engine';

import { renderToSafeHtml } from '../src/index.js';
import type { SafeRenderOptions } from '../src/index.js';

let engine: Awaited<ReturnType<typeof loadNodeEngine>>;

beforeAll(async () => {
  engine = await loadNodeEngine();
});

async function safe(markdown: string): Promise<string> {
  return renderToSafeHtml(await engine.parse(markdown, GFM_OPTIONS));
}

function tagsIn(html: string): Set<string> {
  const { window } = new JSDOM(`<!doctype html><body>${html}`);
  return new Set(
    Array.from(window.document.body.querySelectorAll('*')).map((e) => e.tagName.toLowerCase()),
  );
}

function attrsIn(html: string): Set<string> {
  const { window } = new JSDOM(`<!doctype html><body>${html}`);
  const names = new Set<string>();
  for (const el of window.document.body.querySelectorAll('*')) {
    for (const a of Array.from(el.attributes)) names.add(a.name.toLowerCase());
  }
  return names;
}

describe('elements outside the allowlist are removed', () => {
  it.each([
    // Each of these fetches a remote URL and is not an image, so each violates
    // PRD §5.3 — remote images are the *sole* permitted network use.
    ['audio', '<audio controls src="https://evil.example/a.mp3"></audio>'],
    ['video', '<video src="https://evil.example/v.mp4"></video>'],
    ['track', '<video><track src="https://evil.example/t.vtt"></video>'],
    ['source', '<picture><source srcset="https://evil.example/x.png"></picture>'],
    // Not dangerous; simply not in the policy.
    ['marquee', '<marquee>hi</marquee>'],
    ['progress', '<progress value="1"></progress>'],
    ['bdi', '<bdi>x</bdi>'],
    ['meter', '<meter value="1"></meter>'],
    ['canvas', '<canvas></canvas>'],
    ['dialog', '<dialog open>x</dialog>'],
  ])('%s does not survive', async (tag, markdown) => {
    expect(tagsIn(await safe(markdown))).not.toContain(tag);
  });

  it('no remote-fetching element other than img can appear', async () => {
    const html = await safe(
      '<audio src="https://e.example/a"></audio><video src="https://e.example/v"></video>' +
        '<img src="https://e.example/i.png">',
    );
    const tags = tagsIn(html);
    expect(tags.has('img')).toBe(true);
    for (const tag of ['audio', 'video', 'source', 'track', 'iframe', 'embed', 'object']) {
      expect(tags.has(tag)).toBe(false);
    }
  });
});

describe('attributes outside the allowlist are removed', () => {
  it.each([
    ['tabindex', '<p tabindex="3">x</p>'],
    ['download', '<a href="https://x.example/f" download="f.exe">get</a>'],
    ['loading', '<img src="https://x.example/i.png" loading="lazy">'],
    ['style', '<p style="color:red">x</p>'],
    ['name', '<a name="clobber">x</a>'],
    ['target', '<a href="https://x.example" target="_blank">x</a>'],
    ['srcset', '<img src="https://x.example/i.png" srcset="https://e.example/2x.png 2x">'],
    ['ping', '<a href="https://x.example" ping="https://e.example/track">x</a>'],
    ['contenteditable', '<p contenteditable="true">x</p>'],
    ['draggable', '<p draggable="true">x</p>'],
  ])('%s does not survive', async (attr, markdown) => {
    expect(attrsIn(await safe(markdown))).not.toContain(attr);
  });
});

describe('input is restricted to task-list checkboxes', () => {
  it('keeps a disabled checkbox from a task list', async () => {
    const html = await safe('- [x] done\n');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('disabled');
  });

  it.each([
    ['text', '<input type="text" value="x">'],
    ['password', '<input type="password">'],
    ['file', '<input type="file">'],
    ['submit', '<input type="submit" value="go">'],
    ['image', '<input type="image" src="https://e.example/i.png">'],
    ['hidden', '<input type="hidden" name="csrf" value="x">'],
    ['no type', '<input>'],
  ])('removes an input of type %s entirely', async (_type, markdown) => {
    expect(tagsIn(await safe(markdown))).not.toContain('input');
  });
});

describe('what the allowlist must keep, or the product breaks', () => {
  it('keeps every element the renderer emits', async () => {
    const document = [
      '# h1', '', '## h2', '', 'para with **b** _i_ `c` ~~s~~', '',
      '> quote', '', '---', '', '- a', '  - b', '', '1. one', '',
      '```rust', 'fn f() {}', '```', '',
      '| a | b |', '|:--|--:|', '| 1 | 2 |', '',
      '- [x] done', '', 'ref[^f]', '', '[^f]: note', '',
      '[link](https://example.com)', '', '![img](https://example.com/i.png)', '',
      '<details><summary>s</summary>', '', 'inner', '', '</details>', '',
      '<kbd>K</kbd> <abbr title="t">A</abbr> <sup>1</sup> <sub>2</sub>', '',
    ].join('\n');

    const tags = tagsIn(await safe(document));
    for (const required of [
      'h1', 'h2', 'p', 'strong', 'em', 'code', 'del', 'blockquote', 'hr',
      'ul', 'ol', 'li', 'pre', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'input', 'sup', 'section', 'a', 'img', 'details', 'summary', 'kbd', 'abbr', 'sub',
    ]) {
      expect(tags, `missing <${required}>`).toContain(required);
    }
  });

  it('keeps the attributes the render layer depends on', async () => {
    const html = await safe(
      '```rust\nx\n```\n\n| a |\n|:--|\n| 1 |\n\nref[^f]\n\n[^f]: note\n',
    );
    const attrs = attrsIn(html);
    // class carries the code language for Shiki; align carries table columns;
    // id and data-* carry footnote wiring.
    for (const required of ['class', 'align', 'id', 'data-footnotes']) {
      expect(attrs, `missing ${required}`).toContain(required);
    }
  });
});

describe('the safe path cannot be disarmed by its own options', () => {
  it('ignores an attempt to switch the URL policy off', async () => {
    const ast = await engine.parse('[x](javascript:alert(1))', GFM_OPTIONS);

    // The type forbids this; a JavaScript caller, or a cast, does not.
    const html = renderToSafeHtml(ast, { urlPolicy: false } as unknown as SafeRenderOptions);

    expect(html).not.toContain('javascript:');
    expect(html).toContain('<a>');
  });

  it('still sanitises when tagfilter is switched off', async () => {
    // tagfilter is a GFM conformance behaviour and may legitimately be disabled;
    // doing so must not affect the security boundary.
    const ast = await engine.parse('<script>alert(1)</script><img src=x onerror=alert(1)>', GFM_OPTIONS);
    const html = renderToSafeHtml(ast, { tagfilter: false });

    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
  });
});
