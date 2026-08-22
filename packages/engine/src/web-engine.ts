/**
 * Loads the Web (ESM) build for the browser app. Deliberately a separate
 * module from `wasm-engine.ts`, whose Node loader imports `node:module` — one
 * tainted import would externalise the whole graph for the browser bundle.
 *
 * The wasm-bindgen `web` target exposes an async default initialiser that
 * fetches the .wasm sibling; bundlers resolve both URLs off this module.
 */

import { WasmMarkdownEngine, type WasmExports } from './wasm-core.js';

export async function loadWebEngine(): Promise<WasmMarkdownEngine> {
  const factory = (await import('../wasm/web/onemark_wasm.js')) as unknown as WasmExports & {
    default: (input: URL | RequestInfo) => Promise<void>;
  };
  await factory.default(new URL('../wasm/web/onemark_wasm_bg.wasm', import.meta.url));
  return new WasmMarkdownEngine(factory);
}
