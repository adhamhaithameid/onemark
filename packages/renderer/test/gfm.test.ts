/**
 * **Metric M4 — GFM extension conformance, target 100%.**
 *
 * Only the cases upstream actually runs are gated. Two task-list cases are
 * labelled `disabled` in cmark-gfm's own suite because its output disagrees with
 * the spec prose; OneMark follows cmark-gfm rather than the prose, for the
 * reasons in `fidelity/spec/README.md`. Those two are reported, never gated.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { beforeAll, describe, it } from 'vitest';

import { loadNodeEngine } from '@onemark/engine/node';
import { type ParseOptions } from '@onemark/engine';

import { renderToUnsafeHtml } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));

interface Case {
  markdown: string;
  html: string;
  example: number;
  section: string;
  extension: string;
}

/** Extensions the GFM spec assumes. Footnotes, math and frontmatter are not part of it. */
const GFM_SPEC_OPTIONS: ParseOptions = {
  dialect: 'gfm',
  extensions: {
    tables: true, strikethrough: true, autolink: true, taskList: true,
    footnotes: false, alerts: false, math: false, frontmatter: false,
  },
};

let engine: Awaited<ReturnType<typeof loadNodeEngine>>;
let cases: Case[];

beforeAll(async () => {
  engine = await loadNodeEngine();
  cases = JSON.parse(readFileSync(join(here, '../../../fidelity/spec/gfm-0.29.json'), 'utf8'));
});

async function run(subset: Case[]) {
  const failures: { example: number; extension: string; got: string; want: string }[] = [];
  let passed = 0;

  for (const testCase of subset) {
    let got: string;
    try {
      // Conformance measures the parser: the spec requires exotic URL
      // schemes to survive, so the viewer-side URL policy is off here.
      got = renderToUnsafeHtml(await engine.parse(testCase.markdown, GFM_SPEC_OPTIONS), {
        urlPolicy: false,
      });
    } catch (error) {
      got = `<<threw: ${String(error)}>>`;
    }
    if (got === testCase.html) passed += 1;
    else failures.push({ example: testCase.example, extension: testCase.extension, got, want: testCase.html });
  }
  return { passed, failures };
}

describe('GFM extension conformance', () => {
  it('meets M4 (100% of the gated extension cases)', async () => {
    const gated = cases.filter((c) => c.extension !== '' && c.extension !== 'disabled');
    const { passed, failures } = await run(gated);
    const rate = (passed / gated.length) * 100;

    console.log(`\nGFM 0.29 extensions — ${passed}/${gated.length} (${rate.toFixed(2)}%), M4 requires 100%`);

    const byExt = new Map<string, number>();
    for (const f of failures) byExt.set(f.extension, (byExt.get(f.extension) ?? 0) + 1);
    for (const [ext, n] of byExt) console.log(`  ${ext.padEnd(16)} ${n} failing`);

    for (const f of failures.slice(0, 4)) {
      console.log(`  example ${f.example} (${f.extension})`);
      console.log(`    want: ${JSON.stringify(f.want)}`);
      console.log(`    got:  ${JSON.stringify(f.got)}`);
    }

    if (passed !== gated.length) {
      throw new Error(`GFM extension conformance ${rate.toFixed(2)}% is below M4's 100%`);
    }
  });

  it('reports the two cases upstream disables, without gating on them', async () => {
    const disabled = cases.filter((c) => c.extension === 'disabled');
    const { passed, failures } = await run(disabled);
    console.log(`\ntask-list cases disabled upstream — ${passed}/${disabled.length} match the spec prose`);
    for (const f of failures) {
      console.log(`  example ${f.example}`);
      console.log(`    spec prose: ${JSON.stringify(f.want)}`);
      console.log(`    OneMark:    ${JSON.stringify(f.got)}`);
    }
  });
});
