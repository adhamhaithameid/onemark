import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

const EXPECTED = {
  commonmarkCases: 652,
  gfmGatedCases: 22,
  xssVectors: 93,
};

let failed = 0;
const check = (name, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok' : 'FAIL'}  ${name}: ${actual}${ok ? '' : ` (expected ${expected})`}`);
};

const commonmark = load('spec/commonmark-0.31.2.json');
check('CommonMark cases', Array.isArray(commonmark) ? commonmark.length : -1, EXPECTED.commonmarkCases);

const gfm = load('spec/gfm-0.29.json');
const gated = Array.isArray(gfm)
  ? gfm.filter((c) => c.extension && c.extension !== 'disabled').length
  : -1;
check('GFM gated cases (M4)', gated, EXPECTED.gfmGatedCases);

const xss = load('xss/corpus.json');
check('XSS vectors', Array.isArray(xss) ? xss.length : -1, EXPECTED.xssVectors);

if (failed > 0) {
  console.error(`\n${failed} spec integrity check(s) failed`);
  process.exit(1);
}
console.log('\nSpec corpora intact.');
