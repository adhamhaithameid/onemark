/**
 * E2E smoke for the deployed-shaped app: a real Chromium against the built
 * bundle (vite preview). Covers the P6 core flows: load, type→live preview,
 * theme toggle (data-theme + re-rendered tokens), paste import, save→reopen
 * through OPFS. Part of `pnpm --filter @onemark/web test:e2e`.
 */
import { expect, test } from '@playwright/test';

test.describe('OneMark app flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.onemark-editor-pane .cm-content');
  });

  test('boots the split view with both panes', async ({ page }) => {
    await expect(page.locator('.onemark-editor-pane .cm-editor')).toBeVisible();
    await expect(page.locator('.onemark-preview-pane.markdown-body')).toBeVisible();
  });

  test('typing markdown updates the live preview', async ({ page }) => {
    await page.click('.onemark-editor-pane .cm-content');
    await page.keyboard.type('# E2E Hello\n\nSome **bold** text.');
    const preview = page.locator('.onemark-preview-pane');
    await expect(preview.locator('h1#user-content-e2e-hello')).toHaveText(/E2E Hello/, { timeout: 5_000 });
    await expect(preview.locator('strong')).toHaveText('bold');
  });

  test('theme toggle stamps data-theme and re-renders token colours', async ({ page }) => {
    await page.click('.onemark-editor-pane .cm-content');
    await page.keyboard.type('```rust\nfn main() {}\n```');
    const preview = page.locator('.onemark-preview-pane');
    await expect(preview.locator('pre code')).toBeVisible({ timeout: 5_000 });

    await page.click('#theme-button'); // system → light
    await page.click('#theme-button'); // light → dark
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(preview.locator('[class*="tk-dark-"]').first()).toBeVisible({ timeout: 5_000 });

    await page.click('#theme-button'); // dark → system
    await expect(page.locator('html')).toHaveAttribute('data-theme', /^(light|dark)$/);
  });

  test('pasting markdown imports it as a document', async ({ page }) => {
    // Real paste events target the focused element (an Element, per the app's
    // handler guard) — dispatch on body, not document.
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData('text/plain', '# Pasted Doc\n\npasted body');
      document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    const preview = page.locator('.onemark-preview-pane');
    await expect(preview.locator('h1#user-content-pasted-doc')).toHaveText(/Pasted Doc/, { timeout: 5_000 });
  });

  test('save writes the opened document to OPFS and the bytes round-trip', async ({ page }) => {
    // Import a document first — save() persists the *current* document, which
    // only exists once one is opened (paste/drop open; typing alone doesn't).
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData('text/plain', '# OPFS Round Trip\n\npasted base');
      document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await expect(page.locator('.onemark-preview-pane h1')).toContainText('OPFS Round Trip', { timeout: 5_000 });

    // Edit, then save.
    await page.click('.onemark-editor-pane .cm-content');
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type('\nsaved by e2e');
    await expect(page.locator('.onemark-preview-pane')).toContainText('saved by e2e', { timeout: 5_000 });
    await page.click('#save-button');
    await page.waitForTimeout(300);

    const content = await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      // @ts-expect-error async iterator exists in Chromium
      for await (const [name, handle] of root.entries()) {
        if (name.endsWith('.md')) {
          const file = await (handle as FileSystemFileHandle).getFile();
          return file.text();
        }
      }
      return '';
    });
    expect(content).toContain('# OPFS Round Trip');
    expect(content).toContain('saved by e2e');
  });
});
