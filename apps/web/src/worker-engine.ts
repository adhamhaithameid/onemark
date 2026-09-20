/**
 * The worker-backed engine handle for the main thread (task 1.19 + rung 1).
 *
 * `parse` satisfies the same `MarkdownEngine` interface the direct WASM
 * binding does (ADR-0002 seam). `renderUnsafe` additionally renders in the
 * worker — parse + string render + Shiki highlighting off the UI thread
 * (ADR-0019 rung 1) — returning the *unsanitised* HTML the main thread then
 * pushes through `sanitiseHtml` + `hydrateMathInHtml` (ADR-0022: sanitisation
 * requires a complete DOM and always fails closed).
 */

import type { MarkdownEngine, MarkdownNode, ParseOptions } from '@onemark/engine';

interface Pending {
  resolve: (value: never) => void;
  reject: (error: Error) => void;
  kind: 'ast' | 'blocks';
}

export interface WorkerEngine extends MarkdownEngine {
  /** Rendered-but-unsanitised top-level blocks from the worker (safe-path options forced). */
  renderUnsafeBlocks(source: string, theme: 'light' | 'dark'): Promise<string[]>;
}

export function startWorkerEngine(workerFactory?: () => Worker): WorkerEngine {
  const worker =
    workerFactory?.() ??
    (new Worker(new URL('./parse.worker.ts', import.meta.url), { type: 'module' }) as Worker);

  const pending = new Map<number, Pending>();
  let nextId = 1;

  worker.onmessage = (event: MessageEvent) => {
    const data = event.data as { id: number; ast?: MarkdownNode; blocks?: string[]; error?: string };
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    if (data.error !== undefined) {
      entry.reject(new Error(data.error));
    } else if (entry.kind === 'ast' && data.ast !== undefined) {
      entry.resolve(data.ast as never);
    } else if (entry.kind === 'blocks' && data.blocks !== undefined) {
      entry.resolve(data.blocks as never);
    } else {
      entry.reject(new Error('worker returned no payload for the request kind'));
    }
  };

  worker.onerror = (event) => {
    const error = new Error(event.message || 'engine worker crashed');
    for (const entry of pending.values()) entry.reject(error);
    pending.clear();
  };

  return {
    id: 'comrak-wasm-worker',
    version: 'worker-2',
    parse(source: string, options: ParseOptions): Promise<MarkdownNode> {
      // Options are locked to GFM at the worker; kept in the signature so the
      // seam stays identical to the direct engine (ADR-0002).
      void options;
      const id = nextId++;
      return new Promise<MarkdownNode>((resolve, reject) => {
        pending.set(id, { resolve: resolve as never, reject, kind: 'ast' });
        worker.postMessage({ id, source });
      });
    },
    renderUnsafeBlocks(source: string, theme: 'light' | 'dark'): Promise<string[]> {
      const id = nextId++;
      return new Promise<string[]>((resolve, reject) => {
        pending.set(id, { resolve: resolve as never, reject, kind: 'blocks' });
        worker.postMessage({ id, source, render: { theme } });
      });
    },
  };
}
