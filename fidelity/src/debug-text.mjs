import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize } from './normalize.mjs';
import { loadNodeEngine } from '@onemark/engine/node';
import { renderToSafeHtml } from '@onemark/renderer';
import { JSDOM } from 'jsdom';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const id = process.argv[2];
const manifest = JSON.parse(readFileSync(join(root, 'corpus', 'manifest.json'), 'utf8'));
const doc = manifest.documents.find((d) => d.id === id);
const source = readFileSync(join(root, 'corpus', `${id}.md`), 'utf8');
const golden = readFileSync(join(root, 'golden', `${id}.html`), 'utf8');
const engine = await loadNodeEngine();
const ast = await engine.parse(source, { dialect: 'gfm', extensions: { tables: true, strikethrough: true, autolink: true, taskList: true, footnotes: true, alerts: true, math: true, frontmatter: true } });
const dom = new JSDOM('');
const ours = renderToSafeHtml(ast, { window: dom.window });
function preTexts(tree) {
  const out = [];
  (function walk(n) {
    if (n.tag === 'pre') out.push(n.children[0].value);
    for (const c of n.children ?? []) walk(c);
  })(tree);
  return out;
}
const A = preTexts(normalize(ours));
const B = preTexts(normalize(golden));
console.log(`pre counts: ours ${A.length}, theirs ${B.length}`);
for (let i = 0; i < Math.max(A.length, B.length); i++) {
  const a = A[i] ?? '(none)', b = B[i] ?? '(none)';
  if (a !== b) {
    let off = 0; while (off < Math.min(a.length, b.length) && a[off] === b[off]) off++;
    console.log(`pre[${i}] differs at offset ${off} (ours ${a.length}B, theirs ${b.length}B)`);
    console.log(`  ours  : ${JSON.stringify(a.slice(Math.max(0, off - 20), off + 30))}`);
    console.log(`  theirs: ${JSON.stringify(b.slice(Math.max(0, off - 20), off + 30))}`);
  } else {
    console.log(`pre[${i}] equal (${a.length}B)`);
  }
}
