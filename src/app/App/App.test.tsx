import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockBackend } from '../../test/fixtures';
import { resetStore, store } from '../../test/store';
import App from './App';

beforeEach(() => resetStore());

describe('App', () => {
  it('loads the TEB, the example model and runs a simulation from the quick access toolbar', async () => {
    mockBackend();
    render(<App />);

    await waitFor(() => expect(screen.getByText('Класс тэба: Блок-участок 2')).toBeInTheDocument());
    await waitFor(() => expect(store().modelText).toContain('GENERATE'));

    await userEvent.click(screen.getByTestId('quick-command-run-sim'));

    await waitFor(() => expect(screen.getByRole('region', { name: 'Общая информация' })).toBeInTheDocument());
    expect(screen.getByText('Стандартный отчёт: Столовая')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Моделирование: завершено. Моделирование завершено.');
  });

  it('switches ribbon tabs and shows the contextual report tab', async () => {
    mockBackend();
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Моделирование' }));
    expect(screen.getByTestId('ribbon-command-cmd-conduct')).toBeInTheDocument();

    await userEvent.click(screen.getAllByText('Стандартный отчёт')[0]);
    expect(screen.getByRole('button', { name: 'Стандартный отчёт', pressed: true })).toBeInTheDocument();
  });
});
