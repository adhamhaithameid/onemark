#!/usr/bin/env node
/**
 * One-off candidate-pool discovery for the OQ-1 corpus (task 1.9).
 *
 * Walks the git trees of docs-heavy public repos via the GitHub API (blob
 * sizes included), keeps .md files inside the 5–200 KB band, classifies them
 * into the PRD strata by path rules, and emits a committed, seeded sample to
 * `corpus-pool.json`. Re-running with the same inputs yields the same pool —
 * the pool itself is frozen by committing it, exactly like the manifest.
 *
 * Usage: GITHUB_TOKEN=… node src/discover-pool.mjs
 */
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEED = 0x6f4e;

function prng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Repos mined for candidates, with per-repo caps. Docs-heavy by design. */
const REPOS = [
  ['mdn/content', 16],
  ['reactjs/react.dev', 12],
  ['rust-lang/reference', 10],
  ['rust-lang/book', 8],
  ['rust-lang/async-book', 4],
  ['nodejs/node', 10],
  ['electron/electron', 6],
  ['microsoft/TypeScript', 5],
  ['golang/go', 5],
  ['denoland/deno', 5],
  ['facebook/react', 4],
  ['vercel/next.js', 5],
  ['vuejs/docs', 6],
  ['sveltejs/kit', 5],
  ['mermaid-js/mermaid', 6],
  ['KaTeX/KaTeX', 5],
  ['ollama/ollama', 3],
  ['tauri-apps/tauri', 4],
  ['ohmyzsh/ohmyzsh', 4],
  ['systemd/systemd', 5],
  ['helm/helm', 4],
  ['istio/istio', 4],
  ['prometheus/prometheus', 4],
  ['grafana/grafana', 4],
  ['ansible/ansible', 4],
  ['rust-lang/cargo', 5],
  ['rust-lang/rustc-dev-guide', 5],
  ['python/devguide', 4],
  ['docker/docs', 4],
  ['kubernetes/website', 12],
  ['yt-dlp/yt-dlp', 4],
  ['eslint/eslint', 4],
  ['vitest-dev/vitest', 4],
  ['gohugoio/hugo', 4],
  ['prettier/prettier', 3],
  ['webpack/webpack', 4],
  ['pytorch/pytorch', 4],
  ['tensorflow/tensorflow', 3],
  ['apache/airflow', 4],
  ['nlohmann/json', 3],
  ['google/googletest', 3],
  ['grpc/grpc', 4],
  ['envoyproxy/envoy', 4],
  ['elastic/elasticsearch', 4],
  ['quarkusio/quarkus', 4],
  ['spring-projects/spring-boot', 4],
  ['dotnet/runtime', 4],
  ['fish-shell/fish', 3],
  ['git/git', 3],
  ['libuv/libuv', 3],
  ['apache/kafka', 3],
  ['nvm-sh/nvm', 2],
  ['pyenv/pyenv', 2],
  ['asdf-vm/asdf', 2],
  ['junegunn/vim-plug', 2],
];

function classify(path) {
  const p = path.toLowerCase();
  if (/(^|\/)readme\.md$/.test(p)) return 'readme_majority';
  // Adversarial: math, diagrams, raw-HTML-heavy docs.
  if (/katex|mermaid|math|syntax\/|bootstrap|security\.md/.test(p)) return 'adversarial';
  // Long-form documentation.
  if (/\/(docs?|content|book|guide|guides|reference|learn|articles)\//.test(p) || /^docs?\//.test(p) || /contributing|architecture|changelog/.test(p)) {
    return 'longform_docs';
  }
  return 'gfm_rich';
}

function slugId(repo, path) {
  return `${repo.split('/')[1]}-${path.split('/').pop().replace(/\.md$/i, '')}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
}

async function ghJson(url, token) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('GITHUB_TOKEN required');
    process.exit(2);
  }
  const rand = prng(SEED);
  const byStrata = { readme_majority: [], longform_docs: [], gfm_rich: [], adversarial: [] };
  const seen = new Set();

  for (const [repo, cap] of REPOS) {
    try {
      const tree = await ghJson(`https://api.github.com/repos/${repo}/git/trees/HEAD?recursive=1`, token);
      const blobs = (tree.tree ?? [])
        .filter((n) => n.type === 'blob' && /\.md$/i.test(n.path) && n.size >= 5 * 1024 && n.size <= 200 * 1024)
        .map((n) => ({ repo, path: n.path, bytes: n.size, strata: classify(n.path) }));
      // Seeded shuffle per repo, then cap — deterministic across runs.
      blobs.sort(() => rand() - 0.5);
      let taken = 0;
      for (const b of blobs) {
        if (taken >= cap) break;
        const key = `${b.repo}/${b.path}`;
        if (seen.has(key)) continue;
        seen.add(key);
        byStrata[b.strata].push({ ...b, id: slugId(b.repo, b.path) });
        taken += 1;
      }
      process.stdout.write(`${repo}: ${taken} candidates\n`);
    } catch (error) {
      console.warn(`skipped ${repo}: ${error.message}`);
    }
  }

  // Merge in the curated inline entries from the previous pool where they
  // still exist on disk from earlier runs (id stability for the manifest).
  const pool = [];
  const counts = {};
  for (const [strata, entries] of Object.entries(byStrata)) {
    counts[strata] = entries.length;
    for (const e of entries) pool.push([e.id, e.repo, e.path, strata, e.bytes]);
  }

  writeFileSync(
    join(root, 'src', 'corpus-pool.json'),
    JSON.stringify(
      {
        seedDescription: `mulberry32(${SEED}); trees of ${REPOS.length} repos; band 5-200KB; per-repo caps; path-rule strata`,
        generatedAt: new Date().toISOString(),
        counts,
        pool,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`\npool written: ${pool.length} candidates ${JSON.stringify(counts)}`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) await main();
