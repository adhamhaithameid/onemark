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

describe('R7 — link rel="nofollow" (POST /markdown crawler chrome)', () => {
  it('ignores rel attributes on links from either side', () => {
    const github = '<a href="https://example.com" rel="nofollow">x</a>';
    const ours = '<a href="https://example.com">x</a>';
    expect(structuralDiff(normalize(github), normalize(ours))).toBe(true);
  });

  it('ignores combined rel values (noreferrer)', () => {
    const github = '<a href="https://example.com" rel="nofollow noopener noreferrer">x</a>';
    const ours = '<a href="https://example.com">x</a>';
    expect(structuralDiff(normalize(github), normalize(ours))).toBe(true);
  });
});

describe('R8 — camo data-canonical-src', () => {
  it('ignores data-canonical-src on images from either side', () => {
    const github =
      '<img src="https://camo.githubusercontent.com/abc" alt="badge" data-canonical-src="https://img.shields.io/badge">';
    const ours = '<img src="https://img.shields.io/badge" alt="badge">';
    expect(structuralDiff(normalize(github), normalize(ours))).toBe(true);
  });
});

describe('R10 — highlighted code collapses to text', () => {
  it('GitHub linguist tokenisation equals plain <pre><code> with the same text', () => {
    const github =
      '<div class="highlight highlight-source-js"><pre class="notranslate"><span class="pl-k">const</span> <span class="pl-s1">x</span> <span class="pl-c1">=</span> <span class="pl-c1">1</span>;</pre></div>';
    const ours = '<pre><code class="language-js">const x = 1;</code></pre>';
    expect(structuralDiff(normalize(github), normalize(ours))).toBe(true);
  });

  it('different code text still fails', () => {
    const github =
      '<div class="highlight highlight-source-js"><pre class="notranslate"><span class="pl-k">const</span> a;</pre></div>';
    const ours = '<pre><code class="language-js">const b;</code></pre>';
    expect(structuralDiff(normalize(github), normalize(ours))).toBe(false);
  });
});

describe('R11 — trailing newline inside pre', () => {
  it('cmark final newline equals GitHub pipeline no-newline', () => {
    expect(structuralDiff(normalize('<pre><code>x = 1;\n</code></pre>'), normalize('<pre class="notranslate">x = 1;</pre>'))).toBe(true);
  });

  it('an interior newline still matters', () => {
    expect(structuralDiff(normalize('<pre><code>a\nb\n</code></pre>'), normalize('<pre>a\nb2</pre>'))).toBe(false);
  });
});

describe('R12 — inline code notranslate marker', () => {
  it('ignores class="notranslate" on code from either side', () => {
    expect(structuralDiff(normalize('<p><code class="notranslate">x</code></p>'), normalize('<p><code>x</code></p>'))).toBe(true);
  });
});

describe('R13 — markdown-accessiblity-table unwrap', () => {
  it('GitHub accessibility table wrapper compares as the table', () => {
    const github = '<markdown-accessiblity-table><table><tr><td>x</td></tr></table></markdown-accessiblity-table>';
    expect(structuralDiff(normalize(github), normalize('<table><tr><td>x</td></tr></table>'))).toBe(true);
  });
});

describe('R14 — lone-image presentation wrappers', () => {
  it('an anchor whose content is one img compares as the img', () => {
    expect(structuralDiff(normalize('<a target="_blank" href="i.png"><img alt="a" src="i.png"></a>'), normalize('<img alt="a" src="i.png">'))).toBe(true);
  });

  it('picture/themed-picture wrappers with source variants compare as the img', () => {
    const github = '<themed-picture><source media="(prefers-color-scheme: dark)" srcset="d.png"><img alt="a" src="l.png"></themed-picture>';
    expect(structuralDiff(normalize(github), normalize('<img alt="a" src="l.png">'))).toBe(true);
  });

  it('an anchor with real text content still compares structurally', () => {
    expect(structuralDiff(normalize('<a href="x"><img src="i.png">text</a>'), normalize('<img src="i.png">'))).toBe(false);
  });
});

describe('R15 — ARIA role attributes', () => {
  it('ignores role on tables from either side', () => {
    expect(structuralDiff(normalize('<table role="table"><tr><td>x</td></tr></table>'), normalize('<table><tr><td>x</td></tr></table>'))).toBe(true);
  });
});

describe('R16 — Octicon chrome SVGs', () => {
  it('an octicon svg inside an alert title is chrome', () => {
    const github =
      '<div class="markdown-alert markdown-alert-note"><p class="markdown-alert-title"><svg class="octicon octicon-info mr-2" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M0 8a8"></path></svg>Note</p></div>';
    const ours =
      '<div class="markdown-alert markdown-alert-note"><p class="markdown-alert-title">Note</p></div>';
    expect(structuralDiff(normalize(github), normalize(ours))).toBe(true);
  });
});

describe('R17 — hovercard data attributes', () => {
  it('data-hovercard-* on links is chrome', () => {
    const github = '<a href="/user" data-hovercard-type="user" data-hovercard-url="/users/user/hovercard">u</a>';
    expect(structuralDiff(normalize(github), normalize('<a href="/user">u</a>'))).toBe(true);
  });
});

describe('R18 — raw ids on non-heading elements', () => {
  it('GitHub sanitiser drops them; both sides compare without', () => {
    expect(structuralDiff(normalize('<p><a id="development">x</a></p>'), normalize('<p><a>x</a></p>'))).toBe(true);
  });

  it('heading ids still matter (modulo the user-content prefix)', () => {
    expect(structuralDiff(normalize('<h2 id="dev">x</h2>'), normalize('<h2>x</h2>'))).toBe(false);
  });
});

describe('R14 recursion — nested image wrappers', () => {
  it('an anchor around a themed-picture around an img compares as the img', () => {
    const github =
      '<a href="i.png"><themed-picture><source srcset="d.png" media="(prefers-color-scheme: dark)"><img alt="a" src="l.png"></themed-picture></a>';
    expect(structuralDiff(normalize(github), normalize('<img alt="a" src="l.png">'))).toBe(true);
  });
});

describe('R19 — block-level lone images compare as paragraphs', () => {
  it('a bare block img equals a paragraph-wrapped one', () => {
    expect(structuralDiff(normalize('<img src="i.png" alt="a">'), normalize('<p><img src="i.png" alt="a"></p>'))).toBe(true);
  });
});

describe('R20 — task-list class vocabulary', () => {
  it('API and web task-list class spellings compare equal', () => {
    expect(structuralDiff(normalize('<ul class="task-list"><li class="task-list-item">x</li></ul>'), normalize('<ul class="contains-task-list"><li class="contains-task-list-item">x</li></ul>'))).toBe(true);
  });
});

describe('R21 — empty raw anchors', () => {
  it('an anchor with no content compares as absent', () => {
    expect(structuralDiff(normalize('<p><a id="x"></a>text</p>'), normalize('<p>text</p>'))).toBe(true);
  });
});

describe('R22 — sanitised class on raw-HTML elements', () => {
  it('class on a/img/dt/span/table is stripped on both sides', () => {
    expect(structuralDiff(normalize('<a class="foo" href="x">y</a>'), normalize('<a href="x">y</a>'))).toBe(true);
    expect(structuralDiff(normalize('<table class="batch">x</table>'), normalize('<table>x</table>'))).toBe(true);
  });
});

describe('R23 — insecure protocol upgrade', () => {
  it('http and https hrefs compare equal', () => {
    expect(structuralDiff(normalize('<a href="http://github.com/x">y</a>'), normalize('<a href="https://github.com/x">y</a>'))).toBe(true);
  });
});

describe('R24 — raw div class (alert vocabulary exempt)', () => {
  it('raw div classes are stripped on both sides', () => {
    expect(structuralDiff(normalize('<div class="composition-api">x</div>'), normalize('<div>x</div>'))).toBe(true);
  });

  it('markdown-alert classes still matter', () => {
    expect(structuralDiff(normalize('<div class="markdown-alert markdown-alert-note">x</div>'), normalize('<div class="markdown-alert markdown-alert-tip">x</div>'))).toBe(false);
  });
});

describe('R25 — legacy table attributes', () => {
  it('cellspacing/border/align on tables are stripped', () => {
    expect(structuralDiff(normalize('<table cellspacing="0" border="0"><tr><td>x</td></tr></table>'), normalize('<table><tr><td>x</td></tr></table>'))).toBe(true);
  });
});

describe('R26 — colgroup', () => {
  it('a colgroup-less table compares equal', () => {
    expect(structuralDiff(normalize('<table><colgroup><col></colgroup><tbody><tr><td>x</td></tr></tbody></table>'), normalize('<table><tbody><tr><td>x</td></tr></tbody></table>'))).toBe(true);
  });
});

describe('R27 — abbr unwrap', () => {
  it('raw abbr elements compare transparently', () => {
    expect(structuralDiff(normalize('<li><abbr title="x">HTML</abbr> spec</li>'), normalize('<li>HTML spec</li>'))).toBe(true);
  });
});

describe('R17 companion — data-error-* chrome', () => {
  it('data-error-text/url on links are chrome', () => {
    expect(structuralDiff(normalize('<a href="x" data-error-text="e" data-error-url="u">y</a>'), normalize('<a href="x">y</a>'))).toBe(true);
  });
});

describe('R21 companion — whitespace-only anchors', () => {
  it('an anchor holding only whitespace compares as absent', () => {
    expect(structuralDiff(normalize('<h1><a id="dev">\n</a>Development</h1>'), normalize('<h1>Development</h1>'))).toBe(true);
  });
});
