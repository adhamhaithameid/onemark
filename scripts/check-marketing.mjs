#!/usr/bin/env node
/**
 * Marketing bundle gate: the Next.js static export in apps/marketing/out must
 * stay lean — the whole point of the product is fast local rendering, and the
 * brochure should not contradict it. Budget: 500 KB gzipped across JS+CSS in
 * the export (framework weight included, images excluded — there are none).
 * Run after `pnpm --filter @onemark/marketing build`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const BUDGET = 500 * 1024;
const outDir = 'apps/marketing/out';

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) yield* walk(p);
    else if (/\.js$|\.css$/.test(entry)) yield p;
  }
}

let total = 0;
const files = [];
for (const file of walk(outDir)) {
  const gz = gzipSync(readFileSync(file)).length;
  total += gz;
  files.push(`${(gz / 1024).toFixed(0).padStart(5)} KB  ${file}`);
}
if (files.length === 0) {
  console.error('marketing export missing — run the build first');
  process.exit(1);
}
for (const line of files) console.log(line);
const mb = (total / (1024 * 1024)).toFixed(2);
if (total > BUDGET) {
  console.error(`marketing bundle gate FAILED: ${mb} MB > 0.5 MB budget`);
  process.exit(1);
}
console.log(`marketing bundle gate ok: ${mb} MB / 0.5 MB gzipped`);
