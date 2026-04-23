import saveIcon from '../../../shared/assets/icons/save.png';
import { IconButton } from '../../../shared/ui/IconButton';
import { useTebEditorStore } from '../store/useTebEditorStore';

interface ReportMetric {
  label: string;
  value: string;
}

export function StandardReportDocument() {
  const teb = useTebEditorStore((state) => state.teb);
  const simulationState = useTebEditorStore((state) => state.simulationState);
  const setStatusMessage = useTebEditorStore((state) => state.setStatusMessage);
  const activateDocument = useTebEditorStore((state) => state.activateDocument);

  const reportMetrics: ReportMetric[] = [
    { label: 'Модель', value: teb?.header || teb?.nameInModel || 'Столовая' },
    { label: 'Тип ТЭБа', value: teb?.type || 'SimpleTebClass' },
    { label: 'Статус моделирования', value: simulationState === 'running' ? 'Выполняется' : simulationState === 'stopped' ? 'Остановлено' : 'Готово к запуску' },
    { label: 'GPSS-команд', value: String(teb?.gpssModel.text.split('\n').filter((line) => line.trim()).length ?? 0) },
    { label: 'Параметров', value: String(teb?.parameters.length ?? 0) },
    { label: 'Входов / выходов', value: `${teb?.inputs.length ?? 0} / ${teb?.outputs.length ?? 0}` },
    { label: 'GPSS-объектов', value: String(teb?.gpssEntities.length ?? 0) },
    { label: 'Состояний', value: String(teb?.states.length ?? 0) },
  ];

  return (
    <section className="placeholder-document">
      <div className="placeholder-document__header">
        <h2>Стандартный отчёт</h2>
        <div className="placeholder-document__actions">
          <IconButton
            icon={saveIcon}
            label="Сохранить отчёт"
            title="Сохранить отчёт"
            onClick={() => setStatusMessage('Стандартный отчёт подготовлен к сохранению.', 'saved')}
          />
          <IconButton label="К схеме" title="Открыть структурную схему" onClick={() => activateDocument('scheme')} />
        </div>
      </div>

      <div className="report-layout">
        <section className="report-panel">
          <h3 className="report-panel__title">Сводка модели</h3>
          <div className="report-table">
            {reportMetrics.map((metric) => (
              <div className="report-table__row" key={metric.label}>
                <span className="report-table__label">{metric.label}</span>
                <span className="report-table__value">{metric.value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="report-panel">
          <h3 className="report-panel__title">Параметры</h3>
          <div className="report-list">
            {(teb?.parameters.length ? teb.parameters : []).map((parameter) => (
              <div className="report-list__item" key={parameter.id}>
                <strong>{parameter.header || parameter.nameInModel}</strong>
                <span>{String(parameter.currentValue || parameter.defaultValue || '-')}</span>
              </div>
            ))}
            {!teb?.parameters.length ? <div className="report-list__empty">Параметры отсутствуют.</div> : null}
          </div>
        </section>

        <section className="report-panel report-panel--wide">
          <h3 className="report-panel__title">Описание модели</h3>
          <p className="report-description">{teb?.description || 'Описание для текущего ТЭБа пока не задано.'}</p>
        </section>
      </div>
    </section>
  );
}
