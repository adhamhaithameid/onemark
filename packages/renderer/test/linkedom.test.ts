// @vitest-environment node
/**
 * The render worker's DOM problem (ADR-0022): DOMPurify needs a complete DOM.
 * - linkedom: reports no support → the sanitiser must FAIL CLOSED (throw),
 *   never silently pass hostile content through.
 * - happy-dom: reports support but its parser mishandles sanitisation → the
 *   output invariant check must catch the executable residue and throw.
 * Either way, a partial DOM can never reach the page as "sanitised" HTML.
 * The worker path (perf ladder rung 1) therefore keeps sanitisation on a
 * complete DOM; this file guards that decision forever.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { parseHTML } from 'linkedom';
import { Window as HappyWindow } from 'happy-dom';

import { loadNodeEngine } from '@onemark/engine/node';
import { GFM_OPTIONS, type MarkdownEngine } from '@onemark/engine';
import { renderToSafeHtml } from '../src/index.js';

let engine: MarkdownEngine;

beforeAll(async () => {
  engine = await loadNodeEngine();
});

const HOSTILE = [
  '# Title',
  '',
  '<img src=x onerror="alert(1)">',
  '<script>alert(2)</script>',
  '[link](javascript:alert(3))',
  '',
  'Real **content** with a [safe link](https://example.com).',
].join('\n');

async function renderWith(makeWindow: () => { window: unknown }): Promise<string> {
  const ast = await engine.parse(HOSTILE, GFM_OPTIONS);
  const { window } = makeWindow() as { window: unknown };
  return renderToSafeHtml(ast, { window: window as never });
}

describe('fail-closed sanitisation on partial DOMs (ADR-0022)', () => {
  it('linkedom: renderToSafeHtml throws instead of emitting unsanitised HTML', async () => {
    await expect(renderWith(() => parseHTML('<!doctype html><html><body></body></html>') as never)).rejects.toThrow(
      /sanitis/i,
    );
  });

  it('happy-dom: renderToSafeHtml refuses the host outright (parser leaks residue)', async () => {
    // Guard-test history: happy-dom first passed whole-string residue, then —
    // under chunked sanitisation — emitted a `javascript:` string past the
    // DOM-walk in an encoded form. An uncertifiable host is refused by name.
    await expect(renderWith(() => ({ window: new HappyWindow() }))).rejects.toThrow(
      /happy-dom is not a supported sanitiser host/,
    );
  });

  it('a complete DOM (jsdom) still sanitises correctly — the guard has no false positives', async () => {
    const { JSDOM } = await import('jsdom');
    const ast = await engine.parse(HOSTILE, GFM_OPTIONS);
    const html = renderToSafeHtml(ast, { window: new JSDOM('').window as never });
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('<script');
    expect(html).toContain('safe link');
    expect(html).toContain('user-content-title');
  });
});
