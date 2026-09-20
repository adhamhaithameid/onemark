import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize } from './normalize.mjs';
import { loadNodeEngine } from '@onemark/engine/node';
import { renderToSafeHtml } from '@onemark/renderer';
import { JSDOM } from 'jsdom';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dom = new JSDOM('');
const engine = await loadNodeEngine();
const GFM_OPTIONS = { dialect: 'gfm', extensions: { tables: true, strikethrough: true, autolink: true, taskList: true, footnotes: true, alerts: true, math: true, frontmatter: true } };
function preTexts(tree) { const out = []; (function walk(n) { if (n.tag === 'pre') out.push(n.children[0]?.value ?? ''); for (const c of n.children ?? []) walk(c); })(tree); return out; }
const id = process.argv[2];
const source = readFileSync(join(root, 'corpus', `${id}.md`), 'utf8');
const ast = await engine.parse(source, GFM_OPTIONS);
const ours = renderToSafeHtml(ast, { window: dom.window });
const A = preTexts(normalize(ours));
const B = preTexts(normalize(readFileSync(join(root, 'golden', `${id}.html`), 'utf8')));
for (let i = 0; i < Math.max(A.length, B.length); i++) {
  const a = A[i] ?? '(none)', b = B[i] ?? '(none)';
  if (a !== b) {
    let off = 0; while (off < Math.min(a.length, b.length) && a[off] === b[off]) off++;
    console.log(`pre[${i}] off ${off} ours ${a.length}B theirs ${b.length}B`);
    console.log(`  ours  : ${JSON.stringify(a.slice(Math.max(0, off - 25), off + 25))}`);
    console.log(`  theirs: ${JSON.stringify(b.slice(Math.max(0, off - 25), off + 25))}`);
  }
}
