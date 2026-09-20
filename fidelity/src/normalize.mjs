/**
 * OQ-2 resolution (PRD §12): HTML normalization rules R1–R6, then a
 * **structural** comparison. Both sides are parsed to a DOM with parse5 and
 * diffed tree-wise; string-level diffing would drown in attribute ordering
 * and inter-block whitespace.
 *
 * Each rule is named after the GitHub artifact it neutralises. Anything not
 * covered by R1–R6 counts as a real difference — the rule set is extensible,
* but every addition needs a named artifact and a test (same discipline as the
 * XSS corpus).
 */

import { parse } from 'parse5';

/** Parse an HTML fragment into a plain, comparable tree. */
function toComparable(html) {
  const fragment = parse(html);
  return simplify(fragment);
}

function simplify(node) {
  if (node.nodeName === '#document') {
    return { tag: '#document', attrs: {}, children: collectChildren(node) };
  }
  if (node.nodeName.startsWith('#')) {
    const kind = node.nodeName; // #text, #comment...
    if (kind === '#text') {
      // Text is significant as-is; only fully-blank text nodes are dropped so
      // that pretty-printing between blocks never becomes a difference (R4).
      return /^\s*$/.test(node.value ?? '') ? null : { tag: '#text', value: node.value };
    }
    if (kind === '#comment') return null; // R4: comments are formatting
    return null;
  }

  // R18 discriminator: ids are only meaningful on headings (GitHub's sanitiser
  // drops raw ids everywhere else).
  const isHeading = /^h[1-6]$/.test(node.tagName);

  const attrs = {};
  for (const attr of node.attrs ?? []) {
    let name = attr.name;
    let value = attr.value;
    if (name === 'dir') continue; // R2: bidirectional-text hints are chrome
    // R7: the POST /markdown API emits `rel="nofollow"` (and combinations with
    // noreferrer) on every link — crawler chrome, not rendering semantics.
    if (name === 'rel' && node.tagName === 'a') continue;
    // R8: camo-proxied images carry `data-canonical-src` — the proxy's record
    // of the original URL; R3 already compares position+alt only.
    if (node.tagName === 'img' && name === 'data-canonical-src') continue;
    // R9: the API stamps `style="max-width: 100%;"` on every image —
    // responsive-image chrome; OneMark's sanitiser forbids inline style and
    // the vendored GitHub CSS carries the same rule at class level.
    if (node.tagName === 'img' && name === 'style') continue;
    // R12: GitHub marks inline `<code class="notranslate">` as an opt-out for
    // machine translation — page chrome, not rendering semantics.
    if (node.tagName === 'code' && name === 'class' && value === 'notranslate') continue;
    // R20: the task-list class vocabulary differs between GitHub surfaces
    // (`task-list`/`task-list-item` on the API, `contains-task-list`/
    // `contains-task-list-item` on github.com). The list structure itself is
    // compared; the class spelling is chrome.
    if (name === 'class' && ['ul', 'ol', 'li'].includes(node.tagName) && /^(contains-)?task-list(-item)?$/.test(value)) continue;
    // R22: GitHub's sanitiser strips `class` from raw-HTML anchors, images,
    // definition terms, spans and tables; OneMark's allowlist keeps more.
    // Ours never generates class on these elements (alert divs and task lists
    // are deliberately excluded from this rule).
    if (name === 'class' && ['a', 'img', 'dt', 'dd', 'span', 'table', 'sup'].includes(node.tagName)) continue;
    // R24: raw-HTML div classes are stripped by GitHub's sanitiser; OneMark's
    // keeps them. OneMark's own generated vocabulary (`markdown-alert*`) is
    // exempt — alert-type fidelity stays under the gate.
    if (name === 'class' && node.tagName === 'div' && !value.startsWith('markdown-alert')) continue;
    // R25: legacy presentational attributes are stripped by GitHub's
    // sanitiser (`cellspacing`/`cellpadding`/`border`/`valign` on tables and
    // cells, `hspace`/`vspace` on images). Cell `align` is NOT stripped — it
    // carries GFM column alignment, a real rendering decision.
    if ((node.tagName === 'table' || node.tagName === 'td' || node.tagName === 'th' || node.tagName === 'tr') && ['cellspacing', 'cellpadding', 'border', 'valign'].includes(name)) continue;
    if (node.tagName === 'img' && ['hspace', 'vspace', 'valign', 'align', 'border'].includes(name)) continue;
    // R28: task-list checkbox chrome — GitHub stamps `class` and
    // `aria-label` on the `<input>` it renders per task item.
    if (node.tagName === 'input' && (name === 'class' || name === 'aria-label')) continue;
    // R23: GitHub upgrades insecure `http:` link protocols to `https:` —
    // compare hrefs protocol-insensitively.
    if (node.tagName === 'a' && name === 'href' && value.startsWith('http://')) {
      value = `https://${value.slice('http://'.length)}`;
    }
    // R15: GitHub stamps ARIA `role` attributes (e.g. `role="table"`) on
    // markdown elements — accessibility chrome derived from the tag itself.
    if (name === 'role') continue;
    // R17: GitHub annotates user/repo/issue links with `data-*` attributes
    // (`data-hovercard-*`, `data-error-*`, `data-permission-text`, `data-id`,
    // `data-octo-*`) powering its popups — page chrome. OneMark generates no
    // data attributes on links.
    if (node.tagName === 'a' && name.startsWith('data-')) continue;
    // R1 companion: GitHub prefixes heading ids with `user-content-`; OneMark
    // does the same by design, so the prefix carries no difference signal.
    if (name === 'id' && value.startsWith('user-content-')) continue;
    // R18: raw-HTML ids on non-heading elements are dropped by GitHub's
    // sanitiser; OneMark's keeps them. Invisible either way.
    if (name === 'id' && !isHeading) continue;
    // R3: camo-proxied images compare as "a remote image was here".
    if (node.tagName === 'img' && name === 'src' && /https:\/\/camo\.githubusercontent\.com\//.test(value)) {
      value = '[camo]';
    }
    // R5: bare boolean attributes arrive with empty-string values in parse5.
    attrs[name] = value;
  }

  // R10: highlighted code collapses to its text on both sides. GitHub's API
  // returns its own linguist tokenisation (`div.highlight > pre.notranslate >
  // span.pl-*`); OneMark ships `<pre><code>` and deliberately tokenises with
  // Shiki at the present layer (PRD §7 accepted gap). Token identity is not
  // rendering semantics; the code TEXT is.
  if (node.tagName === 'pre') {
    // R11: cmark's spec grammar ends every code block with a newline; GitHub's
    // highlight pipeline re-renders the block and trims trailing blank lines.
    // Newlines directly before </pre> render as nothing, so they carry no
    // difference signal.
    const text = textContent(node).replace(/\n+$/, '');
    return { tag: 'pre', attrs: {}, children: [{ tag: '#text', value: text }] };
  }
  // R10 companion: the highlight wrapper div is fully transparent — GitHub's
  // `<div class="highlight …"><pre>…</pre></div>` compares as the pre itself.
  const classes = node.attrs?.find((a) => a.name === 'class')?.value ?? '';
  if (node.tagName === 'div' && /(^|\s)highlight(\s|$)/.test(classes)) {
    const preChild = (node.childNodes ?? []).find((c) => c.nodeName === 'pre');
    if (preChild) return simplify(preChild);
    return { tag: 'div', attrs: {}, children: collectChildren(node) };
  }
  // R13: GitHub wraps some tables in its `<markdown-accessiblity-table>`
  // custom element (sic — the misspelling is GitHub's). A transparent
  // accessibility wrapper; the table itself is the rendering.
  if (node.tagName === 'markdown-accessiblity-table') {
    const tableChild = (node.childNodes ?? []).find((c) => c.nodeName === 'table');
    if (tableChild) return simplify(tableChild);
  }
  // R16: GitHub injects its Octicon SVGs into rendered chrome — most visibly
  // `<svg class="octicon …">` inside alert titles. OneMark deliberately omits
  // them (the vendored CSS styles the title identically). An svg whose class
  // marks it as an octicon is chrome, on either side.
  if (node.tagName === 'svg') {
    const cls = node.attrs?.find((a) => a.name === 'class')?.value ?? '';
    if (/(^|\s)octicon(\s|$)/.test(cls)) return null;
  }
  // R14: GitHub wraps lone images in presentation elements — autolinked image
  // URLs become `<a href><img></a>`, dark-mode art direction becomes
  // `<picture>`/`<themed-picture>`. The interactive/art-direction wrapper is
  // chrome; the image is the content. A wrapper whose meaningful content is
  // exactly one `<img>` (possibly through a nested wrapper) compares as that
  // image, on either side.
  if (node.tagName === 'a' || node.tagName === 'picture' || node.tagName === 'themed-picture') {
    const meaningful = (node.childNodes ?? []).filter((c) => {
      if (c.nodeName === 'source') return false; // art-direction variants
      if (c.nodeName === '#text') return !/^\s*$/.test(c.value ?? '');
      return true;
    });
    if (meaningful.length === 1 && meaningful[0].nodeName === 'img') {
      return simplify(meaningful[0]);
    }
    if (
      meaningful.length === 1 &&
      (meaningful[0].nodeName === 'picture' || meaningful[0].nodeName === 'themed-picture' || meaningful[0].nodeName === 'a')
    ) {
      const inner = simplify(meaningful[0]);
      if (inner && inner.tag === 'img') return inner;
    }
  }

  return {
    tag: node.tagName,
    attrs,
    children: collectChildren(node),
  };
}

/** Concatenated text of all #text descendants (used by the R10 collapse). */
function textContent(node) {
  if (node.nodeName === '#text') return node.value ?? '';
  return (node.childNodes ?? []).map(textContent).join('');
}

function collectChildren(node) {
  const out = [];
  for (const child of node.childNodes ?? []) {
    const simplified = simplify(child);
    if (simplified !== null) out.push(simplified);
  }
  // R19: a block-level lone image compares as a paragraph containing it.
  // GitHub's pipeline always wraps images in a paragraph; comrak can emit the
  // bare img when raw HTML and sanitiser interplay leaves one at block level.
  if (['#document', 'html', 'body', 'div', 'li', 'td', 'blockquote'].includes(node.nodeName ?? node.tag)) {
    for (let i = 0; i < out.length; i++) {
      if (out[i].tag === 'img') out[i] = { tag: 'p', attrs: {}, children: [out[i]] };
    }
  }
  // R21: GitHub's sanitiser removes empty raw anchors outright (e.g.
  // `<a id="…"></a>` used as manual anchors). An anchor with no meaningful
  // content compares as absent, on either side.
  const kept = out.filter((n) => {
    if (n.tag !== 'a') return true;
    const meaningful = (n.children ?? []).filter(
      (c) => !(c.tag === '#text' && /^\s*$/.test(c.value)),
    );
    return meaningful.length > 0;
  });
  // R21: GitHub's sanitiser removes empty raw anchors outright (e.g.
  // `<a id="…"></a>` used as manual anchors) and unwraps anchors left with no
  // attributes after sanitisation — a link with no href is not a link.
  const unwrappedAnchors = [];
  for (const n of kept) {
    if (n.tag === 'a' && Object.keys(n.attrs ?? {}).length === 0) unwrappedAnchors.push(...(n.children ?? []));
    else unwrappedAnchors.push(n);
  }
  // R27: `<abbr>` from raw HTML is unwrapped by GitHub's sanitiser (text
  // kept, element dropped). Compare it transparently, on either side.
  const unwrapped = [];
  for (const n of unwrappedAnchors) {
    if (n.tag === 'abbr') unwrapped.push(...(n.children ?? []));
    else unwrapped.push(n);
  }
  // Merge adjacent text nodes: unwrapping can leave neighbours whose
  // concatenated content is what both sides actually render.
  const merged = [];
  for (const n of unwrapped) {
    const last = merged[merged.length - 1];
    if (n.tag === '#text' && last?.tag === '#text') last.value += n.value;
    else merged.push(n);
  }
  // R26: GitHub's tables reach the API without `<colgroup>`; cmark emits one
  // for column alignment. Alignment itself is compared on the cells.
  if ((node.nodeName ?? node.tag) === 'table') {
    return merged.filter((n) => n.tag !== 'colgroup');
  }
  return merged;
}

/** Structural equality of two simplified trees. */
export function structuralDiff(a, b) {
  if ((a?.tag ?? null) !== (b?.tag ?? null)) return false;
  if (a.tag === '#text') return a.value === b.value;

  const keysA = Object.keys(a.attrs ?? {});
  const keysB = Object.keys(b.attrs ?? {});
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a.attrs[key] === b.attrs[key]) continue;
    // R3: camo hides the original URL, so a camo src equals any non-empty
    // remote src — "a remote image was here", nothing stronger.
    if (a.tag === 'img' && key === 'src' && (a.attrs[key] === '[camo]' || b.attrs[key] === '[camo]')) {
      if (a.attrs[key] && b.attrs[key]) continue;
    }
    return false;
  }

  const ca = a.children ?? [];
  const cb = b.children ?? [];
  if (ca.length !== cb.length) return false;
  for (let i = 0; i < ca.length; i++) {
    if (!structuralDiff(ca[i], cb[i])) return false;
  }
  return true;
}

/** Normalize GitHub-side or OneMark-side HTML before comparison. */
export function normalize(html) {
  return toComparable(stripR6(stripR1(html)));
}

/**
 * R1: GitHub injects `<a id="user-content-…" class="anchor">` into headings;
 * OneMark emits its own anchors by design (PRD §6.1). Anchors inside headings
 * are dropped from BOTH sides so neither implementation's choice leaks.
 */
function stripR1(html) {
  return html.replace(/<a\b[^>]*class="anchor"[^>]*>[\s\S]*?<\/a>/gi, '');
}

/**
 * R6: GitHub wraps some emoji in `<g-emoji>` presentation elements; unwrap to
 * the character itself on both sides.
 */
function stripR6(html) {
  return html.replace(/<g-emoji\b[^>]*>([\s\S]*?)<\/g-emoji>/gi, '$1');
}
