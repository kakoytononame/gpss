import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SimulationResultDetail } from '../../../../shared/types/result';
import { simulationResult } from '../../../../test/fixtures';
import { resetStore, store } from '../../../../test/store';
import { ResultsDocument } from './ResultsDocument';

const SINGLE: SimulationResultDetail = {
  Id: 'r1',
  ProjectId: 'project-1',
  Kind: 'single',
  Name: 'Эксперимент «Порт»',
  CreatedAt: '2026-10-13T10:00:00Z',
  Payload: {
    ModelName: 'Порт',
    ModelText: 'GENERATE 10\nTERMINATE 1',
    FormName: 'Порт',
    Inputs: [{ Input: '(2) INITIAL', Name: 'Интервал', Operand: 'B', Value: '30' }],
    StartCount: 50,
    Report: simulationResult().Report!,
  },
};

beforeEach(() => resetStore());

describe('ResultsDocument', () => {
  it('lists results by kind and shows the tabs of the selected single experiment', async () => {
    const openResult = vi.fn();
    resetStore({
      simulationResults: [{ Id: 'r1', ProjectId: 'project-1', Kind: 'single', Name: SINGLE.Name, CreatedAt: SINGLE.CreatedAt }],
      selectedResult: SINGLE,
      openResult,
    });
    render(<ResultsDocument />);

    expect(within(screen.getByRole('region', { name: 'Одиночные эксперименты' })).getByText(SINGLE.Name)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Серии экспериментов' })).toHaveTextContent('(0)');
    expect(screen.getByRole('tabpanel', { name: 'Общая информация' })).toHaveTextContent('50');

    await userEvent.click(screen.getByRole('tab', { name: 'Исходные данные' }));
    expect(screen.getByRole('tabpanel', { name: 'Исходные данные' })).toHaveTextContent('Интервал');

    await userEvent.click(screen.getByRole('tab', { name: 'Стандартный отчёт' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Устройства' }));
    expect(screen.getByRole('table', { name: 'Устройства' })).toHaveTextContent('KASSA1');

    await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${SINGLE.Name}`) }));
    expect(openResult).toHaveBeenCalledWith('r1');
  });

  it('renames a result inline', async () => {
    const renameResult = vi.fn();
    resetStore({
      simulationResults: [{ Id: 'r1', ProjectId: null, Kind: 'single', Name: 'Старое имя', CreatedAt: SINGLE.CreatedAt }],
      renameResult,
    });
    render(<ResultsDocument />);

    await userEvent.click(screen.getByRole('button', { name: 'Переименовать «Старое имя»' }));
    const input = screen.getByRole('textbox', { name: 'Имя результата' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Новое имя{Enter}');

    expect(renameResult).toHaveBeenCalledWith('r1', 'Новое имя');
    expect(store().selectedResult).toBeNull();
  });
});
