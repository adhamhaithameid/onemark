/**
 * The shipping render path: AST in, sanitised HTML out.
 *
 * `renderToUnsafeHtml` exists for the conformance suites, which must compare
 * against CommonMark and GFM reference output *before* sanitisation — the specs
 * expect raw `<script>` to survive, because they are specifying a parser, not a
 * viewer. **Application code should call this function and never that one.**
 */

import katex from 'katex';

import type { MarkdownNode } from '@onemark/engine';

import { renderToUnsafeHtml, type RenderOptions } from './html.js';
import { createSanitizer, defaultWindow, type DomWindow, type Sanitizer } from './sanitize.js';

/**
 * Options for the safe path.
 *
 * `urlPolicy` is deliberately **not** accepted. It is a security control, and an
 * option that can switch it off turns the safe path into the unsafe one at a
 * call site far from this file — the kind of misuse a type should make
 * impossible rather than merely discourage. `tagfilter` remains configurable
 * because it is a GFM conformance behaviour, not a security boundary.
 */
export interface SafeRenderOptions extends Omit<Partial<RenderOptions>, 'urlPolicy'> {
  /** DOM to sanitise against. Defaults to the ambient `window` in a browser. */
  window?: DomWindow;
}

// One sanitiser per DOM. Building it per render is pure waste, and a WeakMap
// means a discarded window does not keep its sanitiser alive.
const sanitizers = new WeakMap<object, Sanitizer>();

function sanitizerFor(window: DomWindow): Sanitizer {
  const key = window as unknown as object;
  let sanitizer = sanitizers.get(key);
  if (!sanitizer) {
    sanitizer = createSanitizer(window);
    sanitizers.set(key, sanitizer);
  }
  return sanitizer;
}

/** Inverse of the five entities `escapeHtml` produces, for placeholder payloads. */
function unescapeText(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

const MATH_PLACEHOLDER = /<span class="onemark-math( onemark-math-display)?">([\s\S]*?)<\/span>/g;

/**
 * Replaces math placeholders with KaTeX output.
 *
 * This runs **after** the sanitiser on purpose. KaTeX's correct layout needs
 * inline styles and MathML, which the allowlist rightly forbids for document
 * content; what is hydrated here is not document content but program output
 * from our own bundled KaTeX (`trust: false`, `throwOnError: false`), generated
 * from LaTeX that already passed through the sanitiser as inert text.
 */
function hydrateMath(html: string): string {
  return html.replace(MATH_PLACEHOLDER, (_match, displayClass: string | undefined, body: string) => {
    const latex = unescapeText(body);
    try {
      return katex.renderToString(latex, {
        displayMode: displayClass !== undefined,
        throwOnError: false,
        strict: false,
        trust: false,
      });
    } catch {
      // Unrenderable LaTeX degrades to the literal source, visibly.
      return `<code class="onemark-math-error">${body}</code>`;
    }
  });
}

export function renderToSafeHtml(root: MarkdownNode, options: SafeRenderOptions = {}): string {
  const { window, ...renderOptions } = options;
  // Forced, not defaulted: a caller casting past the type still gets the policy.
  const html = renderToUnsafeHtml(root, { ...renderOptions, urlPolicy: true });
  return hydrateMath(sanitizerFor(window ?? defaultWindow()).sanitize(html));
}
