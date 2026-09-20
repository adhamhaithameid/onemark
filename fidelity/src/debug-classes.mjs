#!/usr/bin/env node
/**
 * Classifies the FIRST structural difference of every differing document into
 * pattern buckets, so systematic issues surface as big classes instead of
 * one-at-a-time whack-a-mole. Diagnostic only.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize } from './normalize.mjs';
import { loadNodeEngine } from '@onemark/engine/node';
import { renderToSafeHtml } from '@onemark/renderer';
import { JSDOM } from 'jsdom';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dom = new JSDOM('');
const engine = await loadNodeEngine();
const GFM_OPTIONS = {
  dialect: 'gfm',
  extensions: { tables: true, strikethrough: true, autolink: true, taskList: true, footnotes: true, alerts: true, math: true, frontmatter: true },
};

/** First tag/attr difference as a compact class string. */
function firstClass(x, y, depth) {
  if ((x?.tag ?? null) !== (y?.tag ?? null)) return `tag:${x?.tag}<->${y?.tag}`;
  if (x.tag === '#text') return null;
  const ax = x.attrs ?? {}, ay = y.attrs ?? {};
  for (const k of Object.keys(ax)) if (!(k in ay)) return `attr-missing-theirs:${x.tag}@${k}`;
  for (const k of Object.keys(ay)) if (!(k in ax)) return `attr-missing-ours:${x.tag}@${k}`;
  for (const k of Object.keys(ax)) { if (ax[k] !== ay[k]) { if (x.tag === 'img' && k === 'src' && (ax[k] === '[camo]' || ay[k] === '[camo]')) continue; return `attr-value:${x.tag}@${k}`; } }
  const ca = x.children ?? [], cb = y.children ?? [];
  if (ca.length !== cb.length) return `child-count:${x.tag}(${ca.length}v${cb.length})`;
  if (depth > 12) return 'too-deep';
  for (let i = 0; i < ca.length; i++) {
    const c = firstClass(ca[i], cb[i], depth + 1);
    if (c) return c;
  }
  return null;
}

function preTextIndex(tree) {
  const out = [];
  (function walk(n, path) {
    if (n.tag === 'pre') out.push([path, n.children[0]?.value ?? '']);
    (n.children ?? []).forEach((c, i) => walk(c, `${path}/${n.tag}[${i}]`));
  })(tree, '');
  return out;
}

const histogram = new Map();
const examples = new Map();
const files = readdirSync(join(root, 'golden')).filter((f) => f.endsWith('.html'));

for (const file of files) {
  const id = file.replace(/\.html$/, '');
  const sourcePath = join(root, 'corpus', `${id}.md`);
  let source;
  try { source = readFileSync(sourcePath, 'utf8'); } catch { continue; }
  if (source.startsWith('---\n')) continue; // known gap, excluded from gate
  const ast = await engine.parse(source, GFM_OPTIONS);
  const ours = renderToSafeHtml(ast, { window: dom.window });
  const theirs = readFileSync(join(root, 'golden', file), 'utf8');
  const a = normalize(ours);
  const b = normalize(theirs);
  const cls = firstClass(a, b, 0) ?? 'EQUAL';
  histogram.set(cls, (histogram.get(cls) ?? 0) + 1);
  if (!examples.has(cls)) examples.set(cls, { id, a, b });
}

for (const [cls, count] of [...histogram.entries()].sort((x, y) => y[1] - x[1])) {
  console.log(`${String(count).padStart(3)}  ${cls}   e.g. ${examples.get(cls).id}`);
}
