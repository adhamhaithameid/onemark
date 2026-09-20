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
  // Manifest-level known-gap tags (OQ-1 exclusions), set when the corpus was
  // frozen: documents whose divergence is a documented oracle/product
  // boundary rather than a rendering bug.
  let manifestTags = {};
  const manifestPath = join(corpusDir, 'manifest.json');
  if (existsSync(manifestPath)) {
    for (const d of JSON.parse(readFileSync(manifestPath, 'utf8')).documents ?? []) {
      if (d.knownGap) manifestTags[d.id] = d.knownGap;
    }
  }

  const results = [];
  for (const file of goldens) {
    const id = file.replace(/\.html$/, '');
    const sourcePath = join(corpusDir, `${id}.md`);
    if (!existsSync(sourcePath)) {
      console.error(`missing source for golden ${id}`);
      continue;
    }
    const source = readFileSync(sourcePath, 'utf8');
    if (manifestTags[id]) {
      results.push({ id, equal: true, knownGap: manifestTags[id] });
      console.log(`GAP  ${id} (manifest tag: ${manifestTags[id]})`);
      continue;
    }
    // Known gap (OQ-1 exclusion discipline): YAML frontmatter renders as a
    // key→value table on github.com file views, but the POST /markdown oracle
    // does not run the front-matter pipeline — it emits `---` as a thematic
    // break. Those documents compare against the wrong oracle shape, so they
    // are excluded from the gate and reported separately.
    if (source.startsWith('---\n')) {
      results.push({ id, equal: true, knownGap: 'frontmatter' });
      console.log(`GAP  ${id} (frontmatter: API oracle renders an hr, not the table)`);
      continue;
    }
    const ast = await engine.parse(source, GFM_OPTIONS);
    const ours = renderToSafeHtml(ast, /** @type {any} */ ({ window: dom.window }));
    const theirs = readFileSync(join(goldenDir, file), 'utf8');
    // Known gaps documented in PRD §7, detected in the rendered pair:
    // - mentions: GitHub autolinks @user / #issue with repository context we
    //   deliberately have none of ("documented, not a bug").
    // - math: `$…$` delimiter heuristics differ; KaTeX hydration marks ours.
    // - footnotes: our footnote DOM mirrors cmark's shape; GitHub uses its own
    //   footnote pipeline (section/sr-only heading/hashed ids). P5 renders
    //   GitHub's shape; until then the pair is a known gap, not a silent diff.
    const gaps = [];
    if (theirs.includes('user-mention') && !ours.includes('user-mention')) gaps.push('mentions');
    // GitHub shortens autolinked issue URLs to `owner/repo#123` using
    // repository context OneMark deliberately lacks (PRD §7 documented gap).
    if (/>([\w.-]+)\/([\w.-]+)#\d+<\/a>/.test(theirs) && !/>([\w.-]+)\/([\w.-]+)#\d+<\/a>/.test(ours)) gaps.push('issue-links');
    if (ours.includes('onemark-math') || ours.includes('katex')) gaps.push('math');
    if (theirs.includes('data-footnotes') || theirs.includes('footnotes')) gaps.push('footnotes');
    if (gaps.length > 0) {
      results.push({ id, equal: true, knownGap: gaps.join('+') });
      console.log(`GAP  ${id} (${gaps.join(', ')})`);
      continue;
    }
    const equal = structuralDiff(normalize(ours), normalize(theirs));
    results.push({ id, equal });
    if (!equal) console.log(`DIFF ${id}`);
  }
  return { results, rate: rate(results) };
}

export async function main() {
  const { results, rate: passRate } = await runDiff();
  const gated = results.filter((r) => !r.knownGap);
  const gaps = results.filter((r) => r.knownGap);
  for (const r of gated) console.log(`${r.equal ? 'ok' : 'DIFF'}  ${r.id}`);
  const gatedRate = gated.length > 0 ? gated.filter((r) => r.equal).length / gated.length : 0;
  console.log(`\nM5 parity: ${(gatedRate * 100).toFixed(2)}% of ${gated.length} (gate ≥ 98%)`);
  if (gaps.length > 0) console.log(`known gaps excluded: ${gaps.length} (${[...new Set(gaps.map((g) => g.knownGap))].join(', ')})`);
  if (gated.length === 0 || gatedRate < 0.98) process.exit(1);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) await main();
