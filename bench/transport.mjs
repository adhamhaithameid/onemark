/**
 * OQ-4, the JavaScript half — what does crossing the WASM boundary actually cost?
 *
 * The Rust-side cost is measured by `crates/onemark-engine/examples/transport_bench.rs`.
 * This measures what that harness cannot: the wasm-bindgen string copy and, for
 * design A, `JSON.parse` on the far side.
 *
 * Run: pnpm bench   (requires `pnpm build:wasm` first)
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const wasm = require('../packages/engine/wasm/nodejs/onemark_wasm.js');

const OPTIONS = JSON.stringify({
  dialect: 'gfm',
  extensions: {
    tables: true, strikethrough: true, autolink: true, taskList: true,
    footnotes: true, alerts: true, math: true, frontmatter: true,
  },
});

const CHUNK = `
## Section heading

Ordinary paragraph text with **strong**, _emphasis_, \`code\`, a [link](https://example.com/page)
and an autolink https://example.org that the parser has to scan for.

> [!NOTE]
> An alert block, because these are on the v1 critical path.

| column a | column b | column c |
|:---------|:--------:|---------:|
| one      | two      | three    |
| four     | five     | six      |

- [x] a completed task
- [ ] an outstanding task
  - a nested bullet

\`\`\`rust
fn main() {
    println!("fenced code the renderer will hand to Shiki");
}
\`\`\`

A footnote reference[^note] and some inline math $E = mc^2$.

[^note]: The footnote definition.
`;

function synthetic(targetBytes) {
  let doc = '';
  while (doc.length < targetBytes) doc += CHUNK;
  return doc;
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function time(runs, fn) {
  for (let i = 0; i < 2; i++) fn(); // warm up
  const samples = [];
  let last;
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    last = fn();
    samples.push(performance.now() - t0);
  }
  return [median(samples), last];
}

const RUNS = Number(process.env.BENCH_RUNS ?? 9);
const MB = 1024 * 1024;

console.log(`engine: ${wasm.engine_id()} v${wasm.engine_version()}`);
console.log(`node:   ${process.version}`);
console.log(`runs:   ${RUNS} after warmup, median\n`);

const rows = [];

for (const [label, bytes] of [['100 KB', 100 * 1024], ['1 MB', MB], ['5 MB', 5 * MB]]) {
  const doc = synthetic(bytes);

  const [jsonMs, json] = time(RUNS, () => wasm.parse_to_json(doc, OPTIONS));
  const [fullMs] = time(RUNS, () => JSON.parse(wasm.parse_to_json(doc, OPTIONS)));
  const [htmlMs, html] = time(RUNS, () => wasm.render_to_html(doc, OPTIONS));

  rows.push({ label, jsonMs, fullMs, htmlMs, jsonMb: json.length / MB, htmlMb: html.length / MB });

  console.log(`=== ${label} (${doc.length.toLocaleString()} bytes) ===`);
  console.log(`  A: parse → JSON string across boundary .. ${jsonMs.toFixed(2).padStart(8)} ms  (${(json.length / MB).toFixed(1)} MB)`);
  console.log(`  A: + JSON.parse into an AST ............. ${fullMs.toFixed(2).padStart(8)} ms  ← what the renderer receives`);
  console.log(`  B: parse → HTML across boundary ......... ${htmlMs.toFixed(2).padStart(8)} ms  (${(html.length / MB).toFixed(1)} MB)`);
  console.log(`     JSON.parse overhead alone ............ ${(fullMs - jsonMs).toFixed(2).padStart(8)} ms\n`);
}

console.log('summary — design A end-to-end (engine only, no rendering):');
for (const r of rows) {
  console.log(`  ${r.label.padEnd(7)} ${r.fullMs.toFixed(1).padStart(8)} ms`);
}
