/**
 * `MarkdownEngine` backed by `comrak` compiled to WebAssembly.
 *
 * The WASM module's surface is deliberately primitive — strings in, strings out
 * (see `crates/onemark-wasm`). Everything structural happens on this side of the
 * boundary, which keeps the amount of hand-synchronised marshalling at zero.
 */

import type { MarkdownNode } from './ast.js';
import type { MarkdownEngine, ParseOptions } from './engine.js';
import { assertValidAst } from './validate.js';

/** The raw surface wasm-bindgen generates. */
export interface WasmExports {
  engine_id(): string;
  engine_version(): string;
  parse_to_json(source: string, optionsJson: string): string;
  render_to_html(source: string, optionsJson: string): string;
}

export class WasmMarkdownEngine implements MarkdownEngine {
  readonly id: string;
  readonly version: string;

  constructor(private readonly exports: WasmExports) {
    this.id = exports.engine_id();
    this.version = exports.engine_version();
  }

  async parse(source: string, options: ParseOptions): Promise<MarkdownNode> {
    const json = this.exports.parse_to_json(source, JSON.stringify(options));
    const ast: unknown = JSON.parse(json);
    // The boundary is the one place where a shape change could arrive silently.
    // Validating here means a Rust-side regression surfaces as a clear error
    // rather than as a renderer crash three layers up.
    assertValidAst(ast);
    return ast;
  }

  /**
   * Design B from tech spec §5 — HTML produced inside Rust.
   *
   * Retained because OQ-4 is measured across this boundary and because the
   * hybrid fallback needs it. The output is **unsanitised**; NFR-2 sanitisation
   * is render-layer and has not been built yet (M1.3).
   */
  async renderToUnsafeHtml(source: string, options: ParseOptions): Promise<string> {
    return this.exports.render_to_html(source, JSON.stringify(options));
  }
}

