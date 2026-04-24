import { IconButton } from '../../../../shared/ui/IconButton/IconButton';
import { useTebEditorStore } from '../../store/useTebEditorStore';
import '../BaseDocument/BaseDocument.css';
import './SchemeDocument.css';

export function SchemeDocument() {
  const activateDocument = useTebEditorStore((state) => state.activateDocument);
  const startSimulation = useTebEditorStore((state) => state.startSimulation);
  const stopSimulation = useTebEditorStore((state) => state.stopSimulation);
  const simulationState = useTebEditorStore((state) => state.simulationState);

  return (
    <section className="placeholder-document">
      <div className="placeholder-document__header">
        <h2>Структурная схема</h2>
        <div className="placeholder-document__actions">
          <IconButton label="Открыть ТЭБ" title="Перейти к редактору ТЭБа" onClick={() => activateDocument('editor')} />
          <IconButton label="Старт" title="Запустить моделирование" onClick={startSimulation} />
          <IconButton label="Стоп" title="Остановить моделирование" onClick={stopSimulation} />
          <IconButton label="Отчёт" title="Открыть стандартный отчёт" onClick={() => activateDocument('std-report')} />
          <IconButton label="Журнал" title="Открыть журнал моделирования" onClick={() => activateDocument('model-log')} />
        </div>
      </div>

      <div className="scheme-canvas">
        {[
          { label: 'Прибытие посетителей', className: 'scheme-node scheme-node--top' },
          { label: 'Выбор кухни', className: 'scheme-node scheme-node--center' },
          { label: 'Обслуживание посетителя Касса 1', className: 'scheme-node scheme-node--left' },
          { label: 'Обслуживание посетителя Касса 3', className: 'scheme-node scheme-node--middle' },
          { label: 'Обслуживание посетителя Касса 5', className: 'scheme-node scheme-node--right' },
        ].map((node) => (
          <button className={node.className} key={node.label} type="button" onClick={() => activateDocument('editor')}>
            {node.label}
          </button>
        ))}
        <div className="scheme-caption">Состояние моделирования: {simulationState}</div>
      </div>
    </section>
  );
}
