import { expect, test } from '@playwright/test';
import { openDocumentFromTree, openFreshApp } from './helpers';

test.describe('GPSS simulation', () => {
  test('runs the canteen model and shows the report, charts and journal', async ({ page }) => {
    await openFreshApp(page);
    await page.locator('.document-tab__button', { hasText: 'Текст модели' }).click();
    await expect(page.getByRole('textbox', { name: 'Текст GPSS модели' })).toHaveValue(/KASSA1/);

    await page.getByTestId('quick-command-run-sim').click();

    await expect(page.locator('.standard-report-nav__title')).toHaveText('Стандартный отчёт: Столовая');
    await expect(page.getByRole('status')).toContainText('Моделирование: завершено.');
    await page.getByRole('button', { name: 'Устройства', exact: true }).click();
    const facilities = page.getByRole('region', { name: 'Устройства' });
    await expect(facilities.getByRole('cell', { name: 'KASSA1', exact: true })).toBeVisible();
    await expect(facilities.locator('tbody tr')).toHaveCount(10);

    await openDocumentFromTree(page, 'Графики результатов');
    await expect(page.getByText('Коэффициент использования устройств')).toBeVisible();
    await expect(page.locator('.recharts-bar-rectangle')).toHaveCount(10);

    await openDocumentFromTree(page, 'Журнал моделирования');
    await expect(page.getByRole('textbox', { name: 'Редактор журнала моделирования' })).toHaveValue(/Моделирование завершено\. Время 1440\.000000/);
    await page.getByLabel('Команда GPSS:').fill('SHOW AC1');
    await page.getByLabel('Команда GPSS:').press('Enter');
    await expect(page.getByRole('textbox', { name: 'Редактор журнала моделирования' })).toHaveValue(/AC1 = 1440/);
  });

  test('steps through the model with the ribbon', async ({ page }) => {
    await openFreshApp(page);
    await page.locator('.ribbon-tab', { hasText: 'Моделирование' }).click();
    await page.getByTestId('ribbon-command-cmd-conduct').click();
    await page.getByTestId('ribbon-command-cmd-step').click();

    // STEP opens the debugger's model state; the trace goes to the journal.
    await expect(page.getByRole('table', { name: 'Транзакты модели' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('приостановлено');
    await page.locator('.tree-row', { hasText: 'Журнал моделирования' }).click();
    await expect(page.getByRole('textbox', { name: 'Редактор журнала моделирования' })).toHaveValue(/Транзакт \d+ вошёл в блок/);
  });

  test('reports translation errors with line numbers', async ({ page }) => {
    await openFreshApp(page);
    await page.locator('.document-tab__button', { hasText: 'Текст модели' }).click();
    await page.getByRole('textbox', { name: 'Текст GPSS модели' }).fill('  GENERATE 10\n  TRANSFER ,NOWHERE\n  TERMINATE 1');
    await page.getByRole('button', { name: 'Оттранслировать модель и показать ошибки' }).click();

    await expect(page.getByRole('button', { name: /Ошибки \(1\)/ })).toBeVisible();
    await expect(page.getByText('Строка 2: TRANSFER: Метка "NOWHERE" не определена.')).toBeVisible();
  });
});
