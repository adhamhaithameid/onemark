/**
 * Direct tests for the URL scheme policy.
 *
 * The XSS corpus exercises this end to end, but a corpus proves "these 49
 * attacks fail", not "this rule is the rule". These pin the rule itself,
 * including the cases where link and image deliberately disagree.
 */

import { describe, expect, it } from 'vitest';

import { isSafeUrl } from '../src/index.js';

describe('schemes that execute are refused everywhere', () => {
  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'vbscript:msgbox(1)',
    'jAvAsCrIpT:alert(1)',
  ])('%s', (url) => {
    expect(isSafeUrl(url, 'link')).toBe(false);
    expect(isSafeUrl(url, 'image')).toBe(false);
  });

  it('sees through characters the browser ignores when resolving a scheme', () => {
    // A browser strips these before deciding the scheme, so a checker that does
    // not is inspecting a string the browser will never act on.
    expect(isSafeUrl('java\tscript:alert(1)', 'link')).toBe(false);
    expect(isSafeUrl('java\nscript:alert(1)', 'link')).toBe(false);
    expect(isSafeUrl('java\rscript:alert(1)', 'link')).toBe(false);
    expect(isSafeUrl('  javascript:alert(1)', 'link')).toBe(false);
    expect(isSafeUrl('java script:alert(1)', 'link')).toBe(false);
  });
});

describe('data: URLs, where link and image deliberately differ', () => {
  it('permits raster images, which cannot execute', () => {
    expect(isSafeUrl('data:image/png;base64,iVBOR', 'image')).toBe(true);
    expect(isSafeUrl('data:image/gif;base64,R0lGOD', 'image')).toBe(true);
    expect(isSafeUrl('data:image/webp;base64,UklGR', 'image')).toBe(true);
  });

  it('refuses data:image/svg+xml even though it is an image type', () => {
    // An SVG is a document: it can carry <script> and event handlers. This is a
    // script delivery mechanism wearing an image's clothes.
    expect(isSafeUrl('data:image/svg+xml;base64,PHN2Zz4=', 'image')).toBe(false);
    expect(isSafeUrl('data:image/svg+xml,<svg onload=alert(1)>', 'image')).toBe(false);
  });

  it('refuses non-image data URLs', () => {
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>', 'image')).toBe(false);
    expect(isSafeUrl('data:application/javascript,alert(1)', 'image')).toBe(false);
  });

  it('refuses every data URL in a link, including images', () => {
    // A link navigates. Navigating to a data: URL hands the origin to content
    // the document supplied, which is a different risk from displaying pixels.
    expect(isSafeUrl('data:image/png;base64,iVBOR', 'link')).toBe(false);
    expect(isSafeUrl('data:text/html,<b>x</b>', 'link')).toBe(false);
  });
});

describe('schemes a document legitimately uses', () => {
  it('permits http and https in both contexts', () => {
    for (const context of ['link', 'image'] as const) {
      expect(isSafeUrl('https://example.com/a', context)).toBe(true);
      expect(isSafeUrl('http://example.com/a', context)).toBe(true);
    }
  });

  it('permits mailto in a link but not as an image source', () => {
    expect(isSafeUrl('mailto:someone@example.com', 'link')).toBe(true);
    expect(isSafeUrl('mailto:someone@example.com', 'image')).toBe(false);
  });

  it('permits relative destinations and fragments', () => {
    for (const url of ['./a.md', '../b/c.png', '/absolute/path', '#section', 'plain.html']) {
      expect(isSafeUrl(url, 'link')).toBe(true);
    }
  });

  it('permits protocol-relative URLs, which navigate but cannot execute', () => {
    // Where a document points is the document's business; this is the same
    // behaviour any viewer has. It is not a script-execution vector.
    expect(isSafeUrl('//example.com/x', 'link')).toBe(true);
  });

  it('refuses schemes outside the allowlist', () => {
    for (const url of ['file:///etc/passwd', 'blob:https://x/y', 'ftp://example.com/a']) {
      expect(isSafeUrl(url, 'link')).toBe(false);
    }
  });
});
