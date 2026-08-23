#!/usr/bin/env node
/**
 * M6 bundle gate (task 1.21): initial payload of apps/web/dist < 2 MB gzipped.
 *
 * "Initial" = index.html + its entry <script>/<link> assets + everything
 * Vite emits as `modulepreload` (fetched eagerly) + the .wasm modules the
 * engine fetches at startup. Dynamically-imported chunks NOT preloaded load
 * on demand and are excluded — that is the point of code-splitting.
 *
 * Run after `pnpm --filter @onemark/web build`. Exits 1 over budget.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'web', 'dist');
const BUDGET = 2 * 1024 * 1024;

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const assets = new Set();
for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
  assets.add(match[1].replace(/^\//, ''));
}

let total = 0;
const rows = [];
const gzipOf = (file) => gzipSync(readFileSync(join(dist, file))).length;

for (const file of assets) {
  const size = gzipOf(file);
  rows.push([file, size]);
  total += size;
}

// WASM modules are fetched at startup by both engine instances, and the
// parse worker is constructed on boot — neither appears in index.html.
for (const file of readdirSync(join(dist, 'assets')).filter(
  (f) => f.endsWith('.wasm') || /worker/.test(f),
)) {
  const path = join('assets', file);
  if (!assets.has(path)) {
    const size = gzipOf(path);
    rows.push([path, size]);
    total += size;
  }
}

console.log('Initial payload (gzipped):');
for (const [file, size] of rows.sort((a, b) => b[1] - a[1])) {
  console.log(`  ${(size / 1024).toFixed(0)} KB  ${file}`);
}
console.log(`TOTAL: ${(total / 1024 / 1024).toFixed(2)} MB / budget 2.00 MB`);

if (statSync(join(dist)).size === 0) process.exit(1);
if (total > BUDGET) {
  console.error('M6 gate FAILED');
  process.exit(1);
}
console.log('M6 gate ok');
