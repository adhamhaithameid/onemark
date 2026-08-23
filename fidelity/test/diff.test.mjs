import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runDiff, rate } from '../src/diff.mjs';

/**
 * Offline proof of the M5 runner mechanics: a tiny fake corpus whose golden
 * is GitHub-shaped (anchors, dir attrs) and whose ours-side is OneMark-shaped.
 * After R1–R6 the two must compare equal; a corrupted golden must not.
 */

describe('M5 diff runner mechanics', () => {
  it('rates an empty run as 0 and fails the gate', () => {
    expect(rate([])).toBe(0);
  });

  it('matches normalized-equivalent documents and rejects corrupted ones', async () => {
    const corpus = mkdtempSync(join(tmpdir(), 'onemark-m5-'));
    const golden = join(corpus, 'golden');
    const sourceDir = join(corpus, 'corpus');
    mkdirSync(golden, { recursive: true });
    mkdirSync(sourceDir, { recursive: true });

    writeFileSync(
      join(golden, 'doc.html'),
      '<h2 dir="auto"><a id="user-content-s" class="anchor" href="#s"></a>Section</h2>\n<p dir="auto">Body <g-emoji alias="+1">👍</g-emoji></p>',
    );
    writeFileSync(join(sourceDir, 'doc.md'), '## Section\n\nBody 👍\n');
    // A second document whose golden disagrees on real content.
    writeFileSync(join(golden, 'bad.html'), '<p>Different text entirely</p>');
    writeFileSync(join(sourceDir, 'bad.md'), '## Section\n\nBody 👍\n');

    const { results, rate: passRate } = await runDiff({ goldenDir: golden, corpusDir: sourceDir });
    expect(results).toHaveLength(2);
    expect(results.find((r) => r.id === 'doc')?.equal).toBe(true);
    expect(results.find((r) => r.id === 'bad')?.equal).toBe(false);
    expect(passRate).toBeCloseTo(0.5);
  });
});
