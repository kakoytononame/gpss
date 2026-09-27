import { expect, type Page } from '@playwright/test';

/** Opens the app with an empty browser workspace and waits until the TEB is loaded from the API. */
export async function openFreshApp(page: Page) {
  // Tests share the database: start every test from the default workspace layout.
  await page.request.delete('/api/alina-gpss/studio/tebs/workspace');
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await expect(page.locator('.window-title')).toHaveText('Класс тэба: Блок-участок 2');
  await expect(page.locator('.status-pill--api')).toBeVisible();
}

export async function openDocumentFromTree(page: Page, label: string) {
  await page.locator('.tree-row', { hasText: label }).click();
}
