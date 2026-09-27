import { expect, test } from '@playwright/test';
import { openFreshApp } from './helpers';

test('saves the workspace to the database and restores it in a new browser', async ({ page, browser }) => {
  await openFreshApp(page);
  await page.locator('.document-tab__button', { hasText: 'Структурная схема' }).click();
  await page.getByTestId('quick-command-save').click();
  await expect(page.getByRole('status')).toContainText('Снимок рабочей области сохранен в базе данных.');

  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const other = await context.newPage();
  await other.goto('/');
  await expect(other.locator('.document-tab.is-active')).toContainText('Структурная схема');
  await context.close();
});

test('the API health check reports the database', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.ok()).toBeTruthy();
  expect(await response.json()).toEqual({ Status: 'ok', Database: 'ok' });
});
