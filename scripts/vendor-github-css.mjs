#!/usr/bin/env node
/**
 * Vendor github-markdown-css (MIT) into packages/renderer/css/.
 * Manual-run only by design (same discipline as vendor-gfm-spec.mjs):
 * an upgrade is a fidelity change and must be deliberate — see ADR-0015.
 *
 * Usage: node scripts/vendor-github-css.mjs [version]   (default: pinned below)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PINNED = '5.8.1';
const version = process.argv[2] ?? PINNED;
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'renderer', 'css');

const FILES = [
  { remote: 'github-markdown-light.css', local: 'github-light.css' },
  { remote: 'github-markdown-dark.css', local: 'github-dark.css' },
];

mkdirSync(outDir, { recursive: true });

for (const { remote, local } of FILES) {
  const url = `https://unpkg.com/github-markdown-css@${version}/${remote}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`FAIL ${res.status} ${url}`);
    process.exit(1);
  }
  const body = await res.text();
  const banner = `/* Vendored from github-markdown-css@${version} (${remote}, MIT) via scripts/vendor-github-css.mjs.\n   Do not edit by hand; do not re-vendor casually — an upgrade is a fidelity decision (ADR-0015). */\n\n`;
  writeFileSync(join(outDir, local), banner + body);
  console.log(`ok ${local} <- ${url} (${body.length} bytes)`);
}

writeFileSync(
  join(outDir, 'ATTRIBUTION.md'),
  `# github-markdown-css\n\nVendored files \`github-light.css\` and \`github-dark.css\` come from\n[github-markdown-css](https://github.com/primer/github-markdown-css) version **${version}**,\nlicensed under the MIT License. They are the style reference for present-layer fidelity\n(ADR-0015); the test literals in \`test/theme.test.ts\` were transcribed from this version.\n`,
);

console.log(`\nVendored ${FILES.length} files at ${outDir}`);
