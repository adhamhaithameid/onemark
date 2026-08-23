/**
 * Vendors the GFM specification suite into `fidelity/spec/`.
 *
 * Run deliberately, never automatically — the same rule the golden corpus follows.
 * An auto-refresh would silently absorb a regression as the new truth.
 *
 * Usage: node scripts/vendor-gfm-spec.mjs
 *
 * The upstream file is prose with fenced example blocks:
 *
 *     ```````````````````````````````` example table
 *     <markdown>
 *     .
 *     <html>
 *     ````````````````````````````````
 *
 * A bare `example` fence is a CommonMark case; a labelled one (`example table`,
 * `example tasklist`, …) is an extension case. That label is what metric M4
 * selects on, so it is preserved rather than inferred from the section heading.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SOURCE = 'https://raw.githubusercontent.com/github/cmark-gfm/master/test/spec.txt';
const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '../fidelity/spec');

const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`${SOURCE} returned ${response.status}`);
const text = await response.text();

const version = /^version:\s*(.+)$/m.exec(text)?.[1]?.trim() ?? 'unknown';

const lines = text.split('\n');
const cases = [];
let section = '';
let example = 0;
let i = 0;

while (i < lines.length) {
  const line = lines[i];

  const heading = /^#{1,6}\s+(.*)$/.exec(line);
  if (heading) {
    section = heading[1].trim();
    i += 1;
    continue;
  }

  const fence = /^(`{3,})\s*example\s*(\S*)\s*$/.exec(line);
  if (!fence) {
    i += 1;
    continue;
  }

  const closing = fence[1];
  const label = fence[2] || '';
  i += 1;

  const markdown = [];
  while (i < lines.length && lines[i] !== '.') markdown.push(lines[i++]);
  i += 1; // the '.' separator

  const html = [];
  while (i < lines.length && !lines[i].startsWith(closing)) html.push(lines[i++]);
  i += 1; // the closing fence

  example += 1;
  cases.push({
    // The spec writes tabs as U+2192 so they are visible in prose.
    markdown: markdown.join('\n').replace(/→/g, '\t') + '\n',
    html: html.join('\n').replace(/→/g, '\t') + '\n',
    example,
    section,
    extension: label,
  });
}

const extensions = cases.filter((c) => c.extension !== '');
const byExtension = {};
for (const c of extensions) byExtension[c.extension] = (byExtension[c.extension] ?? 0) + 1;

writeFileSync(
  join(outDir, `gfm-${version}.json`),
  JSON.stringify(cases, null, 2) + '\n',
);

console.log(`GFM spec ${version} — ${cases.length} examples, ${extensions.length} extension cases`);
for (const [name, count] of Object.entries(byExtension).sort()) {
  console.log(`  ${name.padEnd(16)} ${count}`);
}
console.log(`written to fidelity/spec/gfm-${version}.json`);
