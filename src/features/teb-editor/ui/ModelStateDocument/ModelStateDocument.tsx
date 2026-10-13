import { useMemo, useState } from 'react';
import { IconButton } from '../../../../shared/ui/IconButton/IconButton';
import { useTebEditorStore } from '../../store/useTebEditorStore';
import '../BaseDocument/BaseDocument.css';
import './ModelStateDocument.css';

function formatTime(value: number | null): string {
  return value === null ? '' : value.toFixed(3);
}

/**
 * Debugger "Состояние модели": clock, stop reason, breakpoints and where every transaction is
 * (current / future events chains, delay chains, user chains) with its parameters.
 */
export function ModelStateDocument() {
  const modelState = useTebEditorStore((state) => state.modelState);
  const breakpointLines = useTebEditorStore((state) => state.breakpointLines);
  const simulationBusy = useTebEditorStore((state) => state.simulationBusy);
  const executeSimulationCommand = useTebEditorStore((state) => state.executeSimulationCommand);
  const clearBreakpoints = useTebEditorStore((state) => state.clearBreakpoints);
  const activateDocument = useTebEditorStore((state) => state.activateDocument);
  const [filter, setFilter] = useState('');

  const transactions = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const all = modelState?.transactions ?? [];
    return query ? all.filter((item) => String(item.Number) === query || item.Chain.toLowerCase().includes(query)) : all;
  }, [modelState, filter]);

  const chains = useMemo(() => {
    const counts = new Map<string, number>();
    for (const transaction of modelState?.transactions ?? []) {
      const chain = transaction.Chain.split(' ')[0];
      counts.set(chain, (counts.get(chain) ?? 0) + 1);
    }

    return [...counts.entries()];
  }, [modelState]);

  return (
    <section className="placeholder-document model-state-document">
      <div className="placeholder-document__header">
        <h2>Состояние модели</h2>
        <div className="placeholder-document__actions">
          <IconButton
            label="STEP"
            title="Выполнить один вход транзакта в блок"
            disabled={simulationBusy}
            onClick={() => void executeSimulationCommand('STEP 1')}
          />
          <IconButton
            label="CONTINUE"
            title="Продолжить до следующей точки останова"
            disabled={simulationBusy}
            onClick={() => void executeSimulationCommand('CONTINUE')}
          />
          <IconButton
            label="Снять точки останова"
            title="Снять все точки останова"
            disabled={breakpointLines.length === 0}
            onClick={() => void clearBreakpoints()}
          />
          <IconButton label="Текст модели" title="Перейти к тексту модели" onClick={() => activateDocument('model-text')} />
        </div>
      </div>

      {modelState ? (
        <div className="model-state">
          <dl className="model-state__summary">
            <div>
              <dt>Модельное время</dt>
              <dd>{modelState.clock.toFixed(3)}</dd>
            </div>
            <div>
              <dt>Счётчик завершений</dt>
              <dd>{modelState.terminationCount}</dd>
            </div>
            <div>
              <dt>Транзактов</dt>
              <dd>{modelState.transactions.length}</dd>
            </div>
            <div>
              <dt>Точки останова (строки)</dt>
              <dd>{breakpointLines.length > 0 ? breakpointLines.join(', ') : 'нет'}</dd>
            </div>
          </dl>
          {modelState.stopReason ? <p className="model-state__stop">{modelState.stopReason}</p> : null}
          <p className="model-state__chains">{chains.map(([chain, count]) => `${chain}: ${count}`).join(' · ')}</p>
          <input
            className="model-state__filter"
            type="search"
            placeholder="Номер транзакта или список"
            aria-label="Поиск транзакта"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          <div className="model-state__table">
            <table aria-label="Транзакты модели">
              <thead>
                <tr>
                  <th>Транзакт</th>
                  <th>Приоритет</th>
                  <th>Семейство</th>
                  <th>Блок</th>
                  <th>След. блок</th>
                  <th>Список</th>
                  <th>Время выхода</th>
                  <th>Время в модели</th>
                  <th>Параметры</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.Number}>
                    <td>{transaction.Number}</td>
                    <td>{transaction.Priority}</td>
                    <td>{transaction.AssemblySet}</td>
                    <td>{transaction.CurrentBlock || ''}</td>
                    <td>{transaction.NextBlock}</td>
                    <td>{transaction.Chain}</td>
                    <td>{formatTime(transaction.MoveTime)}</td>
                    <td>{transaction.TransitTime.toFixed(3)}</td>
                    <td>
                      {Object.entries(transaction.Parameters)
                        .map(([name, value]) => `${name}=${value}`)
                        .join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="model-state__empty">
          Запустите моделирование или выполните STEP. Точки останова ставятся щелчком по номеру строки в документе «Текст модели» или командой STOP ,метка в
          журнале.
        </p>
      )}
    </section>
  );
}
