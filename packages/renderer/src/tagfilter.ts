/**
 * GFM's "Disallowed Raw HTML" extension.
 *
 * Nine tag names are neutralised by escaping their opening `<` to `&lt;`. Note
 * that only the `<` is escaped — the `>` is left alone — which is what the spec
 * expects and looks like a bug until you check.
 *
 * **This is not a security control.** It blocks nine names and nothing else; it
 * does not touch attributes, event handlers, `javascript:` URLs, or any other
 * tag. The sanitiser (NFR-2, task 1.3) is the security control, and this must
 * never be mistaken for it.
 */

const DISALLOWED = [
  'title', 'textarea', 'style', 'xmp', 'iframe',
  'noembed', 'noframes', 'script', 'plaintext',
];

/** Characters that may terminate a tag name. */
function isDelimiter(ch: string | undefined): boolean {
  return ch === undefined || ch === ' ' || ch === '\t' || ch === '\n'
    || ch === '\f' || ch === '\r' || ch === '/' || ch === '>';
}

export function filterDisallowedTags(html: string): string {
  let out = '';
  let i = 0;

  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      out += html.slice(i);
      break;
    }

    out += html.slice(i, lt);

    // A closing tag is filtered too: `</script>` is as unwelcome as `<script>`.
    const afterBracket = html[lt + 1] === '/' ? lt + 2 : lt + 1;
    const rest = html.slice(afterBracket).toLowerCase();
    const match = DISALLOWED.find(
      (tag) => rest.startsWith(tag) && isDelimiter(html[afterBracket + tag.length]),
    );

    if (match) {
      out += '&lt;';
      i = lt + 1;
    } else {
      out += '<';
      i = lt + 1;
    }
  }

  return out;
}
