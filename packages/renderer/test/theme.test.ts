import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * ADR-0015 layer 1 + 2 for task 1.4: structural + computed-style assertions
 * of the vendored GitHub Markdown CSS against reference values transcribed
 * from github-markdown-css@5.8.1 at pin time. The literals below are the
 * independent source of truth — if a re-vendor changes upstream values,
 * these tests fail and force a conscious re-baseline (ADR-0015).
 *
 * Layer 3 (screenshot diff) lives in theme.browser.test.ts (opt-in).
 */

const here = dirname(fileURLToPath(import.meta.url));
const cssDir = join(here, '..', 'css');
const readCss = (name: string) => readFileSync(join(cssDir, name), 'utf8');

/** Extract the declaration block of the selector list starting with `selector`
 *  that actually declares `property` (upstream groups selectors; the font group
 *  for `code` precedes the padding/background block). */
function block(css: string, selector: string, property: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|\\n)${escaped}[^{]*\\{([^}]*)\\}`, 'g');
  const hasProperty = new RegExp(`(?:^|;)\\s*${property}\\s*:`, 'm');
  for (const m of css.matchAll(re)) {
    const body = m[1];
    if (body !== undefined && hasProperty.test(body)) return body;
  }
  throw new Error(`no block for ${selector} declaring ${property}`);
}

function decl(blockCss: string, property: string): string {
  const m = blockCss.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+);`, 'm'));
  const value = m?.[1];
  if (value === undefined) throw new Error(`property not found: ${property}`);
  return value.trim();
}

/** Reference values transcribed from github-markdown-css@5.8.1 (MIT). */
const REFERENCE = {
  light: {
    color: '#1f2328',
    backgroundColor: '#ffffff',
    codeBackground: '#818b981f',
    blockquoteColor: '#59636e',
    blockquoteBorderLeft: '.25em solid #d1d9e0',
    h2BorderBottom: '1px solid #d1d9e0b3',
    alertNoteBorderLeft: '#0969da',
  },
  dark: {
    color: '#f0f6fc',
    backgroundColor: '#0d1117',
    codeBackground: '#656c7633',
    blockquoteColor: '#9198a1',
    blockquoteBorderLeft: '.25em solid #3d444d',
    h2BorderBottom: '1px solid #3d444db3',
    alertNoteBorderLeft: '#1f6feb',
  },
} as const;

const THEMES = [
  { file: 'github-light.css', ref: REFERENCE.light },
  { file: 'github-dark.css', ref: REFERENCE.dark },
] as const;

const ALERT_KINDS = ['note', 'tip', 'important', 'warning', 'caution'] as const;

describe('vendored GitHub Markdown CSS (task 1.4, ADR-0015)', () => {
  it('both theme stylesheets and the attribution file exist', () => {
    expect(existsSync(join(cssDir, 'github-light.css'))).toBe(true);
    expect(existsSync(join(cssDir, 'github-dark.css'))).toBe(true);
    expect(existsSync(join(cssDir, 'ATTRIBUTION.md'))).toBe(true);
    for (const { file } of THEMES) {
      expect(readCss(file).length).toBeGreaterThan(10_000);
    }
  });

  for (const { file, ref } of THEMES) {
    describe(`${file}`, () => {
      const css = () => readCss(file);

      it('structurally styles the GitHub DOM shape (layer 1)', () => {
        const cssText = css();
        expect(cssText).toContain('.markdown-body {');
        for (const kind of ALERT_KINDS) {
          expect(cssText).toContain(`.markdown-alert.markdown-alert-${kind}`);
        }
        for (const selector of ['.markdown-body table {', '.markdown-body blockquote {', '.markdown-body pre {']) {
          expect(cssText).toContain(selector);
        }
      });

      it('is offline-safe: every url() is a data: URI (M2)', () => {
        const urls = [...css().matchAll(/url\(\s*['"]?([^'")]+)/g)].map((m) => m[1] ?? '');
        for (const u of urls) {
          expect(u.startsWith('data:')).toBe(true);
        }
      });

      it('matches the pinned upstream reference values (layer 2)', () => {
        const cssText = css();
        expect(decl(block(cssText, '.markdown-body', 'color'), 'color')).toBe(ref.color);
        expect(decl(block(cssText, '.markdown-body', 'background-color'), 'background-color')).toBe(
          ref.backgroundColor,
        );

        expect(decl(block(cssText, '.markdown-body code', 'background-color'), 'background-color')).toBe(
          ref.codeBackground,
        );

        const quote = block(cssText, '.markdown-body blockquote', 'border-left');
        expect(decl(quote, 'color')).toBe(ref.blockquoteColor);
        expect(decl(quote, 'border-left')).toBe(ref.blockquoteBorderLeft);

        expect(decl(block(cssText, '.markdown-body h2', 'border-bottom'), 'border-bottom')).toBe(
          ref.h2BorderBottom,
        );
        expect(
          decl(
            block(cssText, '.markdown-body .markdown-alert.markdown-alert-note', 'border-left-color'),
            'border-left-color',
          ),
        ).toBe(ref.alertNoteBorderLeft);
      });
    });
  }

  it('light and dark are genuinely different themes', () => {
    const light = block(readCss('github-light.css'), '.markdown-body', 'background-color');
    const dark = block(readCss('github-dark.css'), '.markdown-body', 'background-color');
    expect(decl(light, 'background-color')).not.toBe(decl(dark, 'background-color'));
    expect(
      decl(block(readCss('github-light.css'), '.markdown-body', 'color'), 'color'),
    ).not.toBe(decl(block(readCss('github-dark.css'), '.markdown-body', 'color'), 'color'));
  });
});
