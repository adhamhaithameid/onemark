/**
 * Task 1.8 — GitHub emoji shortcodes, bundled (gemoji map, see
 * scripts/vendor-emoji.mjs). Replacement happens on text nodes only — never
 * inside code — and unknown shortcodes pass through verbatim, exactly like
 * GitHub's renderer.
 */

import { EMOJI } from './assets/emoji.js';

const SHORTCODE = /:([a-z0-9_+-]+):/g;

export function replaceEmoji(text: string): string {
  return text.replace(SHORTCODE, (whole, name: string) => EMOJI[name] ?? whole);
}
