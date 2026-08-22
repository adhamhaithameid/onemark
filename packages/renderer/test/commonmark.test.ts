/**
 * **Metric M3, for real this time.**
 *
 * In M0 the CommonMark suite ran against comrak's own HTML formatter, which
 * answered "is the engine we chose conformant?". This runs it against
 * OneMark's render path — engine → AST → our renderer — which is what actually
 * ships, and is what M3 was always meant to gate.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { beforeAll, describe, it } from 'vitest';

import { loadNodeEngine, type MarkdownNode } from '@onemark/engine';
import type { ParseOptions } from '@onemark/engine';

import { renderToUnsafeHtml } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));

interface Case {
  markdown: string;
  html: string;
  example: number;
  section: string;
}

/** The pass-rate M3 requires. */
const M3_THRESHOLD = 99;

/**
 * CommonMark is measured with every extension **off**: autolinks, strikethrough
 * and the rest change the expected output, so leaving them on would be measuring
 * a different specification.
 */
const COMMONMARK_ONLY: ParseOptions = {
  dialect: 'gfm',
  extensions: {
    tables: false, strikethrough: false, autolink: false, taskList: false,
    footnotes: false, alerts: false, math: false, frontmatter: false,
  },
};

let engine: Awaited<ReturnType<typeof loadNodeEngine>>;
let cases: Case[];

beforeAll(async () => {
  engine = await loadNodeEngine();
  cases = JSON.parse(
    readFileSync(join(here, '../../../fidelity/spec/commonmark-0.31.2.json'), 'utf8'),
  );
});

describe('CommonMark conformance of the render path', () => {
  it(`meets M3 (>= ${M3_THRESHOLD}%)`, async () => {
    let passed = 0;
    const failures: { example: number; section: string; got: string; want: string }[] = [];

    for (const testCase of cases) {
      let got: string;
      try {
        const ast: MarkdownNode = await engine.parse(testCase.markdown, COMMONMARK_ONLY);
        // tagfilter is a GFM extension, not CommonMark: leaving it on escapes
        // `<script>` and measures a different specification.
        got = renderToUnsafeHtml(ast, { tagfilter: false, urlPolicy: false });
      } catch (error) {
        got = `<<threw: ${String(error)}>>`;
      }

      if (got === testCase.html) {
        passed += 1;
      } else {
        failures.push({
          example: testCase.example,
          section: testCase.section,
          got,
          want: testCase.html,
        });
      }
    }

    const rate = (passed / cases.length) * 100;
    console.log(
      `\nCommonMark 0.31.2 via OneMark's renderer — ${passed}/${cases.length} (${rate.toFixed(2)}%), M3 requires ${M3_THRESHOLD}%`,
    );

    if (failures.length > 0) {
      const bySection = new Map<string, number[]>();
      for (const f of failures) {
        const list = bySection.get(f.section) ?? [];
        list.push(f.example);
        bySection.set(f.section, list);
      }
      console.log('failing sections:');
      for (const [section, examples] of [...bySection].sort((a, b) => b[1].length - a[1].length)) {
        console.log(`  ${section.padEnd(32)} ${String(examples.length).padStart(3)}  e.g. ${examples.slice(0, 6).join(', ')}`);
      }
      console.log('\nfirst 3 diffs:');
      for (const f of failures.slice(0, 3)) {
        console.log(`  example ${f.example} (${f.section})`);
        console.log(`    want: ${JSON.stringify(f.want)}`);
        console.log(`    got:  ${JSON.stringify(f.got)}`);
      }
    }

    if (rate < M3_THRESHOLD) {
      throw new Error(`CommonMark conformance ${rate.toFixed(2)}% is below M3's ${M3_THRESHOLD}%`);
    }
  });
});
