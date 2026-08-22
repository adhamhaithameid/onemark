// @vitest-environment jsdom
/**
 * **Real-browser security verification.**
 *
 * jsdom is not a browser. Mutation XSS lives precisely in the gap between one
 * HTML parser and another, so a sanitiser that satisfies jsdom has not been
 * shown to satisfy Blink, WebKit or Gecko. This runs the whole corpus through
 * real engines.
 *
 * WebKit matters most: PRD §10 ships macOS and iOS inside WKWebView, so WebKit
 * is not an extra engine here — it is the primary one.
 *
 * **What this proves:** markup sanitised by OneMark is inert when a real engine
 * parses it via `innerHTML`, which is how the application inserts it.
 *
 * **Residual gap, stated precisely:** the sanitising parse happens under jsdom
 * here, while in production DOMPurify uses the browser's own parser. That makes
 * production *more* self-consistent than this test, not less — but a build that
 * sanitises inside the browser is the only way to close it completely, and that
 * arrives with the web app (task 1.22).
 *
 * Not part of the default suite: launching three engines is slow. Run with
 * `pnpm --filter @onemark/renderer test:browser`.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { chromium, firefox, webkit, type Browser } from 'playwright';

import { loadNodeEngine } from '@onemark/engine/node';
import { GFM_OPTIONS } from '@onemark/engine';

import { renderToSafeHtml, renderToUnsafeHtml } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));

interface Case { name: string; safe: string; unsafe: string }

/**
 * Runs inside the browser page. Must be a function, not a string: `page.evaluate`
 * only forwards arguments to the function form, and silently ignores them for a
 * string expression.
 */
function inspectInPage(html: string): string[] {
  const FORBIDDEN_ELEMENTS = ['script', 'iframe', 'object', 'embed', 'form', 'base', 'meta',
    'link', 'style', 'noscript', 'template', 'frame', 'frameset',
    'audio', 'video', 'source', 'track', 'marquee', 'portal'];
  const FORBIDDEN_ATTRS = ['srcdoc', 'ping', 'srcset', 'download', 'target',
    'formaction', 'action', 'style'];
  const DANGEROUS = /^\s*(javascript|vbscript|data|file|blob):/i;

  const stage = document.getElementById('stage') as HTMLElement;
  stage.innerHTML = html;

  const problems: string[] = [];
  for (const el of Array.from(stage.querySelectorAll('*'))) {
    const tag = el.tagName.toLowerCase();
    if (FORBIDDEN_ELEMENTS.indexOf(tag) !== -1) problems.push('element <' + tag + '>');
    for (const a of Array.from(el.attributes)) {
      const n = a.name.toLowerCase();
      if (n.indexOf('on') === 0) {
        problems.push('handler ' + n + ' on <' + tag + '>');
        if (typeof (el as unknown as Record<string, unknown>)[n] === 'function') {
          problems.push('LIVE handler ' + n);
        }
      }
      if (FORBIDDEN_ATTRS.indexOf(n) !== -1) problems.push(n + ' on <' + tag + '>');
      if (['href', 'src', 'xlink:href'].indexOf(n) !== -1 && DANGEROUS.test(a.value)) {
        const raster = tag === 'img' && n === 'src' &&
          /^\s*data:image\/(png|jpeg|jpg|gif|webp|avif)[;,]/i.test(a.value);
        if (!raster) problems.push(n + '=' + a.value.slice(0, 40));
      }
    }
  }
  stage.innerHTML = '';
  return problems;
}

const PAGE = '<!doctype html><html><body><div id="stage"></div></body></html>';

let cases: Case[] = [];

beforeAll(async () => {
  const engine = await loadNodeEngine();
  const vectors: { name: string; markdown: string }[] = JSON.parse(
    readFileSync(join(here, '../../../fidelity/xss/corpus.json'), 'utf8'),
  );
  cases = [];
  for (const v of vectors) {
    const ast = await engine.parse(v.markdown, GFM_OPTIONS);
    cases.push({
      name: v.name,
      safe: renderToSafeHtml(ast),
      unsafe: renderToUnsafeHtml(ast, { tagfilter: false, urlPolicy: false }),
    });
  }
}, 120_000);

interface PassResult {
  failures: { name: string; problems: string[] }[];
  executions: string[];
}

/**
 * Runs one pass in its own browser context.
 *
 * Safe and unsafe markup must never share a page. Script execution and network
 * activity are *document-global* signals, so mixing the two passes makes every
 * observation unattributable — a design mistake this file previously contained,
 * where alerts fired by the deliberately-unsanitised pass were being reported
 * against the sanitised one.
 */
async function runPass(browser: Browser, htmlFor: (c: Case) => string): Promise<PassResult> {
  const context = await browser.newContext();
  // Nothing in a security test should reach the network: a vector that fetches
  // is a finding, not a dependency.
  await context.route('**/*', (route) => route.abort());
  const page = await context.newPage();

  const executions: string[] = [];
  page.on('dialog', async (d) => { executions.push('dialog:' + d.type()); await d.dismiss(); });
  page.on('pageerror', (e) => { executions.push('pageerror:' + String(e).slice(0, 60)); });

  await page.addInitScript(() => {
    (window as unknown as { __exec: string[] }).__exec = [];
    for (const fn of ['alert', 'confirm', 'prompt', 'print']) {
      (window as unknown as Record<string, unknown>)[fn] = () =>
        (window as unknown as { __exec: string[] }).__exec.push(fn);
    }
  });
  await page.setContent(PAGE);

  const failures: { name: string; problems: string[] }[] = [];
  for (const c of cases) {
    const problems = await page.evaluate(inspectInPage, htmlFor(c));
    if (problems.length > 0) failures.push({ name: c.name, problems: problems.slice(0, 5) });
  }

  // Give asynchronous handlers (img onerror and friends) time to fire.
  await page.waitForTimeout(750);
  const inPage = await page.evaluate(
    () => (window as unknown as { __exec?: string[] }).__exec ?? [],
  );
  await context.close();

  return { failures, executions: [...executions, ...inPage] };
}

describe.each([
  ['webkit', webkit],
  ['chromium', chromium],
  ['firefox', firefox],
])('%s', (name, type) => {
  it('sanitised output is inert, and the unsanitised corpus is not', async () => {
    const browser = await type.launch();
    let safe: PassResult;
    let unsafe: PassResult;
    try {
      // Separate contexts: see the note on runPass.
      safe = await runPass(browser, (c) => c.safe);
      unsafe = await runPass(browser, (c) => c.unsafe);
    } finally {
      await browser.close();
    }

    console.log(
      `\n${name}: ${cases.length} vectors` +
        `\n  sanitised   — failures ${safe.failures.length}, executions ${safe.executions.length}` +
        `\n  unsanitised — failures ${unsafe.failures.length}, executions ${unsafe.executions.length}`,
    );
    for (const f of safe.failures.slice(0, 8)) {
      console.log(`  SURVIVED ${f.name}: ${f.problems.join(', ')}`);
    }

    // The security assertions: nothing dangerous in the DOM, and nothing ran.
    expect(safe.failures.map((f) => f.name)).toEqual([]);
    expect(safe.executions).toEqual([]);

    // The load-bearing assertions: if the corpus has gone inert, everything
    // above proves nothing. A real engine must execute it without the sanitiser.
    expect(unsafe.failures.length).toBeGreaterThan(20);
    expect(unsafe.executions.length).toBeGreaterThan(0);
  }, 240_000);
});
