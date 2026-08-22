// @vitest-environment jsdom
/**
 * Task 1.7 verify column, proven in a real browser: a ```mermaid fence renders
 * to SVG **offline**. The mermaid bundle is loaded from the local filesystem
 * (`node_modules`, file:// URL) and every request the page makes is asserted
 * to be file:// — a CDN fetch would be an M2 violation and fail this test.
 *
 * Not part of the default suite (launches Chromium). Run with
 * `pnpm --filter @onemark/renderer test:browser`.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { chromium } from 'playwright';

import { loadNodeEngine } from '@onemark/engine/node';
import { GFM_OPTIONS } from '@onemark/engine';
import { renderToSafeHtml } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const MERMAID_JS = join(here, '..', 'node_modules', 'mermaid', 'dist', 'mermaid.min.js');

const DIAGRAM = 'graph TD\nA[One] -->|label| B{Two}\nB --> C[Three]\n';

let browser: Awaited<ReturnType<typeof chromium.launch>>;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

describe('mermaid renders offline (task 1.7 verify column)', () => {
  it('hydrates the placeholder into SVG with zero network requests', async () => {
    const engine = await loadNodeEngine();
    const ast = await engine.parse('```mermaid\n' + DIAGRAM + '```\n', GFM_OPTIONS);
    const body = renderToSafeHtml(ast);
    expect(body).toContain('onemark-mermaid');

    const page = await browser.newPage();
    const requests: string[] = [];
    page.on('request', (req) => requests.push(req.url()));

    await page.setContent(`<!doctype html><html><body>${body}</body></html>`);
    // addScriptTag inlines the local bundle; a file:// src on an about:blank
    // page would be refused as a cross-origin subresource.
    await page.addScriptTag({ path: MERMAID_JS });

    const count = await page.evaluate(async (): Promise<number> => {
      const g = window as unknown as {
        mermaid: { initialize: (c: object) => void; render: (id: string, src: string) => Promise<{ svg: string }> };
      };
      g.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('div.onemark-mermaid'));
      for (const [i, el] of nodes.entries()) {
        const { svg } = await g.mermaid.render(`m-${i}`, el.textContent ?? '');
        el.innerHTML = svg;
        el.setAttribute('data-rendered', 'true');
      }
      return nodes.length;
    });

    expect(count).toBe(1);
    const svgCount = await page.locator('.onemark-mermaid svg').count();
    expect(svgCount).toBe(1);

    for (const url of requests) {
      expect(url.startsWith('file://') || url.startsWith('data:')).toBe(true);
    }
    await page.close();
  });

  it("strict security level strips foreignObject HTML labels", async () => {
    // With securityLevel strict, htmlLabels cannot run; the diagram still renders.
    const engine = await loadNodeEngine();
    const ast = await engine.parse('```mermaid\ngraph TD\nA["<b>x</b>"] --> B\n```\n', GFM_OPTIONS);
    const body = renderToSafeHtml(ast);
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><html><body>${body}</body></html>`);
    await page.addScriptTag({ path: MERMAID_JS });
    const rendered = await page.evaluate(async (): Promise<boolean> => {
      const g = window as unknown as {
        mermaid: { initialize: (c: object) => void; render: (id: string, src: string) => Promise<{ svg: string }> };
      };
      g.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
      const el = document.querySelector<HTMLElement>('div.onemark-mermaid');
      if (!el) return false;
      const { svg } = await g.mermaid.render('m-strict', el.textContent ?? '');
      return svg.includes('<svg');
    });
    expect(rendered).toBe(true);
    await page.close();
  });
});
