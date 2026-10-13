import { expect, test } from '@playwright/test';
import { openFreshApp } from './helpers';

test('runs a series of experiments with the model', async ({ page }) => {
  await openFreshApp(page);
  await page.locator('.ribbon-tab', { hasText: 'Моделирование' }).click();
  await page.getByTestId('ribbon-command-experiments').click();

  await page.getByRole('button', { name: 'Найти факторы и показатели в тексте модели' }).click();
  await expect(page.getByRole('textbox', { name: 'Выражение показателя' }).first()).not.toHaveValue('');

  await page.getByRole('spinbutton').first().fill('2');
  await page.getByRole('button', { name: 'Выполнить все прогоны плана' }).click();

  const results = page.getByRole('region', { name: 'Результаты серии' });
  await expect(results).toBeVisible({ timeout: 90_000 });
  await expect(results.locator('tbody tr').first()).toContainText('±');
  await expect(page.locator('.global-status')).toContainText('Серия выполнена');
});
