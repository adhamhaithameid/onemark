#!/usr/bin/env node
/**
 * Vendor the gemoji short-code → character map used by task 1.8.
 * Manual-run only (same discipline as vendor-gfm-spec / vendor-github-css):
 * the map is data the renderer bakes in, so an update is deliberate.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = 'https://raw.githubusercontent.com/github/gemoji/master/db/emoji.json';
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'renderer', 'src', 'assets');

const res = await fetch(SRC);
if (!res.ok) {
  console.error(`FAIL ${res.status} ${SRC}`);
  process.exit(1);
}
const entries = await res.json();

const map = {};
for (const e of entries) {
  if (!e.emoji || !Array.isArray(e.aliases)) continue;
  for (const alias of e.aliases) {
    if (!(alias in map)) map[alias] = e.emoji;
  }
}

mkdirSync(outDir, { recursive: true });
const banner =
  `/** Vendored from github/gemoji (db/emoji.json) via scripts/vendor-emoji.mjs.\n` +
  ` *  Do not edit by hand. Short-code → character; first alias wins duplicates.\n */\n`;
writeFileSync(
  join(outDir, 'emoji.ts'),
  banner + `export const EMOJI: Readonly<Record<string, string>> = ${JSON.stringify(map)};\n`,
);
console.log(`ok ${Object.keys(map).length} shortcodes -> src/assets/emoji.ts`);
