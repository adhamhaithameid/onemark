/**
 * M5 diff runner (task 1.12): OneMark's render vs the committed goldens,
 * after R1–R6 normalization. Gate: ≥ 98% of documents structurally equal.
 *
 * Inputs:
 *   fidelity/golden/<id>.html        — GitHub's output (fetched, committed)
 *   fidelity/corpus/<id>.md          — the source document
 * The ours-side is rendered through the real engine + safe renderer here.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadNodeEngine } from '@onemark/engine/node';
import { renderToSafeHtml } from '@onemark/renderer';

import { JSDOM } from 'jsdom';

import { normalize, structuralDiff } from './normalize.mjs';

// The sanitiser wants a DOM; under Node we bring our own jsdom instance.
const dom = new JSDOM();

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const GFM_OPTIONS = {
  dialect: 'gfm',
  extensions: {
    tables: true, strikethrough: true, autolink: true, taskList: true,
    footnotes: true, alerts: true, math: true, frontmatter: true,
  },
};

export function rate(results) {
  if (results.length === 0) return 0;
  return results.filter((r) => r.equal).length / results.length;
}

export async function runDiff({ goldenDir = join(root, 'golden'), corpusDir = join(root, 'corpus') } = {}) {
  const engine = await loadNodeEngine();
  const goldens = readdirSync(goldenDir).filter((f) => f.endsWith('.html') && f !== 'manifest.json');

  const results = [];
  for (const file of goldens) {
    const id = file.replace(/\.html$/, '');
    const sourcePath = join(corpusDir, `${id}.md`);
    if (!existsSync(sourcePath)) {
      console.error(`missing source for golden ${id}`);
      continue;
    }
    const source = readFileSync(sourcePath, 'utf8');
    const ast = await engine.parse(source, GFM_OPTIONS);
    const ours = renderToSafeHtml(ast, /** @type {any} */ ({ window: dom.window }));
    const theirs = readFileSync(join(goldenDir, file), 'utf8');
    const equal = structuralDiff(normalize(ours), normalize(theirs));
    results.push({ id, equal });
    if (!equal) console.log(`DIFF ${id}`);
  }
  return { results, rate: rate(results) };
}

export async function main() {
  const { results, rate: passRate } = await runDiff();
  for (const r of results) console.log(`${r.equal ? 'ok' : 'DIFF'}  ${r.id}`);
  console.log(`\nM5 parity: ${(passRate * 100).toFixed(2)}% of ${results.length} (gate ≥ 98%)`);
  if (results.length === 0 || passRate < 0.98) process.exit(1);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) await main();
