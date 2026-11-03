import { expect, test } from '@playwright/test';
import { openFreshApp } from './helpers';

test('builds a queueing network, compares simulation with theory and opens its GPSS model', async ({ page }) => {
  await openFreshApp(page);
  await page.locator('.ribbon-tab', { hasText: 'Моделирование' }).click();
  await page.getByTestId('ribbon-command-queueing').click();

  // Theory of the default M/M/1 appears without a run.
  const results = page.getByRole('region', { name: 'Результаты', exact: true });
  await expect(results.getByText('M/M/1: L = ρ/(1−ρ)')).toBeVisible();

  await page.getByLabel('Пример системы').selectOption('jackson');
  await expect(page.getByRole('img', { name: 'Схема системы массового обслуживания' })).toContainText('Доработка');
  await page.getByRole('button', { name: 'Выполнить прогоны модели GPSS и сравнить с теорией' }).click();
  await expect(results).toContainText('независимых прогонов', { timeout: 90_000 });
  await expect(results.getByRole('region', { name: 'Результаты узла Контроль' })).toContainText('✓');

  await page.getByRole('button', { name: 'Сформировать модель GPSS и открыть её в документе «Текст модели»' }).click();
  await expect(page.locator('.global-status')).toContainText('сформирован конструктором СМО');
});
