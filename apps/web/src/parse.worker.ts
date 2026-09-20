/// <reference lib='webworker' />
/**
 * Render worker (task 1.19 + perf ladder rung 1, ADR-0019/0022): comrak AND
 * the render+highlight pass never run on the UI thread.
 *
 * The worker owns the WASM engine, the Shiki adapter and the string renderer.
 * It answers two messages:
 *   `{ id, source }`                    → `{ id, ast }`        (parse only)
 *   `{ id, source, render: { theme } }` → `{ id, html }`       (render unsafe HTML)
 *
 * Deliberately NOT here: sanitisation. DOMPurify needs a complete DOM and
 * fails closed on shims (ADR-0022) — the main thread sanitises with its real
 * DOM through `sanitiseHtml` + `hydrateMathInHtml`. What crosses the boundary
 * is rendered-but-unsanitised HTML, exactly the string `renderToSafeHtml`
 * would sanitise internally, with the same forced safe-path options.
 */

import { loadWebEngine, GFM_OPTIONS } from '@onemark/engine';
import { renderToUnsafeBlocks, createSyntaxHighlighter } from '@onemark/renderer';

const engine = await loadWebEngine();
const highlighter = await createSyntaxHighlighter();

self.onmessage = async (
  event: MessageEvent<{ id: number; source: string; render?: { theme: 'light' | 'dark' } }>,
): Promise<void> => {
  const { id, source, render } = event.data;
  try {
    if (!render) {
      const ast = await engine.parse(source, GFM_OPTIONS);
      self.postMessage({ id, ast });
      return;
    }
    const ast = await engine.parse(source, GFM_OPTIONS);
    const blocks = renderToUnsafeBlocks(ast, {
      // The exact forced options renderToSafeHtml applies before sanitising —
      // the main thread's sanitiser expects this shape.
      urlPolicy: true,
      headingAnchors: true,
      softBreakAsBr: true,
      highlighter,
      theme: render.theme,
    });
    self.postMessage({ id, blocks });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
