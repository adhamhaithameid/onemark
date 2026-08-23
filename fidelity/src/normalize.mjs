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

  const attrs = {};
  for (const attr of node.attrs ?? []) {
    let name = attr.name;
    let value = attr.value;
    if (name === 'dir') continue; // R2: bidirectional-text hints are chrome
    // R1 companion: GitHub prefixes heading ids with `user-content-`; OneMark
    // does the same by design, so the prefix carries no difference signal.
    if (name === 'id' && value.startsWith('user-content-')) continue;
    // R3: camo-proxied images compare as "a remote image was here".
    if (node.tagName === 'img' && name === 'src' && /https:\/\/camo\.githubusercontent\.com\//.test(value)) {
      value = '[camo]';
    }
    // R5: bare boolean attributes arrive with empty-string values in parse5.
    attrs[name] = value;
  }

  return {
    tag: node.tagName,
    attrs,
    children: collectChildren(node),
  };
}

function collectChildren(node) {
  const out = [];
  for (const child of node.childNodes ?? []) {
    const simplified = simplify(child);
    if (simplified !== null) out.push(simplified);
  }
  return out;
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
