import { expect, test } from '@playwright/test';
import { openFreshApp } from './helpers';

test.describe('TEB editor', () => {
  test('loads the class from the API and persists edits in PostgreSQL', async ({ page }) => {
    await openFreshApp(page);
    const header = page.getByRole('textbox').nth(1);
    const original = await header.inputValue();
    const edited = `Блок-участок e2e ${Date.now()}`;

    await header.fill(edited);
    await header.blur();
    await expect(page.locator('.status-bar')).toHaveText('Свойство отправлено на сервер.');

    await page.reload();
    await expect(page.locator('.window-title')).toHaveText(`Класс тэба: ${edited}`);

    const reloadedHeader = page.getByRole('textbox').nth(1);
    await reloadedHeader.fill(original);
    await reloadedHeader.blur();
    await expect(page.locator('.status-bar')).toHaveText('Свойство отправлено на сервер.');
  });

  test('adds, edits and removes a state row', async ({ page }) => {
    await openFreshApp(page);
    await page.getByRole('tab', { name: 'Состояния', exact: true }).click();
    const rows = page.locator('.editor-table tbody tr');
    const before = await rows.count();

    await page.getByRole('button', { name: 'Добавить состояние' }).click();
    await expect(rows).toHaveCount(before + 1);
    const name = rows.last().getByRole('textbox', { name: 'Имя' });
    await name.fill('E2E');
    await name.blur();
    await expect(page.locator('.status-bar')).toHaveText('Изменение строки отправлено на сервер.');

    await page.reload();
    await page.getByRole('tab', { name: 'Состояния', exact: true }).click();
    await expect(rows.last().getByRole('textbox', { name: 'Имя' })).toHaveValue('E2E');

    await rows.last().click();
    await page.getByRole('button', { name: 'Удалить состояние' }).click();
    await expect(page.locator('.status-bar')).toHaveText('Коллекция обновлена на сервере.');
    await expect(rows).toHaveCount(before);
  });

  test('instance mode loads parameter values of the demo instance', async ({ page }) => {
    await openFreshApp(page);
    await page.getByRole('button', { name: 'Экземпляр', exact: true }).click();
    await expect(page.locator('.window-title')).toHaveText('Экземпляр тэба: Блок-участок 2');
    await page.getByRole('tab', { name: 'Параметры', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Текущее значение' }).first()).not.toHaveValue('');
  });
});
