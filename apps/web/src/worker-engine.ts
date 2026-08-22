/**
 * The worker-backed engine handle for the main thread (task 1.19).
 *
 * Satisfies the same `MarkdownEngine` interface the direct WASM binding does
 * (ADR-0002 seam) — the workspace cannot tell the difference, which is the
 * point: parsing moves off the main thread without touching any other layer.
 */

import type { MarkdownEngine, MarkdownNode, ParseOptions } from '@onemark/engine';

interface Pending {
  resolve: (ast: MarkdownNode) => void;
  reject: (error: Error) => void;
}

export function startWorkerEngine(workerFactory?: () => Worker): MarkdownEngine {
  const worker =
    workerFactory?.() ??
    (new Worker(new URL('./parse.worker.ts', import.meta.url), { type: 'module' }) as Worker);

  const pending = new Map<number, Pending>();
  let nextId = 1;

  worker.onmessage = (event: MessageEvent) => {
    const data = event.data as { id: number; ast?: MarkdownNode; error?: string };
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    if (data.error !== undefined || data.ast === undefined) {
      entry.reject(new Error(data.error ?? 'worker returned no AST'));
    } else {
      entry.resolve(data.ast);
    }
  };

  worker.onerror = (event) => {
    const error = new Error(event.message || 'engine worker crashed');
    for (const entry of pending.values()) entry.reject(error);
    pending.clear();
  };

  return {
    id: 'comrak-wasm-worker',
    version: 'worker-1',
    parse(source: string, options: ParseOptions): Promise<MarkdownNode> {
      // Options are locked to GFM at the worker; kept in the signature so the
      // seam stays identical to the direct engine (ADR-0002).
      void options;
      const id = nextId++;
      return new Promise<MarkdownNode>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, source });
      });
    },
  };
}
