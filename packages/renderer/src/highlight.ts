/**
 * Task 1.5 — bundled syntax highlighting via shiki.
 *
 * The renderer proper never imports shiki: it stays synchronous, dependency-
 * light and byte-exact for the conformance suites. This module is the adapter
 * the application initialises once at startup and hands to `renderToSafeHtml`
 * through `RenderOptions.highlighter`.
 *
 * Grammars and themes are bundled statically — that is what makes M2's
 * zero-network guarantee hold. The language set here is the v1 bundle; widening
 * it is a deliberate size-budget decision (M6), not a drive-by.
 */

import { createHighlighter } from 'shiki';

import { escapeHtml } from './escape.js';

export interface SyntaxHighlighter {
  /**
   * Token spans for `code` in `lang`, or `null` when the language is not in
   * the bundle. The returned markup is escaped HTML whose spans carry
   * `tk-*` classes — no inline styles, so the sanitiser's allowlist stays
   * closed and styling flows through a stylesheet, the way GitHub's own
   * `pl-*` classes work.
   */
  highlight(code: string, lang: string, theme: 'light' | 'dark'): string | null;

  /**
   * The `.tk-*` class rules this adapter emits spans for, for the given
   * theme. The application ships this next to the vendored theme CSS.
   */
  css(theme: 'light' | 'dark'): string;
}

/** Languages shipped inside the bundle. Sorted, deduplicated aliases included. */
export const BUNDLED_LANGS = [
  'bash',
  'c',
  'css',
  'go',
  'html',
  'javascript',
  'json',
  'markdown',
  'python',
  'rust',
  'typescript',
] as const;

/** shiki language ids plus the aliases GitHub fence info strings actually use. */
const LANG_ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  py: 'python',
  rs: 'rust',
  golang: 'go',
  yml: 'json', // closest bundled grammar; YAML is a deliberate v1 omission
};

export async function createSyntaxHighlighter(): Promise<SyntaxHighlighter> {
  const highlighter = await createHighlighter({
    themes: ['github-light', 'github-dark'],
    langs: [...BUNDLED_LANGS],
  });

  const loaded = new Set(highlighter.getLoadedLanguages());

  /** theme → colour → stable class name. Classes are content-addressed by colour. */
  const classes = new Map<'light' | 'dark', Map<string, string>>();
  const classFor = (theme: 'light' | 'dark', color: string): string => {
    let byColor = classes.get(theme);
    if (!byColor) {
      byColor = new Map();
      classes.set(theme, byColor);
    }
    let cls = byColor.get(color);
    if (!cls) {
      cls = `tk-${theme}-${byColor.size.toString(36)}`;
      byColor.set(color, cls);
    }
    return cls;
  };

  // Pre-register every colour each theme defines, so `css()` is complete before
  // the first render and never depends on which languages have been highlighted.
  for (const [themeName, key] of [
    ['github-light', 'light'],
    ['github-dark', 'dark'],
  ] as const) {
    const theme = highlighter.getTheme(themeName);
    for (const setting of theme.settings ?? []) {
      if (setting.settings?.foreground) classFor(key, setting.settings.foreground);
    }
  }

  return {
    highlight(code, lang, theme) {
      const id = LANG_ALIASES[lang] ?? lang;
      if (!loaded.has(id)) return null;
      const { tokens } = highlighter.codeToTokens(code, {
        // `loaded.has` above is the runtime guard; shiki's type is a union of ids.
        lang: id as (typeof BUNDLED_LANGS)[number],
        theme: theme === 'dark' ? 'github-dark' : 'github-light',
      });
      return tokens
        .map((line) =>
          line
            .map((token) => {
              if (!token.content) return '';
              const color = token.color ?? 'inherit';
              return `<span class="${classFor(theme, color)}">${escapeHtml(token.content)}</span>`;
            })
            .join(''),
        )
        .join('\n');
    },

    css(theme) {
      const byColor = classes.get(theme);
      if (!byColor) return '';
      const rules: string[] = [];
      for (const [color, cls] of byColor) {
        rules.push(`.${cls} { color: ${color}; }`);
      }
      return rules.join('\n');
    },
  };
}
