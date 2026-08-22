/**
 * Escaping rules, matched to the CommonMark reference implementation.
 *
 * These are not general-purpose escapers. They exist to reproduce the exact byte
 * sequences the spec suite expects, which is what makes metric M3 measurable.
 * Security is a separate concern handled by the sanitiser (NFR-2, task 1.3) —
 * escaping text is not sanitising HTML, and neither substitutes for the other.
 */

/**
 * Escapes text content and attribute values.
 *
 * `cmark`'s `escape_html` covers `&`, `<`, `>` and `"`. The double quote matters
 * even in text position: the spec expects `foo "bar"` to render as
 * `foo &quot;bar&quot;`.
 */
export function escapeHtml(text: string): string {
  let out = '';
  for (const ch of text) {
    switch (ch) {
      case '&': out += '&amp;'; break;
      case '<': out += '&lt;'; break;
      case '>': out += '&gt;'; break;
      case '"': out += '&quot;'; break;
      default: out += ch;
    }
  }
  return out;
}

/**
 * Escapes a URL for an `href` or `src`.
 *
 * Mirrors `cmark`'s `houdini_escape_href`: percent-encode anything outside a
 * conservative safe set, then HTML-escape the result. The safe set is copied
 * from the reference implementation rather than derived — deriving it produces
 * subtly different output on characters like `[` and `]`.
 */
// `&` and `'` are deliberately absent: the reference implementation treats them as
// safe bytes but then rewrites them into entities, so they are handled explicitly
// below. Leaving them in this set would make those branches unreachable.
const HREF_SAFE = new Set(
  '-_.+!*(),%#@?=;:/,+$~abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
);

export function escapeHref(url: string): string {
  let out = '';
  const bytes = new TextEncoder().encode(url);

  for (const byte of bytes) {
    const ch = String.fromCharCode(byte);
    if (ch === '&') {
      out += '&amp;';
    } else if (ch === "'") {
      out += '&#x27;';
    } else if (HREF_SAFE.has(ch)) {
      out += ch;
    } else {
      out += '%' + byte.toString(16).toUpperCase().padStart(2, '0');
    }
  }
  return out;
}
