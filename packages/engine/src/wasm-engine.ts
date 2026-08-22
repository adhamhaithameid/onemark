/**
 * Loads the Node build of the engine. Used by tests and benchmarks.
 */

import { createRequire } from 'node:module';

import { WasmMarkdownEngine, type WasmExports } from './wasm-core.js';

export async function loadNodeEngine(): Promise<WasmMarkdownEngine> {
  const require = createRequire(import.meta.url);
  const exports = require('../wasm/nodejs/onemark_wasm.js') as WasmExports;
  return new WasmMarkdownEngine(exports);
}
