import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { studioProject } from '../../../../test/fixtures';
import { resetStore, store } from '../../../../test/store';
import { FinalReportDocument } from './FinalReportDocument';

beforeEach(() => resetStore());

describe('FinalReportDocument', () => {
  it('asks to open a project', () => {
    render(<FinalReportDocument />);
    expect(screen.getByText(/Итоговый отчёт хранится в проекте/)).toBeInTheDocument();
  });

  it('shows the fragments and lets the user order, edit and remove them', async () => {
    resetStore({
      project: {
        ...studioProject(),
        Report: {
          Title: '',
          Fragments: [
            { Id: 'a', Kind: 'table', Title: 'Устройства', Columns: ['Имя'], Rows: [['KASSA']], Source: 'Эксперимент 1 — Стандартный отчёт' },
            { Id: 'b', Kind: 'text', Title: '', Text: '' },
          ],
        },
      },
    });
    render(<FinalReportDocument />);

    expect(screen.getByRole('textbox', { name: 'Заголовок отчёта' })).toHaveAttribute('placeholder', 'Отчёт по проекту «Мастерская»');
    const first = screen.getByRole('listitem', { name: 'Фрагмент 1' });
    expect(within(first).getByText('KASSA')).toBeInTheDocument();
    expect(within(first).getByText('Эксперимент 1 — Стандартный отчёт')).toBeInTheDocument();
    expect(within(first).getByRole('button', { name: 'Выше' })).toBeDisabled();

    await userEvent.type(screen.getByRole('textbox', { name: 'Текст фрагмента' }), 'Вывод');
    expect(store().project?.Report?.Fragments[1].Text).toBe('Вывод');

    await userEvent.click(within(screen.getByRole('listitem', { name: 'Фрагмент 2' })).getByRole('button', { name: 'Выше' }));
    expect(store().project?.Report?.Fragments.map((fragment) => fragment.Id)).toEqual(['b', 'a']);

    await userEvent.click(within(screen.getByRole('listitem', { name: 'Фрагмент 2' })).getByRole('button', { name: 'Удалить из отчёта' }));
    expect(store().project?.Report?.Fragments.map((fragment) => fragment.Id)).toEqual(['b']);
    expect(screen.getByRole('button', { name: /Сохранить проект/ })).toBeEnabled();
  });
});
