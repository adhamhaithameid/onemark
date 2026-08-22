/**
 * Which URL schemes may appear in rendered output.
 *
 * This exists **as well as** the sanitiser, not instead of it, for one concrete
 * reason: the rule in tech spec §6 is context-dependent — `data:` is permitted
 * for an image `src` and forbidden for a link `href` — and DOMPurify's URI
 * policy is a single global regex that cannot express that distinction. So the
 * context-aware half lives here, where the renderer still knows whether it is
 * emitting a link or an image, and the sanitiser catches everything arriving
 * through raw HTML.
 */

/** Schemes a link may navigate to. Deliberately short. */
const LINK_SCHEMES = new Set(['http', 'https', 'mailto']);

/** Schemes an image may load from. */
const IMAGE_SCHEMES = new Set(['http', 'https']);

/**
 * `data:` image types permitted in an `img src`.
 *
 * **`image/svg+xml` is deliberately absent.** An SVG is a document: it can carry
 * `<script>` and event handlers, so a `data:image/svg+xml` URL is a script
 * delivery mechanism wearing an image's clothes. GitHub blocks it and so do we.
 */
const DATA_IMAGE_TYPES = /^data:image\/(png|jpeg|jpg|gif|webp|avif)[;,]/;

/**
 * Strips characters a browser ignores when it resolves a scheme.
 *
 * `java<TAB>script:alert(1)` and `java<NEWLINE>script:alert(1)` both navigate.
 * A check that does not remove these first is checking a string the browser
 * will never see.
 */
function normalise(url: string): string {
  return url.replace(/[\u0000-\u0020\u007f]/g, '').toLowerCase();
}

export type UrlContext = 'link' | 'image';

export function isSafeUrl(url: string, context: UrlContext): boolean {
  const normalised = normalise(url);

  const scheme = /^([a-z][a-z0-9+.\-]*):/.exec(normalised)?.[1];

  // No scheme means relative, absolute-path, protocol-relative or a fragment.
  // These cannot introduce script execution; where they point is the document's
  // business, exactly as it is in any viewer.
  if (scheme === undefined) return true;

  if (context === 'image') {
    if (normalised.startsWith('data:')) return DATA_IMAGE_TYPES.test(normalised);
    return IMAGE_SCHEMES.has(scheme);
  }

  return LINK_SCHEMES.has(scheme);
}
