#!/usr/bin/env node
/**
 * Dumps the ours/theirs subtrees at the first tag-level mismatch, for triage.
 * Diagnostic only.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize } from './normalize.mjs';
import { loadNodeEngine } from '@onemark/engine/node';
import { renderToSafeHtml } from '@onemark/renderer';
import { JSDOM } from 'jsdom';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const id = process.argv[2];

const manifest = JSON.parse(readFileSync(join(root, 'corpus', 'manifest.json'), 'utf8'));
const doc = manifest.documents.find((d) => d.id === id) ?? manifest.documents[0];
const source = readFileSync(join(root, 'corpus', `${doc.id}.md`), 'utf8');
const golden = readFileSync(join(root, 'golden', `${doc.id}.html`), 'utf8');

const engine = await loadNodeEngine();
const ast = await engine.parse(source, {
  dialect: 'gfm',
  extensions: { tables: true, strikethrough: true, autolink: true, taskList: true, footnotes: true, alerts: true, math: true, frontmatter: true },
});
const dom = new JSDOM('');
const ours = renderToSafeHtml(ast, { window: dom.window });

const a = normalize(ours);
const b = normalize(golden);

function findTagMismatch(x, y, path) {
  if ((x?.tag ?? null) !== (y?.tag ?? null)) return { x, y, path };
  if (x.tag === '#text') return null;
  const ca = x.children ?? [], cb = y.children ?? [];
  if (ca.length !== cb.length) return { x, y, path, childCount: true };
  for (let i = 0; i < ca.length; i++) {
    const hit = findTagMismatch(ca[i], cb[i], `${path}/${x.tag}[${i}]`);
    if (hit) return hit;
  }
  return null;
}

function brief(node, depth = 0) {
  if (!node) return '·';
  const pad = '  '.repeat(depth);
  if (node.tag === '#text') return `${pad}"${node.value.slice(0, 80)}"`;
  const attrs = Object.entries(node.attrs ?? {}).map(([k, v]) => `${k}="${String(v).slice(0, 40)}"`).join(' ');
  const lines = [`${pad}<${node.tag} ${attrs}>`];
  if (depth < 4) for (const c of (node.children ?? []).slice(0, 6)) lines.push(brief(c, depth + 1));
  if ((node.children ?? []).length > 6) lines.push(`${pad}  …+${node.children.length - 6} children`);
  return lines.join('\n');
}

const hit = findTagMismatch(a, b, '');
if (!hit) {
  console.log('no tag mismatch (attrs or child counts only)');
} else {
  console.log(`MISMATCH at ${hit.path}${hit.childCount ? ' (child count)' : ''}`);
  console.log('--- OURS ---\n' + brief(hit.x));
  console.log('--- THEIRS ---\n' + brief(hit.y));
}
