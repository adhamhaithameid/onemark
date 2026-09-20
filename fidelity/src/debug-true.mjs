#!/usr/bin/env node
/**
 * Prints the EXACT path where structuralDiff fails for every differing doc,
 * by executing the same comparison with path recording. Diagnostic only.
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

function compare(a, b, path, out) {
  if (out.hit) return;
  if ((a?.tag ?? null) !== (b?.tag ?? null)) { out.hit = `${path}: tag <${a?.tag}> vs <${b?.tag}>`; return; }
  if (a.tag === '#text') { if (a.value !== b.value) out.hit = `${path}: text ${JSON.stringify(a.value.slice(0, 50))} vs ${JSON.stringify(b.value.slice(0, 50))}`; return; }
  const ka = Object.keys(a.attrs ?? {}), kb = Object.keys(b.attrs ?? {});
  if (ka.length !== kb.length) { out.hit = `${path}<${a.tag}>: attr count ${ka.length} [${ka}] vs ${kb.length} [${kb}]`; return; }
  for (const k of ka) {
    if (a.attrs[k] === b.attrs[k]) continue;
    if (a.tag === 'img' && k === 'src' && (a.attrs[k] === '[camo]' || b.attrs[k] === '[camo]')) continue;
    out.hit = `${path}<${a.tag}>: attr ${k} ${JSON.stringify(a.attrs[k])} vs ${JSON.stringify(b.attrs[k])}`;
    return;
  }
  const ca = a.children ?? [], cb = b.children ?? [];
  if (ca.length !== cb.length) { out.hit = `${path}<${a.tag}>: children ${ca.length} vs ${cb.length}`; return; }
  for (let i = 0; i < ca.length; i++) compare(ca[i], cb[i], `${path}/${a.tag}[${i}]`, out);
}

const files = readdirSync(join(root, 'golden')).filter((f) => f.endsWith('.html'));
for (const file of files) {
  const id = file.replace(/\.html$/, '');
  let source;
  try { source = readFileSync(join(root, 'corpus', `${id}.md`), 'utf8'); } catch { continue; }
  if (source.startsWith('---\n')) continue;
  const ast = await engine.parse(source, GFM_OPTIONS);
  const ours = renderToSafeHtml(ast, { window: dom.window });
  const theirs = readFileSync(join(root, 'golden', file), 'utf8');
  const out = {};
  compare(normalize(ours), normalize(theirs), '', out);
  if (out.hit) console.log(`${id}\n    ${out.hit}`);
}
