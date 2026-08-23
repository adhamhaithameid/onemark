/**
 * Golden fetcher (task 1.10) — deliberately manual, never automatic.
 *
 * Reads `corpus/manifest.json` (the frozen OQ-1 selection: id, source URL,
 * commit SHA), renders each source through **GitHub's own renderer**
 * (`POST /markdown`, gfm mode), and stores responses as committed goldens.
 *
 * Requires GITHUB_TOKEN in the environment: unauthenticated limits are far
 * below a 100-document run. Rate-limit headers are honored — the script sleeps
 * until reset rather than hammering.
 *
 * This module is intentionally NOT imported by tests: its contract is network.
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function checkEnv() {
  if (!process.env.GITHUB_TOKEN) {
    console.error('GITHUB_TOKEN is required (unauthenticated limits are too low for a corpus run).');
    process.exit(2);
  }
}

export function loadCorpus() {
  const path = join(root, 'corpus', 'manifest.json');
  if (!existsSync(path)) {
    console.error(`Missing ${path} — author the OQ-1 selection first.`);
    process.exit(2);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

export async function fetchGolden(token, sourceMarkdown) {
  const res = await fetch('https://api.github.com/markdown', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: sourceMarkdown, mode: 'gfm' }),
  });
  if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
    const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
    const waitMs = Math.max(0, reset - Date.now()) + 1000;
    console.log(`rate limited; sleeping ${Math.ceil(waitMs / 60000)} min`);
    await new Promise((r) => setTimeout(r, waitMs));
    return fetchGolden(token, sourceMarkdown);
  }
  if (!res.ok) throw new Error(`github api ${res.status}`);
  return res.text();
}

export async function main() {
  checkEnv();
  const corpus = loadCorpus();
  const documents = corpus.documents ?? [];
  mkdirSync(join(root, 'golden'), { recursive: true });

  let done = 0;
  for (const doc of documents) {
    const out = join(root, 'golden', `${doc.id}.html`);
    if (existsSync(out)) {
      done += 1;
      continue;
    }
    const html = await fetchGolden(process.env.GITHUB_TOKEN, readFileSync(doc.localPath, 'utf8'));
    writeFileSync(out, html);
    done += 1;
    console.log(`${done}/${documents.length} ${doc.id}`);
  }

  // Freeze what was fetched: ids + source coordinates, nothing else.
  writeFileSync(
    join(root, 'golden', 'manifest.json'),
    JSON.stringify(
      { generatedAt: new Date().toISOString(), documents: documents.map(({ id, sourceUrl, commitSha }) => ({ id, sourceUrl, commitSha })) },
      null,
      2,
    ) + '\n',
  );
  console.log(`goldens written: ${documents.length}`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) await main();
