#!/usr/bin/env node
/**
 * Cross-build determinism check (NFR-6, task 2.7): for every golden-corpus
 * document, the WASM/node engine's AST must equal the native engine's AST —
 * structurally, document for document. The native dumps are produced by
 * `crates/onemark-engine`'s dump_corpus example; this script parses the same
 * sources through the node WASM engine and compares.
 *
 * Usage: node scripts/corpus-determinism.mjs <native_dump_dir> [corpus_dir]
 * Exit 1 on any divergence.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const [nativeDir, corpusDir = 'fidelity/corpus'] = process.argv.slice(2);
if (!nativeDir) {
  console.error('usage: node scripts/corpus-determinism.mjs <native_dump_dir> [corpus_dir]');
  process.exit(2);
}

const { loadNodeEngine } = await import('../packages/engine/src/wasm-engine.ts');
const engine = await loadNodeEngine();

const GFM_OPTIONS = {
  dialect: 'gfm',
  extensions: {
    tables: true, strikethrough: true, autolink: true, taskList: true,
    footnotes: true, alerts: true, math: true, frontmatter: true,
  },
};

const files = readdirSync(corpusDir).filter((f) => f.endsWith('.md'));
let compared = 0;
let diverged = 0;
for (const file of files) {
  const id = file.replace(/\.md$/, '');
  const nativePath = join(nativeDir, `${id}.json`);
  let native;
  try {
    native = JSON.parse(readFileSync(nativePath, 'utf8'));
  } catch {
    console.error(`DIFF ${id}: no native dump at ${nativePath}`);
    diverged += 1;
    continue;
  }
  const source = readFileSync(join(corpusDir, file), 'utf8');
  const ast = await engine.parse(source, GFM_OPTIONS);
  const web = JSON.parse(JSON.stringify(ast));
  if (JSON.stringify(web) === JSON.stringify(native)) {
    compared += 1;
  } else {
    console.error(`DIFF ${id}: native and web ASTs diverge`);
    diverged += 1;
  }
}
console.log(`corpus determinism: ${compared}/${files.length} documents identical across native and WASM builds`);
if (diverged > 0) process.exit(1);
