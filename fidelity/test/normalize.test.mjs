import { describe, expect, it } from 'vitest';
import { normalize, structuralDiff } from '../src/normalize.mjs';

/**
 * OQ-2 resolution (PRD §12): each rule is named after the GitHub artifact it
 * neutralises. Anything NOT covered by R1–R6 counts as a real difference.
 */

describe('R1 — strip heading anchors', () => {
  it('removes GitHub\'s user-content anchor elements inside headings', () => {
    const github = '<h2><a id="user-content-install" class="anchor" href="#install"></a>Install</h2>';
    const ours = '<h2 id="user-content-install">Install</h2>';
    expect(structuralDiff(normalize(github), normalize(ours))).toBe(true);
  });
});

describe('R2 — strip dir attributes', () => {
  it('drops dir="auto" from both sides', () => {
    const a = normalize('<p dir="auto">text</p>');
    const b = normalize('<p>text</p>');
    expect(structuralDiff(a, b)).toBe(true);
  });
});

describe('R3 — camo images', () => {
  it('treats any camo-proxied image as equivalent to a plain remote image', () => {
    const github = '<p><img src="https://camo.githubusercontent.com/abc123" alt="logo"></p>';
    const ours = '<p><img src="https://example.com/logo.png" alt="logo"></p>';
    expect(structuralDiff(normalize(github), normalize(ours))).toBe(true);
  });

  it('does not equate camo with a missing image', () => {
    const github = normalize('<p><img src="https://camo.githubusercontent.com/abc" alt="x"></p>');
    const ours = normalize('<p>alt text only</p>');
    expect(structuralDiff(github, ours)).toBe(false);
  });
});

describe('R4 — inter-block whitespace and comments', () => {
  it('ignores whitespace between block elements and comments', () => {
    const a = normalize('<h1>T</h1>\n\n<!-- comment -->\n<p>P</p>');
    const b = normalize('<h1>T</h1><p>P</p>');
    expect(structuralDiff(a, b)).toBe(true);
  });

  it('keeps whitespace inside text significant', () => {
    const a = normalize('<p>two  spaces</p>');
    const b = normalize('<p>two spaces</p>');
    expect(structuralDiff(a, b)).toBe(false);
  });
});

describe('R5 — attribute order and boolean attribute forms', () => {
  it('is insensitive to attribute order', () => {
    expect(structuralDiff(normalize('<img alt="a" src="b">'), normalize('<img src="b" alt="a">'))).toBe(true);
  });

  it('treats empty and bare boolean attributes as equal', () => {
    expect(structuralDiff(normalize('<input disabled="">'), normalize('<input disabled>'))).toBe(true);
  });
});

describe('R6 — g-emoji unwrap', () => {
  it('unwraps g-emoji to its content', () => {
    const github = '<p><g-emoji class="g-emoji" alias="+1">👍</g-emoji></p>';
    const ours = '<p>👍</p>';
    expect(structuralDiff(normalize(github), normalize(ours))).toBe(true);
  });
});

describe('real differences are never normalized away', () => {
  it('different text fails', () => {
    expect(structuralDiff(normalize('<p>a</p>'), normalize('<p>b</p>'))).toBe(false);
  });

  it('different structure fails', () => {
    expect(structuralDiff(normalize('<ul><li>a</li></ul>'), normalize('<ol><li>a</li></ol>'))).toBe(false);
  });

  it('different attributes fail', () => {
    expect(structuralDiff(normalize('<table><td align="right">x</td></table>'), normalize('<table><td>x</td></table>'))).toBe(false);
  });
});
