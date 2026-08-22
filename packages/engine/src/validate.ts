/**
 * Runtime validation of the AST contract.
 *
 * TypeScript types vanish at runtime, and the AST arrives as JSON from another
 * language. This is the guard that a Rust-side shape change cannot slip past
 * the TypeScript build unnoticed.
 */

import type { MarkdownNode } from './ast.js';

export interface AstProblem {
  path: string;
  message: string;
}

function checkPoint(value: unknown, path: string, problems: AstProblem[]): void {
  if (typeof value !== 'object' || value === null) {
    problems.push({ path, message: 'point must be an object' });
    return;
  }
  for (const key of ['line', 'column', 'offset'] as const) {
    const n = (value as Record<string, unknown>)[key];
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) {
      problems.push({ path: `${path}.${key}`, message: 'must be a non-negative integer' });
    }
  }
}

/**
 * Depth ceiling for validation.
 *
 * The engine caps AST depth (`MAX_DEPTH` in `onemark-engine`), so well-formed
 * input never approaches this. It exists because this function is the trust
 * boundary for JSON arriving from another language: a hand-crafted payload
 * nested tens of thousands deep would otherwise exhaust the JavaScript stack
 * here, turning a validation failure into a crash.
 */
const MAX_VALIDATION_DEPTH = 1_000;

function checkNode(value: unknown, path: string, problems: AstProblem[], depth = 0): void {
  if (depth > MAX_VALIDATION_DEPTH) {
    problems.push({ path, message: `nesting exceeds ${MAX_VALIDATION_DEPTH} levels` });
    return;
  }

  if (typeof value !== 'object' || value === null) {
    problems.push({ path, message: 'node must be an object' });
    return;
  }
  const node = value as Record<string, unknown>;

  if (typeof node['type'] !== 'string' || node['type'].length === 0) {
    problems.push({ path: `${path}.type`, message: 'must be a non-empty string' });
  }

  if (node['literal'] !== undefined && typeof node['literal'] !== 'string') {
    problems.push({ path: `${path}.literal`, message: 'must be a string when present' });
  }

  if (node['attrs'] !== undefined) {
    if (typeof node['attrs'] !== 'object' || node['attrs'] === null || Array.isArray(node['attrs'])) {
      problems.push({ path: `${path}.attrs`, message: 'must be an object when present' });
    } else {
      for (const [key, attr] of Object.entries(node['attrs'] as Record<string, unknown>)) {
        const ok =
          attr === null ||
          typeof attr === 'string' ||
          typeof attr === 'number' ||
          typeof attr === 'boolean';
        if (!ok) {
          problems.push({
            path: `${path}.attrs.${key}`,
            message: 'must be string | number | boolean | null',
          });
        }
      }
    }
  }

  if (node['position'] !== undefined) {
    const position = node['position'] as Record<string, unknown>;
    checkPoint(position?.['start'], `${path}.position.start`, problems);
    checkPoint(position?.['end'], `${path}.position.end`, problems);
  }

  if (node['children'] !== undefined) {
    if (!Array.isArray(node['children'])) {
      problems.push({ path: `${path}.children`, message: 'must be an array when present' });
    } else {
      // An empty `children` array is a contract violation: the engine omits the
      // key entirely for leaf nodes, and the renderer relies on that.
      if (node['children'].length === 0) {
        problems.push({ path: `${path}.children`, message: 'must be omitted rather than empty' });
      }
      node['children'].forEach((child, i) =>
        checkNode(child, `${path}.children[${i}]`, problems, depth + 1),
      );
    }
  }
}

/** Returns every way `value` fails the AST contract. Empty means valid. */
export function isValidAst(value: unknown): AstProblem[] {
  const problems: AstProblem[] = [];
  checkNode(value, '$', problems);
  return problems;
}

/** Narrows `value` to `MarkdownNode`, throwing with every problem listed. */
export function assertValidAst(value: unknown): asserts value is MarkdownNode {
  const problems = isValidAst(value);
  if (problems.length > 0) {
    const detail = problems.map((p) => `  ${p.path}: ${p.message}`).join('\n');
    throw new Error(`AST does not satisfy the contract:\n${detail}`);
  }
}
