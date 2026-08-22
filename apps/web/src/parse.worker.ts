/// <reference lib='webworker' />
/**
 * Parse worker (task 1.19, NFR-3): comrak never runs on the UI thread.
 *
 * The worker owns the WASM engine and answers parse requests with AST JSON;
 * the main thread validates and renders. Protocol is deliberately trivial:
 * `{ id, source }` in, `{ id, ast }` or `{ id, error }` out.
 */

import { loadWebEngine } from '@onemark/engine';

const engine = await loadWebEngine();

self.onmessage = async (event: MessageEvent<{ id: number; source: string }>): Promise<void> => {
  const { id, source } = event.data;
  try {
    const ast = await engine.parse(source, {
      dialect: 'gfm',
      extensions: {
        tables: true,
        strikethrough: true,
        autolink: true,
        taskList: true,
        footnotes: true,
        alerts: true,
        math: true,
        frontmatter: true,
      },
    });
    self.postMessage({ id, ast });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
