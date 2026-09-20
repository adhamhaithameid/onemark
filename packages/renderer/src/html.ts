/**
 * AST → semantic HTML.
 *
 * Modelled on `cmark`'s `html.c`, deliberately. Metric M3 compares byte-for-byte
 * against the CommonMark spec suite, and the reference implementation's exact
 * newline placement is part of what it compares. The `cr()` helper below is that
 * behaviour: emit a newline only if the buffer does not already end with one.
 *
 * Semantic HTML is a requirement, not a preference (NFR-4) — screen readers need
 * real elements, so there is no `div` anywhere in this file.
 *
 * **This renderer does not sanitise.** Raw HTML from the document is emitted
 * verbatim. The sanitiser is a separate pass (NFR-2, task 1.3) and must run
 * before any of this reaches a DOM.
 */

import type { MarkdownNode } from '@onemark/engine';

import { escapeHtml, escapeHref } from './escape.js';
import { replaceEmoji } from './emoji.js';
import type { SyntaxHighlighter } from './highlight.js';
import { filterDisallowedTags } from './tagfilter.js';
import { isSafeUrl } from './url-policy.js';

export interface RenderOptions {
  /**
   * Restrict `href` and `src` to safe schemes (see `url-policy.ts`).
   *
   * **On by default**, because the default must be the safe one. The conformance
   * suites turn it off: CommonMark and GFM specify a *parser*, and both require
   * that exotic schemes such as `made-up-scheme://foo` survive in the output.
   * Measuring a specification and rendering a document for a reader are
   * different jobs, and this flag is where they part company.
   */
  urlPolicy: boolean;

  /**
   * GFM's "Disallowed Raw HTML" extension. In GFM this is a *render*-time filter,
   * not a parse-time one, so it lives here rather than in `ParseOptions`.
   *
   * It is not a security control — it blocks nine tag names and nothing else.
   * The sanitiser (NFR-2, task 1.3) is the security control.
   */
  tagfilter: boolean;

  /**
   * Bundled syntax highlighter (task 1.5). Optional by contract: the
   * conformance suites omit it and get the byte-exact escaped output; the app
   * initialises one adapter at startup and passes it on every render.
   * `null` from the adapter (unknown language) also falls back to escaping.
   */
  highlighter?: SyntaxHighlighter;

  /** Which vendored theme token colours come from. Ignored without a highlighter. */
  theme?: 'light' | 'dark';

  /**
   * GitHub-style heading anchors (task 1.8): `user-content-` ids plus an
   * empty `.anchor` link. **Off by default** on the raw path — the conformance
   * suites compare byte-for-byte and the specs have no anchors. The safe path
   * forces this on; a document viewer wants them.
   */
  headingAnchors?: boolean;

  /**
   * GitHub renders single newlines inside paragraphs as `<br>` — in .md file
   * rendering and in the POST /markdown oracle alike (soft break → hard break
   * is GFM file behaviour, unlike bare CommonMark). **Off by default**: the
   * conformance suites require cmark's `\n`. The safe path forces this on.
   */
  softBreakAsBr?: boolean;
}

const DEFAULTS: RenderOptions = { tagfilter: true, urlPolicy: true };

interface Ctx {
  out: Emitter;
  options: RenderOptions;
  /** Column alignments of the table currently being rendered, if any. */
  alignments: string[];
  /**
   * Footnote name → its number, assigned by document order of first reference.
   *
   * Numbering lives here rather than in the AST because it is a render concern:
   * it depends on the order references appear, and the engine does not resolve
   * it at parse time.
   */
  footnoteNumbers: Map<string, number>;
  /** Slug → times seen, for GitHub's `-1`/`-2` heading-anchor dedup. */
  slugCounts: Map<string, number>;
}

/**
 * GitHub's slug rule: lowercase, drop punctuation (each removed character
 * leaves its surrounding spaces intact — hence `install--setup` for
 * "Install & Setup!"), then spaces become hyphens. Duplicates get `-1`, `-2`.
 */
function slugFor(text: string, ctx: Ctx): string {
  const base =
    text
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/\s/g, '-') || 'section';
  const seen = ctx.slugCounts.get(base) ?? 0;
  ctx.slugCounts.set(base, seen + 1);
  return seen === 0 ? base : `${base}-${seen}`;
}

/** Assigns footnote numbers by the order references first appear in the document. */
function numberFootnotes(root: MarkdownNode): Map<string, number> {
  const numbers = new Map<string, number>();
  const visit = (node: MarkdownNode): void => {
    if (node.type === 'footnote_reference') {
      const name = node.attrs?.['name'];
      if (typeof name === 'string' && !numbers.has(name)) numbers.set(name, numbers.size + 1);
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(root);
  return numbers;
}

class Emitter {
  private buf = '';

  lit(text: string): void {
    this.buf += text;
  }

  /** Newline, but only if we are not already at the start of one. */
  cr(): void {
    if (this.buf.length > 0 && !this.buf.endsWith('\n')) this.buf += '\n';
  }

  toString(): string {
    return this.buf;
  }
}

/** Attribute string for a list's `start`, omitted when it is the default. */
function orderedStart(node: MarkdownNode): string {
  const start = node.attrs?.['start'];
  return typeof start === 'number' && start !== 1 ? ` start="${start}"` : '';
}

/**
 * Whether a paragraph should render without `<p>` tags.
 *
 * A paragraph is "tight" when its grandparent list is tight — the same rule
 * `cmark` applies, and the reason the AST carries `tight` on list nodes.
 */
function isTight(ancestors: MarkdownNode[]): boolean {
  const parent = ancestors[ancestors.length - 1];
  if (!parent || (parent.type !== 'item' && parent.type !== 'task_item')) return false;
  const list = ancestors[ancestors.length - 2];
  return list?.type === 'list' && list.attrs?.['tight'] === true;
}

/** Plain-text content of a subtree — used for an image's `alt`. */
function plainText(node: MarkdownNode): string {
  let out = '';
  const visit = (n: MarkdownNode): void => {
    if (n.type === 'text' || n.type === 'code') out += n.literal ?? '';
    for (const child of n.children ?? []) visit(child);
  };
  for (const child of node.children ?? []) visit(child);
  return out;
}

function renderChildren(node: MarkdownNode, ctx: Ctx, ancestors: MarkdownNode[]): void {
  const next = [...ancestors, node];
  for (const child of node.children ?? []) render(child, ctx, next);
}

/**
 * Tables are rendered as a unit rather than node-by-node: a cell's alignment
 * comes from its *column index*, which a child node cannot know on its own.
 */
function renderTable(node: MarkdownNode, ctx: Ctx, ancestors: MarkdownNode[]): void {
  const { out } = ctx;
  const alignments = String(node.attrs?.['alignments'] ?? '').split(',');
  const rows = node.children ?? [];
  const header = rows.filter((r) => r.attrs?.['header'] === true);
  const body = rows.filter((r) => r.attrs?.['header'] !== true);

  const renderRow = (row: MarkdownNode, cellTag: 'th' | 'td'): void => {
    out.cr();
    out.lit('<tr>');
    out.cr();
    (row.children ?? []).forEach((cell, index) => {
      const align = alignments[index];
      const attr = align && align !== 'none' ? ` align="${align}"` : '';
      out.lit(`<${cellTag}${attr}>`);
      renderChildren(cell, ctx, [...ancestors, node, row]);
      out.lit(`</${cellTag}>`);
      out.cr();
    });
    out.lit('</tr>');
    out.cr();
  };

  out.cr();
  out.lit('<table>');
  out.cr();

  if (header.length > 0) {
    out.lit('<thead>');
    for (const row of header) renderRow(row, 'th');
    out.lit('</thead>');
    out.cr();
  }

  // A header-only table gets no `<tbody>` at all, matching cmark-gfm.
  if (body.length > 0) {
    out.lit('<tbody>');
    for (const row of body) renderRow(row, 'td');
    out.lit('</tbody>');
    out.cr();
  }

  out.lit('</table>');
  out.cr();
}

function render(node: MarkdownNode, ctx: Ctx, ancestors: MarkdownNode[]): void {
  const { out } = ctx;
  const attrs = node.attrs ?? {};

  switch (node.type) {
    case 'document': {
      // Footnote definitions are document-level siblings in the AST, but GitHub
      // renders them collected into a single section at the end regardless of
      // where they appeared in the source.
      const kids = node.children ?? [];
      const definitions = kids.filter((c) => c.type === 'footnote_definition');
      const body = kids.filter((c) => c.type !== 'footnote_definition');

      const next = [...ancestors, node];
      for (const child of body) render(child, ctx, next);
      if (definitions.length > 0) renderFootnoteSection(definitions, ctx, next);
      break;
    }

    case 'paragraph': {
      const tight = isTight(ancestors);
      if (!tight) {
        out.cr();
        out.lit('<p>');
      }
      renderChildren(node, ctx, ancestors);
      if (!tight) {
        out.lit('</p>');
        out.cr();
      }
      break;
    }

    case 'heading': {
      const level = typeof attrs['level'] === 'number' ? attrs['level'] : 1;
      out.cr();
      if (ctx.options.headingAnchors === true) {
        const slug = slugFor(plainText(node), ctx);
        out.lit(`<h${level} id="user-content-${escapeHtml(slug)}">`);
        out.lit(`<a class="anchor" href="#${escapeHref(slug)}" aria-hidden="true"></a>`);
        renderChildren(node, ctx, ancestors);
      } else {
        out.lit(`<h${level}>`);
        renderChildren(node, ctx, ancestors);
      }
      out.lit(`</h${level}>`);
      out.cr();
      break;
    }

    case 'block_quote':
      out.cr();
      out.lit('<blockquote>');
      out.cr();
      renderChildren(node, ctx, ancestors);
      out.cr();
      out.lit('</blockquote>');
      out.cr();
      break;

    case 'list': {
      const ordered = attrs['list_type'] === 'ordered';
      out.cr();
      out.lit(ordered ? `<ol${orderedStart(node)}>` : '<ul>');
      out.cr();
      renderChildren(node, ctx, ancestors);
      out.cr();
      out.lit(ordered ? '</ol>' : '</ul>');
      out.cr();
      break;
    }

    case 'item':
      out.cr();
      out.lit('<li>');
      renderChildren(node, ctx, ancestors);
      out.lit('</li>');
      out.cr();
      break;

    case 'task_item': {
      // Attribute order and the self-closing slash follow cmark-gfm, which is the
      // engine GitHub runs — not the GFM spec prose, which disagrees and which
      // upstream disables in its own test suite. See fidelity/spec/README.md.
      const checked = attrs['checked'] === true ? ' checked=""' : '';
      out.cr();
      out.lit('<li>');
      out.lit(`<input type="checkbox"${checked} disabled="" /> `);
      renderChildren(node, ctx, ancestors);
      out.lit('</li>');
      out.cr();
      break;
    }

    case 'footnote_reference': {
      const name = typeof attrs['name'] === 'string' ? attrs['name'] : '';
      const num = ctx.footnoteNumbers.get(name) ?? 1;
      out.lit(
        `<sup class="footnote-ref"><a href="#fn-${escapeHref(name)}" id="fnref-${escapeHtml(name)}" data-footnote-ref>${num}</a></sup>`,
      );
      break;
    }

    case 'footnote_definition':
      // Reached only if a definition escapes the document-level collection above.
      renderChildren(node, ctx, ancestors);
      break;

    case 'strikethrough':
      out.lit('<del>');
      renderChildren(node, ctx, ancestors);
      out.lit('</del>');
      break;

    case 'table':
      renderTable(node, ctx, ancestors);
      break;

    case 'table_row':
    case 'table_cell':
      // Reached only if a row or cell appears outside a table, which the parser
      // does not produce. Rendering children keeps content visible.
      renderChildren(node, ctx, ancestors);
      break;

    case 'code_block': {
      const lang = typeof attrs['lang'] === 'string' ? attrs['lang'] : '';

      // Mermaid is client-side by nature: emit a standard fenced-code block
      // (GitHub's static HTML also ships the source, tokenised as
      // highlight-source-mermaid) and let the app hydrate it with the bundled
      // mermaid at securityLevel 'strict' (see mermaid.ts). Keeping the
      // block-shaped DOM makes the pre-hydration shape match GitHub's.
      if (lang === 'mermaid') {
        out.cr();
        out.lit('<pre><code class="language-mermaid">');
        out.lit(escapeHtml(node.literal ?? ''));
        out.lit('</code></pre>');
        out.cr();
        break;
      }

      out.cr();
      out.lit(lang ? `<pre><code class="language-${escapeHtml(lang)}">` : '<pre><code>');
      const highlighted =
        ctx.options.highlighter && lang
          ? ctx.options.highlighter.highlight(
              node.literal ?? '',
              lang,
              ctx.options.theme ?? 'light',
            )
          : null;
      if (highlighted !== null) {
        // Token markup is escaped inside the adapter; emit as-is.
        out.lit(highlighted);
      } else {
        out.lit(escapeHtml(node.literal ?? ''));
      }
      out.lit('</code></pre>');
      out.cr();
      break;
    }

    case 'math': {
      // Inert placeholder; renderToSafeHtml hydrates it with KaTeX *after*
      // sanitisation (KaTeX needs inline styles/MathML the allowlist must keep
      // forbidding for document content). The unsafe path leaves it visible.
      const display = attrs['display'] === true;
      const cls = display ? 'onemark-math onemark-math-display' : 'onemark-math';
      out.lit(`<span class="${cls}">${escapeHtml(node.literal ?? '')}</span>`);
      break;
    }

    case 'alert': {
      // GitHub's alert structure — the vendored theme CSS keys on these exact
      // classes. The octicon inside GitHub's title is presentational and is
      // deliberately omitted (an empty title paragraph styles identically).
      const kind = typeof attrs['alert_type'] === 'string' ? attrs['alert_type'] : 'note';
      const title = kind.charAt(0).toUpperCase() + kind.slice(1);
      out.cr();
      out.lit(`<div class="markdown-alert markdown-alert-${escapeHtml(kind)}">`);
      out.cr();
      out.lit(`<p class="markdown-alert-title">${title}</p>`);
      renderChildren(node, ctx, ancestors);
      out.cr();
      out.lit('</div>');
      out.cr();
      break;
    }

    case 'frontmatter': {
      // GitHub renders YAML front matter in .md files as a key→value table.
      // Flat `key: value` documents get that table; anything nested falls back
      // to a visible pre block rather than pretending to parse YAML here.
      const raw = node.literal ?? '';
      const body = raw.replace(/^---\s*\n/, '').replace(/\n---\s*$/, '');
      const lines = body.split('\n').filter((l) => l.trim().length > 0);
      const flat = lines.filter((l) => /^[^\s:#][^:]*:\s+\S/.test(l));
      out.cr();
      if (lines.length > 0 && flat.length === lines.length) {
        const rows = flat.map((l) => {
          const i = l.indexOf(':');
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()] as const;
        });
        out.lit('<table>');
        out.cr();
        out.lit('<thead>');
        for (const [key] of rows) out.lit(`<th>${escapeHtml(key)}</th>`);
        out.lit('</thead>');
        out.cr();
        out.lit('<tbody><tr>');
        for (const [, value] of rows) out.lit(`<td>${escapeHtml(value)}</td>`);
        out.lit('</tr></tbody>');
        out.cr();
        out.lit('</table>');
      } else {
        out.lit('<pre class="onemark-frontmatter">');
        out.lit(escapeHtml(body));
        out.lit('</pre>');
      }
      out.cr();
      break;
    }

    case 'html_block':
      out.cr();
      out.lit(applyTagfilter(node.literal ?? '', ctx));
      out.cr();
      break;

    case 'thematic_break':
      out.cr();
      out.lit('<hr />');
      out.cr();
      break;

    case 'text':
      out.lit(escapeHtml(replaceEmoji(node.literal ?? '')));
      break;

    case 'soft_break':
      out.lit(ctx.options.softBreakAsBr ? '<br />\n' : '\n');
      break;

    case 'line_break':
      out.lit('<br />');
      out.cr();
      break;

    case 'code':
      out.lit('<code>');
      out.lit(escapeHtml(node.literal ?? ''));
      out.lit('</code>');
      break;

    case 'emph':
      out.lit('<em>');
      renderChildren(node, ctx, ancestors);
      out.lit('</em>');
      break;

    case 'strong':
      out.lit('<strong>');
      renderChildren(node, ctx, ancestors);
      out.lit('</strong>');
      break;

    case 'link': {
      const url = typeof attrs['url'] === 'string' ? attrs['url'] : '';
      const title = typeof attrs['title'] === 'string' ? attrs['title'] : '';
      // An unsafe scheme costs the destination, not the text: the anchor stays
      // so the document still reads, but it no longer goes anywhere.
      const linkOk = !ctx.options.urlPolicy || isSafeUrl(url, 'link');
      out.lit(linkOk ? `<a href="${escapeHref(url)}"` : '<a');
      if (title) out.lit(` title="${escapeHtml(title)}"`);
      out.lit('>');
      renderChildren(node, ctx, ancestors);
      out.lit('</a>');
      break;
    }

    case 'image': {
      const url = typeof attrs['url'] === 'string' ? attrs['url'] : '';
      const title = typeof attrs['title'] === 'string' ? attrs['title'] : '';
      // Dropping only `src` keeps the alt text, which is the accessible content
      // (NFR-4) and is what a reader actually loses if the image is refused.
      const imageOk = !ctx.options.urlPolicy || isSafeUrl(url, 'image');
      const src = imageOk ? ` src="${escapeHref(url)}"` : '';
      out.lit(`<img${src} alt="${escapeHtml(plainText(node))}"`);
      if (title) out.lit(` title="${escapeHtml(title)}"`);
      out.lit(' />');
      break;
    }

    case 'truncated': {
      // The engine refused this subtree for exceeding its depth limit. Say so in
      // the output: silently dropping content is how a fidelity tool loses trust.
      const limit = attrs['limit'];
      out.lit(
        `<span class="onemark-truncated" title="Content nested deeper than ${escapeHtml(String(limit ?? ''))} levels was not rendered">…</span>`,
      );
      break;
    }

    case 'html_inline':
    case 'raw':
      out.lit(applyTagfilter(node.literal ?? '', ctx));
      break;

    default:
      // Nodes outside CommonMark — GFM extensions and GitHub specifics — arrive
      // in task 1.2. Rendering their children keeps content visible rather than
      // silently dropping it while that work is outstanding.
      renderChildren(node, ctx, ancestors);
      break;
  }
}

/**
 * Renders the trailing footnote section, matching cmark-gfm's markup.
 *
 * The backref anchor is emitted *inside* the definition's last paragraph rather
 * than after it — that placement is GitHub's, and it is what makes the arrow sit
 * on the same line as the note text.
 *
 * **Known limitation:** a footnote referenced more than once gets one backref
 * here, where GitHub emits one per reference with `-2`, `-3` suffixed ids. The
 * AST does not currently carry the per-reference index needed for that. Covered
 * by a test that documents the divergence rather than hiding it; M5 arbitrates.
 */
function renderFootnoteSection(definitions: MarkdownNode[], ctx: Ctx, ancestors: MarkdownNode[]): void {
  const { out } = ctx;

  out.cr();
  out.lit('<section class="footnotes" data-footnotes>');
  out.cr();
  out.lit('<ol>');
  out.cr();

  // GitHub orders the section by first-reference order, not source order.
  // Definitions that are never referenced keep their relative position at the end.
  const ordered = [...definitions].sort((a, b) => {
    const rank = (d: MarkdownNode): number => {
      const name = d.attrs?.['name'];
      return typeof name === 'string'
        ? (ctx.footnoteNumbers.get(name) ?? Number.MAX_SAFE_INTEGER)
        : Number.MAX_SAFE_INTEGER;
    };
    return rank(a) - rank(b);
  });

  ordered.forEach((definition, position) => {
    const name = typeof definition.attrs?.['name'] === 'string' ? definition.attrs['name'] : '';
    const index = ctx.footnoteNumbers.get(name) ?? position + 1;

    out.cr();
    out.lit(`<li id="fn-${escapeHtml(name)}">`);
    out.cr();

    const kids = definition.children ?? [];
    const backref =
      ` <a href="#fnref-${escapeHref(name)}" class="footnote-backref" data-footnote-backref` +
      ` data-footnote-backref-idx="${index}" aria-label="Back to reference ${index}">\u21a9</a>`;

    kids.forEach((child, i) => {
      const isLastParagraph = i === kids.length - 1 && child.type === 'paragraph';
      if (!isLastParagraph) {
        render(child, ctx, [...ancestors, definition]);
        return;
      }
      out.cr();
      out.lit('<p>');
      renderChildren(child, ctx, [...ancestors, definition]);
      out.lit(backref);
      out.lit('</p>');
      out.cr();
    });

    out.lit('</li>');
    out.cr();
  });

  out.lit('</ol>');
  out.cr();
  out.lit('</section>');
  out.cr();
}

function applyTagfilter(literal: string, ctx: Ctx): string {
  return ctx.options.tagfilter ? filterDisallowedTags(literal) : literal;
}

/** Renders an AST to HTML. The output is **unsanitised** — see the module note. */
export function renderToUnsafeHtml(root: MarkdownNode, options: Partial<RenderOptions> = {}): string {
  const ctx: Ctx = {
    out: new Emitter(),
    options: { ...DEFAULTS, ...options },
    alignments: [],
    footnoteNumbers: numberFootnotes(root),
    slugCounts: new Map(),
  };
  render(root, ctx, []);
  return ctx.out.toString();
}

/**
 * Renders the document as an array of **top-level block** HTML strings —
 * the sanitiser-chunked render path (perf ladder rung 2). DOMPurify's cost is
 * super-linear in input size, so sanitising N small blocks beats sanitising
 * one large string.
 *
 * Equivalence with `renderToUnsafeHtml` is a tested invariant: concatenating
 * the blocks reproduces the whole-document render byte-for-byte across the
 * CommonMark and GFM corpora (`test/chunked.test.ts`). Footnote definitions —
 * which the document renderer collects into one trailing section — stay one
 * block so the section is never split.
 */
export function renderToUnsafeBlocks(root: MarkdownNode, options: Partial<RenderOptions> = {}): string[] {
  const ctx: Ctx = {
    out: new Emitter(),
    options: { ...DEFAULTS, ...options },
    alignments: [],
    footnoteNumbers: numberFootnotes(root),
    slugCounts: new Map(),
  };
  const kids = root.children ?? [];
  const definitions = kids.filter((c) => c.type === 'footnote_definition');
  const body = kids.filter((c) => c.type !== 'footnote_definition');
  const next = [...ancestorsOf(root), root];

  const blocks: string[] = [];
  for (const child of body) {
    ctx.out = new Emitter();
    render(child, ctx, next);
    blocks.push(ctx.out.toString());
  }
  if (definitions.length > 0) {
    ctx.out = new Emitter();
    renderFootnoteSection(definitions, ctx, next);
    blocks.push(ctx.out.toString());
  }
  return blocks;
}

/** The document node itself contributes no ancestors beyond itself. */
function ancestorsOf(root: MarkdownNode): MarkdownNode[] {
  return root.type === 'document' ? [] : [];
}

/**
 * Concatenates rendered blocks exactly as the whole-document renderer would:
 * a newline between blocks only when the preceding one did not already end
 * with one (the `cr()` discipline). `joinBlocks(renderToUnsafeBlocks(root))`
 * is byte-equal to `renderToUnsafeHtml(root)` — tested across the corpora.
 */
export function joinBlocks(blocks: string[]): string {
  let out = '';
  for (const block of blocks) {
    if (out.length > 0 && !out.endsWith('\n')) out += '\n';
    out += block;
  }
  return out;
}
