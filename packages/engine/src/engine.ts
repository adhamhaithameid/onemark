/**
 * The `MarkdownEngine` interface (tech spec §3).
 *
 * This is the seam ADR-0002 exists to protect: any parser satisfying it can be
 * swapped in without the renderer or the UI noticing. Nothing about HTML,
 * themes, highlighting or diagrams belongs here — those live in the renderer.
 */

import type { MarkdownNode } from './ast.js';

export interface ParseOptions {
  /** GFM in v1. Additional profiles are ADR-0008 / v2. */
  dialect: 'gfm';
  extensions: {
    tables: boolean;
    strikethrough: boolean;
    autolink: boolean;
    taskList: boolean;
    footnotes: boolean;
    /** `> [!NOTE]` — native to the engine, resolved as OQ-3. */
    alerts: boolean;
    /** `$…$` / `$$…$$` delimiters only; typesetting is renderer-side. */
    math: boolean;
    frontmatter: boolean;
  };
}

export interface MarkdownEngine {
  readonly id: string;
  readonly version: string;
  parse(source: string, options: ParseOptions): Promise<MarkdownNode>;
}

/** The v1 configuration: GFM with every extension the done-line requires. */
export const GFM_OPTIONS: ParseOptions = {
  dialect: 'gfm',
  extensions: {
    tables: true,
    strikethrough: true,
    autolink: true,
    taskList: true,
    footnotes: true,
    alerts: true,
    math: true,
    frontmatter: true,
  },
};
