/**
 * OneMark's AST — the contract (tech spec §3, ADR-0005).
 *
 * These types mirror `crates/onemark-engine` field for field. The Rust crate
 * emits JSON that deserialises directly into `MarkdownNode`; `test/contract.test.ts`
 * asserts that against fixtures produced by the real engine, so the two halves
 * cannot drift apart silently.
 */

/** Node names OneMark's engine emits. Deliberately ours, not comrak's (ADR-0002). */
export type NodeType =
  // structure
  | 'document'
  | 'paragraph'
  | 'heading'
  | 'block_quote'
  | 'thematic_break'
  | 'frontmatter'
  // lists
  | 'list'
  | 'item'
  | 'task_item'
  // code
  | 'code'
  | 'code_block'
  // tables (GFM)
  | 'table'
  | 'table_row'
  | 'table_cell'
  // inline
  | 'text'
  | 'soft_break'
  | 'line_break'
  | 'emph'
  | 'strong'
  | 'strikethrough'
  | 'superscript'
  | 'escaped'
  | 'link'
  | 'image'
  // GitHub specifics
  | 'alert'
  | 'math'
  | 'footnote_definition'
  | 'footnote_reference'
  /**
   * Marks a subtree the engine refused to convert because it exceeded
   * `MAX_DEPTH`. Emitted instead of dropping content silently, so a truncated
   * render is visible rather than looking like a rendering bug.
   */
  | 'truncated'
  // raw HTML — always sanitised render-side (NFR-2)
  | 'html_block'
  | 'html_inline'
  | 'raw'
  // reachable only if a non-v1 dialect is enabled (ADR-0008)
  | 'description_list'
  | 'description_item'
  | 'description_term'
  | 'description_details'
  | 'highlight'
  | 'underline'
  | 'subscript'
  | 'spoiler'
  | 'subtext'
  | 'escaped_tag'
  | 'wikilink';

export type AttrValue = string | number | boolean | null;

export interface Point {
  /** 1-based. */
  line: number;
  /** 1-based. */
  column: number;
  /** Byte offset from the start of the document. */
  offset: number;
}

export interface Span {
  start: Point;
  end: Point;
}

export interface MarkdownNode {
  type: NodeType;
  children?: MarkdownNode[];
  literal?: string;
  attrs?: Record<string, AttrValue>;
  position?: Span;
}

/** The five GitHub alert kinds, as carried on an `alert` node's `alert_type`. */
export type AlertType = 'note' | 'tip' | 'important' | 'warning' | 'caution';

/** Depth-first walk, parents before children. */
export function walk(node: MarkdownNode, visit: (node: MarkdownNode) => void): void {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

/** First node of a given type, or `undefined`. */
export function find(node: MarkdownNode, type: NodeType): MarkdownNode | undefined {
  if (node.type === type) return node;
  for (const child of node.children ?? []) {
    const hit = find(child, type);
    if (hit) return hit;
  }
  return undefined;
}
