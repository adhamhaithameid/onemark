#!/usr/bin/env node
/**
 * Corpus builder (task 1.9 / OQ-1): turns the candidate pool into a frozen,
 * deterministic manifest and writes corpus sources.
 *
 * The pool is a committed, curated candidate list (~140 public-repo markdown
 * files) spanning the PRD strata. Selection is a seeded shuffle inside each
 * stratum capped at its target — re-running with the same pool and seed
 * yields the same manifest. Candidate fetch failures are skipped and logged,
 * never fatal: the manifest records what actually landed.
 *
 * Commit SHAs are resolved per file via the GitHub commits API when
 * GITHUB_TOKEN is present (falls back to 'HEAD', marked unresolved, without).
 *
 * Golden fetching is delegated to fetch-goldens.mjs — the single canonical
 * POST /markdown path, rate-limit-aware and resumable.
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
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

/**
 * Curated candidate pool — every entry is a public-repo markdown file.
 * Format: [id, owner/repo, path, strata]. Entries are best-effort: if a file
 * has moved or does not exist, the build logs and skips it instead of dying.
 */
const POOL = [
  // ── readme_majority — developer tooling, wide language/star spread ──
  ['react-readme', 'facebook/react', 'README.md', 'readme_majority'],
  ['vite-readme', 'vitejs/vite', 'README.md', 'readme_majority'],
  ['rust-readme', 'rust-lang/rust', 'README.md', 'readme_majority'],
  ['tokio-readme', 'tokio-rs/tokio', 'README.md', 'readme_majority'],
  ['vscode-readme', 'microsoft/vscode', 'README.md', 'readme_majority'],
  ['typescript-readme', 'microsoft/TypeScript', 'README.md', 'readme_majority'],
  ['tailwindcss-readme', 'tailwindlabs/tailwindcss', 'README.md', 'readme_majority'],
  ['zod-readme', 'colinhacks/zod', 'README.md', 'readme_majority'],
  ['excalidraw-readme', 'excalidraw/excalidraw', 'README.md', 'readme_majority'],
  ['ripgrep-readme', 'BurntSushi/ripgrep', 'README.md', 'readme_majority'],
  ['fd-readme', 'sharkdp/fd', 'README.md', 'readme_majority'],
  ['bat-readme', 'sharkdp/bat', 'README.md', 'readme_majority'],
  ['deno-readme', 'denoland/deno', 'README.md', 'readme_majority'],
  ['go-readme', 'golang/go', 'README.md', 'readme_majority'],
  ['kubernetes-readme', 'kubernetes/kubernetes', 'README.md', 'readme_majority'],
  ['moby-readme', 'moby/moby', 'README.md', 'readme_majority'],
  ['flask-readme', 'pallets/flask', 'README.md', 'readme_majority'],
  ['fastapi-readme', 'fastapi/fastapi', 'README.md', 'readme_majority'],
  ['pydantic-readme', 'pydantic/pydantic', 'README.md', 'readme_majority'],
  ['express-readme', 'expressjs/express', 'Readme.md', 'readme_majority'],
  ['prisma-readme', 'prisma/prisma', 'README.md', 'readme_majority'],
  ['graphql-js-readme', 'graphql/graphql-js', 'README.md', 'readme_majority'],
  ['redis-readme', 'redis/redis', 'README.md', 'readme_majority'],
  ['prometheus-readme', 'prometheus/prometheus', 'README.md', 'readme_majority'],
  ['grafana-readme', 'grafana/grafana', 'README.md', 'readme_majority'],
  ['vue-core-readme', 'vuejs/core', 'README.md', 'readme_majority'],
  ['svelte-readme', 'sveltejs/svelte', 'README.md', 'readme_majority'],
  ['react-native-readme', 'facebook/react-native', 'README.md', 'readme_majority'],
  ['angular-readme', 'angular/angular', 'README.md', 'readme_majority'],
  ['lodash-readme', 'lodash/lodash', 'README.md', 'readme_majority'],
  ['axios-readme', 'axios/axios', 'README.md', 'readme_majority'],
  ['d3-readme', 'd3/d3', 'README.md', 'readme_majority'],
  ['chartjs-readme', 'chartjs/Chart.js', 'README.md', 'readme_majority'],
  ['mermaid-readme', 'mermaid-js/mermaid', 'README.md', 'readme_majority'],
  ['comrak-readme', 'kivikakk/comrak', 'README.md', 'readme_majority'],
  ['cmark-gfm-readme', 'github/cmark-gfm', 'README.md', 'readme_majority'],
  ['markdown-it-readme', 'markdown-it/markdown-it', 'README.md', 'readme_majority'],
  ['marked-readme', 'markedjs/marked', 'README.md', 'readme_majority'],
  ['micromark-readme', 'micromark/micromark', 'readme.md', 'readme_majority'],
  ['mdx-readme', 'mdx-js/mdx', 'README.md', 'readme_majority'],
  ['react-router-readme', 'remix-run/react-router', 'README.md', 'readme_majority'],
  ['nextjs-readme', 'vercel/next.js', 'readme.md', 'readme_majority'],
  ['solid-readme', 'solidjs/solid', 'README.md', 'readme_majority'],
  ['preact-readme', 'preactjs/preact', 'README.md', 'readme_majority'],
  ['ant-design-readme', 'ant-design/ant-design', 'README.md', 'readme_majority'],
  ['material-ui-readme', 'mui/material-ui', 'README.md', 'readme_majority'],
  ['shadcn-ui-readme', 'shadcn-ui/ui', 'README.md', 'readme_majority'],
  ['radix-readme', 'radix-ui/primitives', 'README.md', 'readme_majority'],
  ['tanstack-query-readme', 'TanStack/query', 'README.md', 'readme_majority'],
  ['redux-readme', 'reduxjs/redux', 'README.md', 'readme_majority'],
  ['zustand-readme', 'pmndrs/zustand', 'README.md', 'readme_majority'],
  ['node-readme', 'nodejs/node', 'README.md', 'readme_majority'],
  ['hyperfine-readme', 'sharkdp/hyperfine', 'README.md', 'readme_majority'],
  ['exa-readme', 'ogham/exa', 'README.md', 'readme_majority'],
  ['fzf-readme', 'junegunn/fzf', 'README.md', 'readme_majority'],
  ['neovim-readme', 'neovim/neovim', 'README.md', 'readme_majority'],
  ['helix-readme', 'helix-editor/helix', 'README.md', 'readme_majority'],
  ['alacritty-readme', 'alacritty/alacritty', 'README.md', 'readme_majority'],
  ['starship-readme', 'starship/starship', 'README.md', 'readme_majority'],
  ['zellij-readme', 'zellij-org/zellij', 'README.md', 'readme_majority'],
  ['wezterm-readme', 'wezterm/wezterm', 'README.md', 'readme_majority'],
  ['delta-readme', 'dandavison/delta', 'README.md', 'readme_majority'],
  ['libgit2-readme', 'libgit2/libgit2', 'README.md', 'readme_majority'],
  ['gh-cli-readme', 'cli/cli', 'README.md', 'readme_majority'],
  ['gitea-readme', 'go-gitea/gitea', 'README.md', 'readme_majority'],
  ['semver-readme', 'semver/semver', 'README.md', 'readme_majority'],
  ['keepachangelog-readme', 'olivierlacan/keep-a-changelog', 'README.md', 'readme_majority'],

  // ── longform_docs — prose-heavy documentation files ──
  ['react-contributing', 'facebook/react', 'CONTRIBUTING.md', 'longform_docs'],
  ['electron-contributing', 'electron/electron', 'CONTRIBUTING.md', 'longform_docs'],
  ['vscode-testing-docs', 'microsoft/vscode', 'test/README.md', 'longform_docs'],
  ['cargo-contributing', 'rust-lang/cargo', 'CONTRIBUTING.md', 'longform_docs'],
  ['comrak-changelog', 'kivikakk/comrak', 'CHANGELOG.md', 'longform_docs'],
  ['kubernetes-contributing', 'kubernetes/kubernetes', 'CONTRIBUTING.md', 'longform_docs'],
  ['istio-architecture', 'istio/istio', 'ARCHITECTURE.md', 'longform_docs'],
  ['grafana-contributing', 'grafana/grafana', 'CONTRIBUTING.md', 'longform_docs'],
  ['spark-readme', 'apache/spark', 'README.md', 'longform_docs'],
  ['superset-contributing', 'apache/superset', 'CONTRIBUTING.md', 'longform_docs'],
  ['prometheus-contributing', 'prometheus/prometheus', 'CONTRIBUTING.md', 'longform_docs'],
  ['moby-contributing', 'moby/moby', 'CONTRIBUTING.md', 'longform_docs'],
  ['axios-changelog', 'axios/axios', 'CHANGELOG.md', 'longform_docs'],
  ['react-hooks-docs', 'facebook/react', 'packages/eslint-plugin-react-hooks/README.md', 'longform_docs'],
  ['typescript-spec-notes', 'microsoft/TypeScript', 'spec.md', 'longform_docs'],
  ['nextjs-contributing', 'vercel/next.js', 'contributing/README.md', 'longform_docs'],
  ['vue-contributing', 'vuejs/core', 'CONTRIBUTING.md', 'longform_docs'],
  ['svelte-contributing', 'sveltejs/svelte', 'CONTRIBUTING.md', 'longform_docs'],
  ['deno-contributing', 'denoland/deno', 'CONTRIBUTING.md', 'longform_docs'],
  ['neovim-contributing', 'neovim/neovim', 'CONTRIBUTING.md', 'longform_docs'],
  ['vscode-api-notes', 'microsoft/vscode', 'src/vs/workbench/api/common/extHostTypes.ts' /* not md — expect skip */, 'longform_docs'],
  ['django-wiki-skip-guard', 'django/django', 'docs/README.rst', 'longform_docs'],
  ['flask-changelog', 'pallets/flask', 'CHANGES.rst', 'longform_docs'],
  ['helm-architecture', 'helm/helm', 'ARCHITECTURE.md', 'longform_docs'],
  ['terraform-architecture', 'hashicorp/terraform', 'ARCHITECTURE.md', 'longform_docs'],
  ['react-mdn-fetch', 'mdn/content', 'files/en-us/web/api/fetch/index.md', 'longform_docs'],
  ['mdn-flexbox', 'mdn/content', 'files/en-us/learn/css/css_layout/flexbox/index.md', 'longform_docs'],
  ['rust-book-std', 'rust-lang/book', 'src/ch04-00-understanding-ownership.md', 'longform_docs'],
  ['rust-async-book', 'rust-lang/async-book', 'src/01_getting_started/01_chapter.md', 'longform_docs'],
  ['cargo-book', 'rust-lang/cargo', 'src/doc/contrib/process/release.md', 'longform_docs'],

  // ── gfm_rich — tables + task lists + alerts + fences together ──
  ['gemoji-readme', 'github/gemoji', 'README.md', 'gfm_rich'],
  ['dompurify-readme', 'cure53/DOMPurify', 'README.md', 'gfm_rich'],
  ['beads-readme', 'gastownhall/beads', 'README.md', 'gfm_rich'],
  ['markitdown-readme', 'microsoft/markitdown', 'README.md', 'gfm_rich'],
  ['astro-readme', 'withastro/astro', 'README.md', 'gfm_rich'],
  ['chakra-readme', 'chakra-ui/chakra-ui', 'README.md', 'gfm_rich'],
  ['react-use-readme', 'streamich/react-use', 'README.md', 'gfm_rich'],
  ['vite-changelog', 'vitejs/vite', 'CHANGELOG.md', 'gfm_rich'],
  ['ripgrep-guide', 'BurntSushi/ripgrep', 'GUIDE.md', 'gfm_rich'],
  ['bat-style-guide', 'sharkdp/bat', 'doc/custom-assets.md', 'gfm_rich'],
  ['gh-cli-manual', 'cli/cli', 'docs/gh.md' /* expect possible skip */, 'gfm_rich'],
  ['tailwind-upgrade', 'tailwindlabs/tailwindcss', 'UPGRADING.md', 'gfm_rich'],
  ['zod-notes', 'colinhacks/zod', 'CHANGELOG.md', 'gfm_rich'],
  ['pnpm-readme', 'pnpm/pnpm', 'README.md', 'gfm_rich'],
  ['biome-readme', 'biomejs/biome', 'README.md', 'gfm_rich'],
  ['rolldown-readme', 'rolldown/rolldown', 'README.md', 'gfm_rich'],
  ['oxc-readme', 'oxc-project/oxc', 'README.md', 'gfm_rich'],
  ['uv-readme', 'astral-sh/uv', 'README.md', 'gfm_rich'],
  ['ruff-readme', 'astral-sh/ruff', 'README.md', 'gfm_rich'],
  ['ty-jupyter', 'jupyter/jupyter', 'README.md', 'gfm_rich'],

  // ── adversarial — raw HTML, footnotes, deep nesting, odd constructs ──
  ['pandoc-readme', 'jgm/pandoc', 'README.md', 'adversarial'],
  ['ohmyzsh-readme', 'ohmyzsh/ohmyzsh', 'README.md', 'adversarial'],
  ['brew-readme', 'Homebrew/brew', 'README.md', 'adversarial'],
  ['rails-readme', 'rails/rails', 'README.md', 'adversarial'],
  ['kotlin-readme', 'JetBrains/kotlin', 'README.md', 'adversarial'],
  ['commonmark-spec-readme', 'commonmark/commonmark-spec', 'README.md', 'adversarial'],
  ['commonmark-docs', 'commonmark/commonmark-spec', 'spec.txt', 'adversarial'],
  ['xss-filter-readme', 'cure53/DOMPurify', 'hooks/README.md', 'adversarial'],
  ['gfm-spec-readme', 'github/gfm', 'README.md' /* expect possible skip */, 'adversarial'],
  ['dockerfile-reference', 'moby/moby', 'docs/reference/builder.md', 'adversarial'],
  ['gitglossary', 'git/git', 'Documentation/glossary-content.txt', 'adversarial'],
  ['git-pretty-formats', 'git/git', 'Documentation/pretty-formats.adoc', 'adversarial'],
  ['ffmpeg-filters', 'FFmpeg/FFmpeg', 'doc/filters.texi', 'adversarial'],
  ['systemd-docs', 'systemd/systemd', 'docs/ENVIRONMENT.md', 'adversarial'],
  ['zsh-expansions', 'zsh-users/zsh', 'Doc/Zsh/expn.yo', 'adversarial'],

  // ── expansion pass (2026-09-20): fill the 5–200 KB band toward 100 docs ──
  ['electron-readme', 'electron/electron', 'README.md', 'readme_majority'],
  ['hugo-readme', 'gohugoio/hugo', 'README.md', 'readme_majority'],
  ['terraform-readme', 'hashicorp/terraform', 'README.md', 'readme_majority'],
  ['ansible-readme', 'ansible/ansible', 'README.md', 'readme_majority'],
  ['helm-readme', 'helm/helm', 'README.md', 'readme_majority'],
  ['caddy-readme', 'caddyserver/caddy', 'README.md', 'readme_majority'],
  ['ollama-readme', 'ollama/ollama', 'README.md', 'readme_majority'],
  ['ytdlp-readme', 'yt-dlp/yt-dlp', 'README.md', 'readme_majority'],
  ['qutebrowser-readme', 'qutebrowser/qutebrowser', 'README.md', 'readme_majority'],
  ['mpv-readme', 'mpv-player/mpv', 'README.md', 'readme_majority'],
  ['jq-readme', 'jqlang/jq', 'README.md', 'readme_majority'],
  ['bubbletea-readme', 'charmbracelet/bubbletea', 'README.md', 'readme_majority'],
  ['lipgloss-readme', 'charmbracelet/lipgloss', 'README.md', 'readme_majority'],
  ['zoxide-readme', 'ajeetdsouza/zoxide', 'README.md', 'readme_majority'],
  ['curl-readme', 'curl/curl', 'README.md', 'readme_majority'],
  ['openssl-readme', 'openssl/openssl', 'README.md', 'readme_majority'],
  ['vuetify-readme', 'vuetifyjs/vuetify', 'README.md', 'readme_majority'],
  ['element-plus-readme', 'element-plus/element-plus', 'README.md', 'readme_majority'],
  ['storybook-readme', 'storybookjs/storybook', 'README.md', 'readme_majority'],
  ['cypress-readme', 'cypress-io/cypress', 'README.md', 'readme_majority'],
  ['vitest-readme', 'vitest-dev/vitest', 'README.md', 'readme_majority'],
  ['playwright-readme', 'microsoft/playwright', 'README.md', 'readme_majority'],
  ['puppeteer-readme', 'puppeteer/puppeteer', 'README.md', 'readme_majority'],
  ['got-readme', 'sindresorhus/got', 'readme.md', 'readme_majority'],
  ['node-contributing', 'nodejs/node', 'CONTRIBUTING.md', 'longform_docs'],
  ['node-api-docs', 'nodejs/node', 'doc/api/documentation.md', 'longform_docs'],
  ['node-url-docs', 'nodejs/node', 'doc/api/url.md', 'longform_docs'],
  ['node-fs-docs', 'nodejs/node', 'doc/api/fs.md', 'longform_docs'],
  ['rust-contributing', 'rust-lang/rust', 'CONTRIBUTING.md', 'longform_docs'],
  ['rust-dev-guide', 'rust-lang/rust', 'rustc-dev-guide/README.md', 'longform_docs'],
  ['golang-contributing', 'golang/go', 'CONTRIBUTING.md', 'longform_docs'],
  ['typescript-contributing', 'microsoft/TypeScript', 'CONTRIBUTING.md', 'longform_docs'],
  ['electron-dev-docs', 'electron/electron', 'docs/development/README.md', 'longform_docs'],
  ['electron-style-docs', 'electron/electron', 'docs/development/style-guide.md', 'longform_docs'],
  ['react-book-thinking', 'reactjs/react.dev', 'src/content/learn/thinking-in-react.md', 'longform_docs'],
  ['react-useeffect-ref', 'reactjs/react.dev', 'src/content/reference/react/useEffect.md', 'longform_docs'],
  ['react-usestate-ref', 'reactjs/react.dev', 'src/content/reference/react/useState.md', 'longform_docs'],
  ['react-useref-ref', 'reactjs/react.dev', 'src/content/reference/react/useRef.md', 'longform_docs'],
  ['book-ownership', 'rust-lang/book', 'src/ch04-00-understanding-ownership.md', 'longform_docs'],
  ['book-generics', 'rust-lang/book', 'src/ch10-00-generics.md', 'longform_docs'],
  ['book-smart-pointers', 'rust-lang/book', 'src/ch15-00-smart-pointers.md', 'longform_docs'],
  ['book-threads', 'rust-lang/book', 'src/ch16-00-concurrency.md', 'longform_docs'],
  ['async-book-await', 'rust-lang/async-book', 'src/03_async_await/01_chapter.md', 'longform_docs'],
  ['async-book-pinning', 'rust-lang/async-book', 'src/04_pinning/01_chapter.md', 'longform_docs'],
  ['mdn-event-loop', 'mdn/content', 'files/en-us/web/apis/javascript_asynchronous_programming/event_loop/index.md', 'longform_docs'],
  ['mdn-promises', 'mdn/content', 'files/en-us/web/apis/promises/index.md' /* name varies; skips are safe */, 'longform_docs'],
  ['mdn-css-grid', 'mdn/content', 'files/en-us/web/css/css_grid_layout/index.md' /* name varies; skips are safe */, 'longform_docs'],
  ['yarn-berry-readme', 'yarnpkg/berry', 'README.md', 'gfm_rich'],
  ['jest-readme', 'jestjs/jest', 'README.md', 'gfm_rich'],
  ['prettier-readme', 'prettier/prettier', 'README.md', 'gfm_rich'],
  ['typescript-eslint-readme', 'typescript-eslint/typescript-eslint', 'README.md', 'gfm_rich'],
  ['eslint-readme', 'eslint/eslint', 'README.md', 'gfm_rich'],
  ['bun-readme', 'oven-sh/bun', 'README.md', 'gfm_rich'],
  ['dioxus-readme', 'DioxusLabs/dioxus', 'README.md', 'gfm_rich'],
  ['tauri-readme', 'tauri-apps/tauri', 'README.md', 'gfm_rich'],
  ['shiki-readme', 'shikijs/shiki', 'README.md', 'gfm_rich'],
  ['katex-readme', 'KaTeX/KaTeX', 'README.md', 'adversarial'],
  ['katex-api-docs', 'KaTeX/KaTeX', 'docs/api.md', 'adversarial'],
  ['katex-supported', 'KaTeX/KaTeX', 'docs/supported.md', 'adversarial'],
  ['mathjax-readme', 'mathjax/MathJax', 'README.md', 'adversarial'],
  ['bootstrap-readme', 'twbs/bootstrap', 'README.md', 'adversarial'],
  ['mermaid-getting-started', 'mermaid-js/mermaid', 'docs/intro/getting-started.md', 'adversarial'],
  ['mermaid-syntax', 'mermaid-js/mermaid', 'docs/syntax/flowchart.md', 'adversarial'],
  ['mdn-document-api', 'mdn/content', 'files/en-us/web/api/document/index.md', 'adversarial'],
  ['deno-style-docs', 'denoland/deno', 'docs/contributing/style_guide.md', 'adversarial'],
  ['rust-unstable-doc', 'rust-lang/rust', 'src/doc/unstable-book/src/language-features.md', 'adversarial'],
];

function slug(id) {
  return id.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/**
 * Discovered pool (fidelity/src/corpus-pool.json) from real repo trees via the
 * GitHub API (see discover-pool.mjs), merged with the curated list above.
 * The merged pool is committed, so the seeded selection stays reproducible.
 */
let discovered = [];
const poolPath = join(root, 'src', 'corpus-pool.json');
if (existsSync(poolPath)) {
  discovered = JSON.parse(readFileSync(poolPath, 'utf8')).pool ?? [];
}
const FULL_POOL = [...POOL, ...discovered];
const seenIds = new Set();
const DEDUPED_POOL = FULL_POOL.filter(([id]) => (seenIds.has(id) ? false : (seenIds.add(id), true)));

async function fetchRaw(ownerRepo, ref, path) {
  const url = `https://raw.githubusercontent.com/${ownerRepo}/${ref}/${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const text = await res.text();
  // raw returns 200 with this body for some missing paths — not a document.
  if (text.trim() === '404: Not Found' || text.length < 200) throw new Error(`stub body (${text.length} B) ${url}`);
  return text;
}

/** Resolve the latest commit SHA touching this file (needs token for good rate limits). */
async function resolveSha(ownerRepo, path, token, cache) {
  const key = `${ownerRepo}#${path}`;
  if (cache.has(key)) return cache.get(key);
  let sha = null;
  try {
    const url = `https://api.github.com/repos/${ownerRepo}/commits?path=${encodeURIComponent(path)}&per_page=1`;
    const headers = { Accept: 'application/vnd.github+json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(url, { headers });
    if (res.ok) {
      const commits = await res.json();
      if (Array.isArray(commits) && commits[0]?.sha) sha = commits[0].sha;
    }
  } catch {
    // fall through — SHA stays unresolved
  }
  const value = sha ?? 'HEAD-unresolved';
  cache.set(key, value);
  return value;
}

export async function buildCorpus({ limitPerStrata = Infinity } = {}) {
  const rand = prng(SEED);

  // Per stratum: pre-filter tree-verified sizes (5th element), seeded-shuffle,
  // keep the whole ordered list — we fetch down it until the stratum's target
  // is actually met, so a 404 or an out-of-band file costs one candidate, not
  // one document slot.
  const perStrata = {};
  for (const entry of DEDUPED_POOL) {
    const bytes = entry[4];
    if (bytes !== undefined && (bytes < 5 * 1024 || bytes > 200 * 1024)) continue;
    (perStrata[entry[3]] ??= []).push(entry);
  }
  for (const entries of Object.values(perStrata)) {
    entries.sort(() => rand() - 0.5);
  }
  const strataOrder = Object.keys(STRATA_TARGETS).filter((s) => (perStrata[s] ?? []).length > 0);

  const token = process.env.GITHUB_TOKEN ?? undefined;
  const shaCache = new Map();
  const documents = [];
  const counts = {};
  let failed = 0;
  const cursor = Object.fromEntries(strataOrder.map((s) => [s, 0]));

  const totalTarget = Object.values(STRATA_TARGETS).reduce((a, b) => Math.min(a + b, a + b), 0);
  let progressed = true;
  while (documents.length < totalTarget && progressed) {
    progressed = false;
    for (const strata of strataOrder) {
      const target = Math.min(STRATA_TARGETS[strata], limitPerStrata);
      if ((counts[strata] ?? 0) >= target) continue;
      const list = perStrata[strata];
      if (cursor[strata] >= list.length) continue;
      progressed = true;
      const entry = list[cursor[strata]++];
      const [, ownerRepo, path] = entry;
      const docId = slug(entry[0]);
      try {
        const source = await fetchRaw(ownerRepo, 'HEAD', path);
        writeFileSync(join(root, 'corpus', `${docId}.md`), source);
        const sha = await resolveSha(ownerRepo, path, token, shaCache);
        documents.push({
          id: docId,
          sourceUrl: `https://github.com/${ownerRepo}/blob/${sha}/${path}`,
          commitSha: sha,
          strata,
          bytes: source.length,
        });
        counts[strata] = (counts[strata] ?? 0) + 1;
        process.stdout.write(`source ${docId} (${source.length} B)\n`);
      } catch (error) {
        failed += 1;
        console.warn(`skipped ${docId} (${ownerRepo}/${path}): ${error.message}`);
      }
    }
  }
  if (failed > 0) console.warn(`${failed} candidates skipped (fetch failures are non-fatal)`);

  // Size guard from the OQ-1 rule: 5–200 KB per document (defence in depth —
  // tree sizes and the stub filter should have kept the band already).
  const sized = documents.filter((d) => d.bytes >= 5 * 1024 && d.bytes <= 200 * 1024);
  const dropped = documents.length - sized.length;
  if (dropped > 0) console.log(`dropped ${dropped} outside the 5–200 KB band`);

  const filled = {};
  for (const d of sized) filled[d.strata] = (filled[d.strata] ?? 0) + 1;
  console.log(`strata filled: ${JSON.stringify(filled)} of targets ${JSON.stringify(STRATA_TARGETS)}`);

  writeFileSync(
    join(root, 'corpus', 'manifest.json'),
    JSON.stringify(
      {
        seedDescription: `mulberry32(${SEED}); curated pool (${DEDUPED_POOL.length} candidates); strata targets ${JSON.stringify(STRATA_TARGETS)}`,
        generatedAt: new Date().toISOString(),
        documents: sized,
      },
      null,
      2,
    ) + '\n',
  );
  return sized;
}

async function main() {
  mkdirSync(join(root, 'corpus'), { recursive: true });
  const documents = await buildCorpus({});
  console.log(`\ncorpus built: ${documents.length} documents — fetching goldens via fetch-goldens.mjs\n`);
  const { main: fetchMain } = await import('./fetch-goldens.mjs');
  await fetchMain();
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) await main();
