/**
 * Task 1.7 — hydrate mermaid code blocks with the bundled mermaid.
 *
 * `securityLevel: 'strict'` is NFR-2, not a preference: strict blocks HTML
 * labels, click callbacks and `securityLevel`-gated features in diagrams —
 * a diagram is document content, so it gets document trust and nothing more.
 *
 * The renderer emits ```mermaid fences as standard
 * `<pre><code class="language-mermaid">` blocks (matching GitHub's static
 * shape; see html.ts); the application calls `hydrateMermaid()` after it
 * mounts the sanitised HTML. Mermaid needs real layout (SVG `getBBox`), so
 * this runs in a browser, never in the render pipeline.
 */

import mermaid from 'mermaid';

let configured = false;

export function configureMermaid(): void {
  if (configured) return;
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
  configured = true;
}

/**
 * Renders every unrendered `language-mermaid` code block under `root`,
 * replacing its `<pre>` with the SVG. Returns the number of diagrams
 * rendered. A diagram whose syntax mermaid rejects degrades to a visible
 * error box, never a blank hole.
 */
export async function hydrateMermaid(root: ParentNode = document): Promise<number> {
  configureMermaid();
  const nodes = Array.from(
    root.querySelectorAll<HTMLElement>('pre > code.language-mermaid'),
  ).filter((code) => !(code.closest('pre') as HTMLElement | null)?.dataset['rendered']);
  let rendered = 0;
  for (const [index, code] of nodes.entries()) {
    const pre = code.closest('pre') as HTMLElement;
    const source = code.textContent ?? '';
    try {
      const { svg, bindFunctions } = await mermaid.render(`onemark-mermaid-${index}`, source);
      const holder = document.createElement('div');
      holder.className = 'onemark-mermaid';
      holder.dataset['rendered'] = 'true';
      holder.innerHTML = svg;
      bindFunctions?.(holder);
      pre.replaceWith(holder);
      rendered += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const box = document.createElement('pre');
      box.className = 'onemark-mermaid-error';
      box.textContent = message;
      pre.replaceWith(box);
    }
  }
  return rendered;
}
