/**
 * Task 1.7 — hydrate mermaid placeholders with the bundled mermaid.
 *
 * `securityLevel: 'strict'` is NFR-2, not a preference: strict blocks HTML
 * labels, click callbacks and `securityLevel`-gated features in diagrams —
 * a diagram is document content, so it gets document trust and nothing more.
 *
 * The renderer emits `<div class="onemark-mermaid">` placeholders (see
 * html.ts); the application calls `hydrateMermaid()` after it mounts the
 * sanitised HTML. Mermaid needs real layout (SVG `getBBox`), so this runs in
 * a browser, never in the render pipeline.
 */

import mermaid from 'mermaid';

let configured = false;

export function configureMermaid(): void {
  if (configured) return;
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
  configured = true;
}

/**
 * Renders every unrendered `.onemark-mermaid` placeholder under `root`.
 * Returns the number of diagrams rendered. A diagram whose syntax mermaid
 * rejects degrades to a visible error box, never a blank hole.
 */
export async function hydrateMermaid(root: ParentNode = document): Promise<number> {
  configureMermaid();
  const nodes = Array.from(
    root.querySelectorAll<HTMLElement>('div.onemark-mermaid:not([data-rendered])'),
  );
  let rendered = 0;
  for (const [index, el] of nodes.entries()) {
    const source = el.textContent ?? '';
    try {
      const { svg, bindFunctions } = await mermaid.render(`onemark-mermaid-${index}`, source);
      el.innerHTML = svg;
      el.setAttribute('data-rendered', 'true');
      bindFunctions?.(el);
      rendered += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const box = document.createElement('pre');
      box.className = 'onemark-mermaid-error';
      box.textContent = message;
      el.replaceWith(box);
    }
  }
  return rendered;
}
