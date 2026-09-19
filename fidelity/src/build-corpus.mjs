#!/usr/bin/env node
/**
 * Corpus builder (task 1.9 / OQ-1): turns a candidate pool into a frozen,
 * deterministic manifest and fetches sources + goldens.
 *
 * Pilot mode (default POOL below): a curated candidate list spanning the PRD
 * strata, existence-checked against raw.githubusercontent.com (no rate limit).
 * The full 100-document run swaps the pool for GitHub search results; the
 * seeded-shuffle + freeze mechanics are identical.
 *
 * Golden fetching hits POST /markdown once per document — 60/hour
 * unauthenticated. The pilot size respects that ceiling.
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEED = 0x6f4e /* 'ON' */;

/** Deterministic PRNG (mulberry32) so any reviewer re-runs the same selection. */
function prng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STRATA_TARGETS = { readme_majority: 55, longform_docs: 25, gfm_rich: 12, adversarial: 8 };

/** Curated pilot pool — every entry is a public-repo markdown file. */
const PILOT_POOL = [
  // readme_majority — developer tooling, wide star/language spread
  ['react-readme', 'facebook/react', 'HEAD', 'README.md', 'readme_majority'],
  ['vite-readme', 'vitejs/vite', 'HEAD', 'README.md', 'readme_majority'],
  ['rust-readme', 'rust-lang/rust', 'HEAD', 'README.md', 'readme_majority'],
  ['tokio-readme', 'tokio-rs/tokio', 'HEAD', 'README.md', 'readme_majority'],
  ['vscode-readme', 'microsoft/vscode', 'HEAD', 'README.md', 'readme_majority'],
  ['typescript-readme', 'microsoft/TypeScript', 'HEAD', 'README.md', 'readme_majority'],
  ['tailwindcss-readme', 'tailwindlabs/tailwindcss', 'HEAD', 'README.md', 'readme_majority'],
  ['zod-readme', 'colinhacks/zod', 'HEAD', 'README.md', 'readme_majority'],
  ['excalidraw-readme', 'excalidraw/excalidraw', 'HEAD', 'README.md', 'readme_majority'],
  ['ripgrep-readme', 'BurntSushi/ripgrep', 'HEAD', 'README.md', 'readme_majority'],
  ['fd-readme', 'sharkdp/fd', 'HEAD', 'README.md', 'readme_majority'],
  ['bat-readme', 'sharkdp/bat', 'HEAD', 'README.md', 'readme_majority'],

  // longform_docs — prose-heavy documentation files
  ['react-contributing', 'facebook/react', 'HEAD', 'CONTRIBUTING.md', 'longform_docs'],
  ['electron-contributing', 'electron/electron', 'HEAD', 'CONTRIBUTING.md', 'longform_docs'],
  ['vscode-wiki-testing', 'microsoft/vscode', 'HEAD', 'test/README.md', 'longform_docs'],
  ['rust-cargo-bookish', 'rust-lang/cargo', 'HEAD', 'CONTRIBUTING.md', 'longform_docs'],
  ['comrak-changelog', 'kivikakk/comrak', 'HEAD', 'CHANGELOG.md', 'longform_docs'],

  // gfm_rich — documents exercising tables/task lists/alerts/code together
  ['gemoji-readme', 'github/gemoji', 'HEAD', 'README.md', 'gfm_rich'],
  ['dompurify-readme', 'cure53/DOMPurify', 'HEAD', 'README.md', 'gfm_rich'],
  ['beads-readme', 'gastownhall/beads', 'HEAD', 'README.md', 'gfm_rich'],
];

function slug(id) {
  return id.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

async function fetchRaw(ownerRepo, ref, path) {
  const url = `https://raw.githubusercontent.com/${ownerRepo}/${ref}/${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

export async function buildCorpus({ limitPerStrata = Infinity } = {}) {
  const rand = prng(SEED);
  const picked = new Map();

  // Deterministic order inside each stratum, then cap at its target.
  const byStrata = {};
  for (const entry of PILOT_POOL) {
    (byStrata[entry[4]] ??= []).push(entry);
  }
  for (const [strata, entries] of Object.entries(byStrata)) {
    entries.sort(() => rand() - 0.5);
    const target = Math.min(STRATA_TARGETS[strata] ?? entries.length, limitPerStrata);
    for (const entry of entries.slice(0, Math.min(target, entries.length))) {
      picked.set(entry[0], entry);
    }
  }

  const documents = [];
  for (const [id, [, ownerRepo, ref, path]] of picked) {
    const source = await fetchRaw(ownerRepo, ref, path);
    const docId = slug(id);
    writeFileSync(join(root, 'corpus', `${docId}.md`), source);
    documents.push({
      id: docId,
      sourceUrl: `https://github.com/${ownerRepo}/blob/${ref}/${path}`,
      commitSha: ref,
      localPath: join(root, 'corpus', `${docId}.md`),
      bytes: source.length,
    });
    process.stdout.write(`source ${docId} (${source.length} B)\n`);
  }

  // Size guard from the OQ-1 rule: 5–200 KB per document.
  const sized = documents.filter((d) => d.bytes >= 5 * 1024 && d.bytes <= 200 * 1024);
  const dropped = documents.length - sized.length;
  if (dropped > 0) console.log(`dropped ${dropped} outside the 5–200 KB band`);

  writeFileSync(
    join(root, 'corpus', 'manifest.json'),
    JSON.stringify(
      {
        seedDescription: `mulberry32(${SEED}); curated pilot pool; strata targets ${JSON.stringify(STRATA_TARGETS)}`,
        generatedAt: new Date().toISOString(),
        documents: sized.map(({ localPath: _local, ...rest }) => rest),
      },
      null,
      2,
    ) + '\n',
  );
  return sized;
}

export async function fetchGoldens(documents, token) {
  mkdirSync(join(root, 'golden'), { recursive: true });
  let done = 0;
  for (const doc of documents) {
    const out = join(root, 'golden', `${doc.id}.html`);
    if (existsSync(out)) {
      done += 1;
      continue;
    }
    const html = await fetchGolden(token, readLocal(doc));
    writeFileSync(out, html);
    done += 1;
    console.log(`golden ${done}/${documents.length} ${doc.id}`);
  }
}

import { readFileSync } from 'node:fs';
function readLocal(doc) {
  return readFileSync(doc.localPath, 'utf8');
}

async function fetchGolden(token, text) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch('https://api.github.com/markdown', {
    method: 'POST',
    headers,
    body: JSON.stringify({ text, mode: 'gfm' }),
  });
  if (!res.ok) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    throw new Error(`github api ${res.status}${remaining !== null ? ` (remaining ${remaining})` : ''}`);
  }
  return res.text();
}

async function main() {
  mkdirSync(join(root, 'corpus'), { recursive: true });
  const documents = await buildCorpus({});
  const token = process.env.GITHUB_TOKEN ?? undefined;
  try {
    await fetchGoldens(documents, token);
  } catch (error) {
    console.error(`stopped: ${error.message}`);
    console.error('goldens so far are kept; re-run to continue within rate limits');
    process.exit(3);
  }
  console.log(`\npilot corpus complete: ${documents.length} documents`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) await main();
