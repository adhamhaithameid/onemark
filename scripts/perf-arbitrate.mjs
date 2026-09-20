#!/usr/bin/env node
/**
 * Browser perf arbitration (ADR-0016) — the M1a/M1b budgets cannot be judged
 * in Node (jsdom sanitise scaling, OOM), so they are arbitrated here: a real
 * Chromium driving the real deployed app through its real user path.
 *
 * Method per size: load the app, dispatch a synthetic paste of a generated
 * document into the CodeMirror source pane, and measure the wall time from
 * paste dispatch to the first preview-pane DOM update. The editor debounces
 * live updates at 150 ms by design, so the harness reports BOTH the raw wall
 * time and the debounce-adjusted time (raw − 150 ms); budgets are judged on
 * the adjusted number and both are recorded in the results JSON.
 *
 * Usage:
 *   node scripts/perf-arbitrate.mjs --url https://adhamhaithameid.github.io/onemark/app/
 *   node scripts/perf-arbitrate.mjs --url http://localhost:4173/ --out /tmp/perf.json
 * Exit code 0 iff M1a (100 KB, adjusted < 100 ms) and M1b (1 MB, adjusted
 * < 500 ms) both pass.
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('../packages/renderer/node_modules/playwright/index.js');

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
}
const BASE_URL = arg('--url', 'http://localhost:4173/');
const OUT = arg('--out', 'perf-arbitration.json');
const RUNS = Number(arg('--runs', '5'));

/** Deterministic synthetic document near the target size, realistic mix:
 *  PRD §4's workload is prose-heavy documentation — mostly paragraphs, lists
 *  and tables, with an occasional fence (~1 per 8 KB), alert and math block.
 *  The first version of this harness weighted code fences ~50× reality and
 *  measured Shiki, not OneMark. */
function makeDoc(targetBytes) {
  const prose = [
    'Paragraph with **bold**, *italic*, `inline code`, a [link](https://example.com) and :tada: emoji across a couple of lines of running documentation text so the parser sees real prose structure.',
    'A second paragraph, slightly longer, mentioning `utils.formatDate`, "quotes", and an <em>inline HTML</em> tag, plus an autolink https://example.com/docs to exercise the inline renderers.',
    '- list item with **emphasis** and a [link](https://example.com)\n- another item\n  - nested item with `code`\n- [ ] a task item\n- [x] a done task',
    '1. numbered one\n2. numbered two\n3. numbered three with a longer line of text to pad the document realistically toward the target size.',
    '| Column A | Column B | Column C |\n| :------- | :------: | -------: |\n| cell | cell | cell |\n| cell | cell | cell |\n| data | data | data |',
    '> A plain blockquote with a line of quoted prose and a [link](https://example.com).',
    '> [!NOTE]\n> Note content with `code` and [links](https://example.com).',
    '### Subsection heading\n\nText under a subsection so heading levels vary through the document body.',
  ];
  const fence = [
    '```rust',
    'fn main() {',
    '    let numbers: Vec<i32> = (1..100).collect();',
    '    for n in numbers { println!("{} squared is {}", n, n * n); }',
    '}',
    '```',
  ].join('\n');
  const math = '$$\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}$$';
  let doc = '# Arbitration Document\n\n';
  let i = 0;
  let sinceFence = 0;
  while (doc.length < targetBytes) {
    const block = prose[i % prose.length];
    doc += `## Section ${i}\n\n` + block + '\n\n';
    i += 1;
    sinceFence += block.length;
    if (sinceFence >= 8 * 1024) {
      doc += fence + '\n\n';
      if (i % 5 === 0) doc += math + '\n\n';
      sinceFence = 0;
    }
  }
  return doc.slice(0, targetBytes);
}

const SIZES = [
  // Informational: the size PRD §4 actually describes. Not a budget tier.
  { tier: 'real-workload', bytes: 20 * 1024, budgetMs: 100, informational: true },
  { tier: 'M1a', bytes: 100 * 1024, budgetMs: 100 },
  { tier: 'M1b', bytes: 1024 * 1024, budgetMs: 500 },
];
const DEBOUNCE_MS = 150; // apps/web workspace.ts live-preview debounce

async function measureOnce(page, source) {
  return page.evaluate(async (markdown) => {
    const pane = document.querySelector('.onemark-editor-pane .cm-content');
    const preview = document.querySelector('.onemark-preview-pane');
    if (!pane || !preview) throw new Error('app panes not found — is this the deployed app?');
    // Focus the editor and replace its content via a synthetic paste — the
    // same path a real user's clipboard takes.
    pane.focus();
    const dt = new DataTransfer();
    dt.setData('text/plain', markdown);
    const t0 = performance.now();
    pane.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    // Poll for the preview to react to the (debounced) parse+render.
    const initial = preview.innerHTML.length;
    await new Promise((resolve, reject) => {
      const deadline = t0 + 60_000;
      const tick = () => {
        if (preview.innerHTML.length > initial + 1000) return resolve(performance.now() - t0);
        if (performance.now() > deadline) return reject(new Error('preview never updated'));
        setTimeout(tick, 5);
      };
      tick();
    });
    return performance.now() - t0;
  }, source);
}

const results = { url: BASE_URL, generatedAt: new Date().toISOString(), debounceMs: DEBOUNCE_MS, tiers: {} };
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();

for (const { tier, bytes, budgetMs, informational } of SIZES) {
  const source = makeDoc(bytes);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.onemark-editor-pane .cm-content', { timeout: 20_000 });
  const samples = [];
  for (let i = 0; i < RUNS; i++) {
    // Re-load for a cold-ish render each run (fresh module state).
    if (i > 0) await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.onemark-editor-pane .cm-content', { timeout: 20_000 });
    samples.push(await measureOnce(page, source));
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  const adjusted = Math.max(0, median - DEBOUNCE_MS);
  const pass = adjusted < budgetMs;
  results.tiers[tier] = { bytes, budgetMs, informational: informational === true, samples: samples.map(Math.round), medianMs: Math.round(median), adjustedMs: Math.round(adjusted), pass };
  console.log(`${tier}: median ${Math.round(median)} ms raw, ${Math.round(adjusted)} ms adjusted (budget < ${budgetMs} ms) — ${pass ? 'PASS' : 'FAIL'}${informational ? ' (informational)' : ''}`);
}

await browser.close();
writeFileSync(OUT, JSON.stringify(results, null, 2) + '\n');
console.log(`results written to ${OUT}`);
const allPass = Object.values(results.tiers).every((t) => t.informational || t.pass);
process.exit(allPass ? 0 : 1);
