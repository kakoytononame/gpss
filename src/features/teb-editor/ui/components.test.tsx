import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { simulationResult } from '../../../test/fixtures';
import { resetStore, store } from '../../../test/store';
import { IssuesPanel } from '../../../widgets/desktop-shell/IssuesPanel/IssuesPanel';
import { PropertiesView } from '../../../widgets/desktop-shell/RightDockPanel/PropertiesView';
import { SimulationChartsDocument } from './SimulationChartsDocument/SimulationChartsDocument';
import { StandardReportDocument } from './StandardReportDocument/StandardReportDocument';
import { CollectionEditor } from './tabs/CollectionEditor';

beforeEach(() => resetStore());

describe('CollectionEditor', () => {
  function setup() {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const onMove = vi.fn();
    const onRemove = vi.fn();
    render(
      <CollectionEditor
        rows={rows}
        columns={[{ key: 'id', label: 'Id', render: (row) => row.id }]}
        titles={{ add: 'Добавить', remove: 'Удалить', moveUp: 'Выше', moveDown: 'Ниже' }}
        onAdd={vi.fn()}
        onRemove={onRemove}
        onMove={onMove}
      />,
    );
    return { onMove, onRemove };
  }

  it('disables row actions until a row is selected and at the edges', async () => {
    setup();
    expect(screen.getByRole('button', { name: 'Удалить' })).toBeDisabled();

    await userEvent.click(screen.getByText('a'));
    expect(screen.getByRole('button', { name: 'Удалить' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Выше' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ниже' })).toBeEnabled();
  });

  it('keeps the selection on the moved row', async () => {
    const { onMove } = setup();
    await userEvent.click(screen.getByText('a'));
    await userEvent.click(screen.getByRole('button', { name: 'Ниже' }));

    expect(onMove).toHaveBeenCalledWith(0, 'down');
    expect(screen.getAllByRole('row')[2]).toHaveClass('is-selected');
  });
});

describe('PropertiesView', () => {
  it('lets the user type intermediate values below the minimum and clamps on blur', async () => {
    resetStore({ schemeSelection: { type: 'node', id: 'kitchen-choice' } });
    render(<PropertiesView />);

    const width = screen.getByRole('spinbutton', { name: 'Ширина' });
    await userEvent.clear(width);
    await userEvent.type(width, '1');
    expect(width).toHaveValue(1);
    await userEvent.type(width, '20');
    await userEvent.tab();

    expect(store().schemeNodes.find((node) => node.id === 'kitchen-choice')?.width).toBe(120);
  });
});

describe('IssuesPanel', () => {
  it('shows server failures as errors but not local warnings', () => {
    resetStore({ syncStatus: 'warning', syncMessage: 'Внимание' });
    const { rerender } = render(<IssuesPanel />);
    expect(screen.getByRole('button', { name: /Ошибки \(0\)/ })).toBeInTheDocument();

    resetStore({ syncStatus: 'offline', syncMessage: 'Сервер недоступен.' });
    rerender(<IssuesPanel />);
    expect(screen.getByRole('button', { name: /Ошибки \(1\)/ })).toBeInTheDocument();
    expect(screen.getByText('Сервер недоступен.')).toBeInTheDocument();
  });
});

describe('StandardReportDocument', () => {
  it('shows the demo report before the first run and the real one afterwards', async () => {
    const { rerender } = render(<StandardReportDocument />);
    expect(screen.getByText(/демонстрационный/)).toBeInTheDocument();

    resetStore({ simulationReport: simulationResult().Report });
    rerender(<StandardReportDocument />);
    await userEvent.click(screen.getByRole('button', { name: 'Устройства' }));

    const table = screen.getByRole('region', { name: 'Устройства' });
    expect(within(table).getByText('KASSA1')).toBeInTheDocument();
    expect(within(table).getByText('0.278')).toBeInTheDocument();
  });
});

describe('SimulationChartsDocument', () => {
  it('invites to run the model when there are no results', () => {
    render(<SimulationChartsDocument />);
    expect(screen.getByRole('button', { name: 'Запустить моделирование' })).toBeInTheDocument();
  });

  it('lists only chart sections that have data', async () => {
    resetStore({ simulationReport: simulationResult().Report });
    render(<SimulationChartsDocument />);

    expect(screen.getByText('Коэффициент использования устройств')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Многоканальные устройства' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Динамика очередей и памяти' }));
    expect(screen.getByText('BUF1')).toBeInTheDocument();
  });
});
