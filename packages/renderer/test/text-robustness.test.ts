// @vitest-environment jsdom
/**
 * Text-type robustness (P5): the engine and the safe render path must accept
 * every text shape GitHub accepts — byte-order marks, Windows line endings,
 * bidirectional text, CJK, ZWJ emoji sequences, combining marks, control
 * characters and very long lines — without crashing, mangling, or producing
 * executable output. The universal assertion: whatever goes in, the visible
 * text comes out intact.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { loadNodeEngine } from '@onemark/engine/node';
import { GFM_OPTIONS, type MarkdownEngine } from '@onemark/engine';
import { renderToSafeHtml } from '../src/index.js';

let engine: MarkdownEngine;

beforeAll(async () => {
  engine = await loadNodeEngine();
});

async function safeRender(source: string): Promise<string> {
  const ast = await engine.parse(source, GFM_OPTIONS);
  return renderToSafeHtml(ast, {});
}

describe('text-type robustness (P5)', () => {
  it('strips a leading byte-order mark instead of rendering it as text', async () => {
    const html = await safeRender('\uFEFF# BOM heading\n');
    expect(html).toContain('BOM heading');
    expect(html).toMatch(/<h1 id="user-content-bom-heading">/);
    expect(html.startsWith('<h1')).toBe(true);
  });

  it('renders CRLF line endings like LF', async () => {
    const html = await safeRender('# CRLF\r\n\r\npara one\r\n\r\npara two\r\n');
    expect(html).toContain('<h1 id="user-content-crlf">');
    expect(html).toContain('para two');
    expect(html).not.toContain('\r');
  });

  it('preserves right-to-left text and lets the dir attribute do the work', async () => {
    const rtl = 'مرحبا بالعالم';
    const html = await safeRender(`# RTL\n\n${rtl}\n`);
    expect(html).toContain(rtl);
  });

  it('preserves CJK text', async () => {
    const cjk = '日本語のテキストと中文文本';
    const html = await safeRender(`# CJK\n\n**${cjk}** — mixed with latin.\n`);
    expect(html).toContain(cjk);
    expect(html).toContain('<strong>');
  });

  it('keeps ZWJ emoji sequences intact (family, skin-tone, flag)', async () => {
    const zwj = '👩‍👩‍👧‍👦 👍🏽 🇯🇵';
    const html = await safeRender(`# Emoji\n\n${zwj}\n`);
    expect(html).toContain(zwj);
  });

  it('keeps combining marks attached to their base characters', async () => {
    const marked = 'e\u0301\u0327 a\u0308 o\u0302'; // ȩ́ ä ô decomposed
    const html = await safeRender(`# Marks\n\n${marked}\n`);
    expect(html).toContain(marked);
  });

  it('neutralises C0 control characters other than tab/newline', async () => {
    const html = await safeRender('# Ctrl\n\nbefore\u0007after\u000Bend\n');
    expect(html).toContain('before');
    expect(html).toContain('after');
    expect(html).toContain('end');
    expect(html).not.toContain('\u0007');
  });

  it('handles a very long single line without truncation', async () => {
    const long = 'word '.repeat(20_000);
    const html = await safeRender(`# Long\n\n${long}\n`);
    expect(html.length).toBeGreaterThan(long.length);
    expect(html).toContain(long.trim().slice(-40));
  });

  it('survives every case combined in one document', async () => {
    const html = await safeRender(
      '\uFEFF# Combined\r\n\r\n' +
        '日本語 **текст** مرحبا 👩‍👩‍👧‍👦 e\u0301\r\n' +
        '\r\n' +
        '| CJK | RTL |\r\n' +
        '| --- | --- |\r\n' +
        '| 中文 | שלום |\r\n',
    );
    expect(html).toContain('日本語');
    expect(html).toContain('שלום');
    expect(html).toContain('👩‍👩‍👧‍👦');
    expect(html).toContain('<table>');
  });
});
