/**
 * Theme control (task 1.18): follow system preference, with manual override.
 *
 * Both vendored stylesheets are always loaded; the active one is picked by a
 * `data-theme` attribute the CSS keys on (`.markdown-body` rules are theme-
 * specific files, so the <link> swap does the real work). Keeping both in the
 * DOM makes the toggle instant — no fetch, no flash (NFR-1).
 */

export type ThemeChoice = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): ResolvedTheme {
  if (choice === 'system') return prefersDark ? 'dark' : 'light';
  return choice;
}

interface ThemeDom {
  documentElement: { dataset: DOMStringMap };
  getElementById(id: string): HTMLElement | null;
}

export function applyTheme(dom: ThemeDom, choice: ThemeChoice, prefersDark: boolean): ResolvedTheme {
  const resolved = resolveTheme(choice, prefersDark);
  dom.documentElement.dataset['theme'] = resolved;
  const active = dom.getElementById('theme-active');
  if (active instanceof HTMLLinkElement) {
    active.href = resolved === 'dark' ? './themes/github-dark.css' : './themes/github-light.css';
  }
  return resolved;
}
/** Subscribes to system changes; returns an unsubscribe (no-op pre-browser). */
export function onSystemThemeChange(
  cb: (prefersDark: boolean) => void,
): () => void {
  if (typeof matchMedia !== 'function') return () => {};
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const listener = (e: MediaQueryListEvent): void => cb(e.matches);
  mq.addEventListener('change', listener);
  return () => mq.removeEventListener('change', listener);
}
