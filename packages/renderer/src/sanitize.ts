/**
 * HTML sanitisation (NFR-2).
 *
 * Wraps DOMPurify rather than implementing a sanitiser. That is the same call
 * ADR-0002 made about the parser, applied where being wrong means a
 * vulnerability instead of a wrong pixel: hand-written sanitisers fail on
 * mutation XSS — where a browser re-parses "sanitised" output into something the
 * sanitiser never saw — and on SVG/MathML namespace confusion. DOMPurify is
 * maintained by security researchers with an adversarial test suite; this file
 * should stay a thin, auditable configuration of it.
 *
 * DOMPurify needs a DOM. In the browser that is the page's own `window`; in
 * tests it is jsdom. Nothing here reaches the network.
 */

import createDOMPurify from 'dompurify';

import { isSafeUrl } from './url-policy.js';

/**
 * Elements permitted in output: everything our renderer emits, plus the raw HTML
 * GitHub keeps.
 *
 * **This list is load-bearing and is asserted by `allowlist.test.ts`.** It was
 * previously inert — the config also passed `USE_PROFILES`, which DOMPurify
 * applies *after* `ALLOWED_TAGS` and which overwrites it wholesale. The effect
 * was that DOMPurify's much broader default HTML profile applied instead, so
 * `<audio src>`, `<video src>` and `<track src>` survived and could fetch
 * arbitrary remote URLs — a direct violation of PRD §5.3, which makes remote
 * *images* the sole permitted network use. Do not reintroduce `USE_PROFILES`.
 */
const ALLOWED_TAGS = [
  // structure
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'hr', 'br', 'div', 'section', 'span',
  // lists
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  // code
  'pre', 'code', 'kbd', 'samp', 'var',
  // tables
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  // inline
  'a', 'em', 'strong', 'del', 'ins', 'sub', 'sup', 'b', 'i', 'u', 's', 'mark', 'small',
  'abbr', 'q', 'cite', 'time',
  // media — remote images are the sole permitted network use (PRD §5.3).
  // `audio`, `video`, `source` and `track` are deliberately absent: each fetches
  // a remote URL, and none is an image.
  'img', 'figure', 'figcaption',
  // disclosure, which GitHub supports and READMEs use constantly
  'details', 'summary',
  // task list checkboxes; constrained to disabled checkboxes by a hook below
  'input',
];

const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'align', 'class', 'id', 'lang', 'dir',
  'colspan', 'rowspan', 'width', 'height', 'start', 'reversed', 'value',
  // task list checkboxes only; `input` is otherwise removed entirely
  'type', 'checked', 'disabled',
  'aria-label', 'aria-hidden', 'aria-describedby', 'role',
  'open',
];

/**
 * Belt to the allowlist's braces.
 *
 * An allowlist already excludes these, so this is redundant by construction —
 * which is the point. If a future edit widens `ALLOWED_TAGS` carelessly, these
 * still do not come back.
 */
const FORBID_TAGS = [
  'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed',
  'form', 'button', 'textarea', 'select', 'option',
  'base', 'meta', 'link', 'noscript', 'template',
  'svg', 'math', 'title', 'xmp', 'plaintext',
  'audio', 'video', 'source', 'track', 'marquee', 'portal',
];

const FORBID_ATTR = [
  'srcdoc', 'formaction', 'action', 'style', 'background', 'ping', 'srcset',
  'download', 'target', 'tabindex', 'loading', 'is', 'name',
];

export interface DomWindow {
  document: unknown;
}

export interface Sanitizer {
  sanitize(html: string): string;
}

/** Attributes that carry a URL, and the policy context each is judged under. */
function urlAttributesOf(element: Element): [name: string, value: string][] {
  const out: [string, string][] = [];
  for (const name of ['href', 'src', 'xlink:href']) {
    const value = element.getAttribute?.(name);
    if (typeof value === 'string') out.push([name, value]);
  }
  return out;
}

/**
 * Builds a sanitiser bound to a DOM.
 *
 * `data-*` attributes are permitted because the footnote markup GitHub emits
 * depends on them (`data-footnotes`, `data-footnote-ref`, ...). They carry no
 * behaviour of their own.
 */
export function createSanitizer(window: DomWindow): Sanitizer {
  // The DOMPurify typings expect a full `Window`; the structural type above is
  // all that is actually touched, and keeps jsdom and the browser interchangeable.
  const purify = createDOMPurify(window as never);

  // `input` exists in the allowlist for one reason: GFM task-list checkboxes.
  // Anything else wearing that tag name is removed rather than left as an
  // interactive control the document never asked for.
  purify.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName !== 'input') return;
    const element = node as unknown as Element;
    const type = (element.getAttribute?.('type') ?? '').toLowerCase();
    if (type !== 'checkbox') element.parentNode?.removeChild(element);
  });

  /**
   * Applies OneMark's URL policy to *every* URL, however it arrived.
   *
   * The renderer applies the same policy to link and image nodes it builds
   * itself, but raw HTML in the document never passes through that code. Without
   * this hook the two paths disagree: `![x](data:image/svg+xml,...)` was refused
   * while `<img src="data:image/svg+xml,...">` was permitted, because DOMPurify
   * allows `data:` on `img` by default. One policy, both paths.
   */
  purify.addHook('afterSanitizeAttributes', (node) => {
    const element = node as unknown as Element;
    if (typeof element.getAttribute !== 'function') return;

    const tag = element.tagName?.toLowerCase?.() ?? '';
    for (const [name, value] of urlAttributesOf(element)) {
      // `src` is an image source only on `img`; anywhere else it is treated
      // under the stricter link rules.
      const context = name === 'src' && tag === 'img' ? 'image' : 'link';
      if (!isSafeUrl(value, context)) element.removeAttribute(name);
    }
  });

  return {
    sanitize(html: string): string {
      return purify.sanitize(html, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        FORBID_TAGS,
        FORBID_ATTR,
        ALLOW_DATA_ATTR: true,
        ALLOW_ARIA_ATTR: true,
        // Keep the document's text when an element is dropped: removing a
        // `<form>` should not silently delete the paragraph inside it.
        KEEP_CONTENT: true,
        RETURN_DOM: false,
        RETURN_DOM_FRAGMENT: false,
        WHOLE_DOCUMENT: false,
        // NOTE: `USE_PROFILES` must never be set here. DOMPurify applies it after
        // ALLOWED_TAGS/ALLOWED_ATTR and replaces both, silently disabling the
        // allowlist above. `allowlist.test.ts` fails if that happens again.
      }) as unknown as string;
    },
  };
}

/** Resolves the ambient DOM, as the browser provides it. */
export function defaultWindow(): DomWindow {
  const candidate = (globalThis as { window?: DomWindow }).window;
  if (!candidate?.document) {
    throw new Error(
      'No DOM available to sanitise with. In a browser this is automatic; in Node, ' +
        'run with the jsdom environment or pass a window explicitly.',
    );
  }
  return candidate;
}
