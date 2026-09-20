#!/usr/bin/env node
/**
 * Debug harness for a single corpus document: walks both normalized trees in
 * parallel and prints the first differing paths. Diagnostic only.
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
const limit = Number(process.argv[3] ?? 10);

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

/** Collect the first `limit` mismatching paths between two comparable trees. */
function firstDiffs(x, y, path, out) {
  if (out.length >= limit) return;
  if ((x?.tag ?? null) !== (y?.tag ?? null)) {
    out.push(`${path || '/'}: tag <${x?.tag}> vs <${y?.tag}>`);
    return;
  }
  if (x.tag === '#text') {
    if (x.value !== y.value) out.push(`${path}: text ${JSON.stringify(x.value.slice(0, 60))} vs ${JSON.stringify(y.value.slice(0, 60))}`);
    return;
  }
  const ax = x.attrs ?? {}, ay = y.attrs ?? {};
  for (const k of Object.keys(ax)) if (!(k in ay)) { out.push(`${path}<${x.tag}>: attr [${k}="${ax[k]}"] missing on theirs`); if (out.length >= limit) return; }
  for (const k of Object.keys(ay)) if (!(k in ax)) { out.push(`${path}<${x.tag}>: attr [${k}="${ay[k]}"] missing on ours`); if (out.length >= limit) return; }
  for (const k of Object.keys(ax)) if (k in ay && ax[k] !== ay[k]) { out.push(`${path}<${x.tag}>: attr ${k} "${ax[k]}" vs "${ay[k]}"`); if (out.length >= limit) return; }
  const ca = x.children ?? [], cb = y.children ?? [];
  if (ca.length !== cb.length) {
    out.push(`${path}<${x.tag}>: children ${ca.length} vs ${cb.length} [ours: ${ca.map((c) => c.tag).join(',').slice(0, 80)} | theirs: ${cb.map((c) => c.tag).join(',').slice(0, 80)}]`);
    return;
  }
  for (let i = 0; i < ca.length; i++) firstDiffs(ca[i], cb[i], `${path}<${x.tag}>[${i}]`, out);
}

const out = [];
firstDiffs(a, b, '', out);
console.log(`doc: ${doc.id} (${source.length} B) — ${out.length === 0 ? 'STRUCTURALLY EQUAL' : `${out.length}+ first differences:`}`);
for (const line of out) console.log('  ' + line);
