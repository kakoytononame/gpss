import { useEffect } from 'react';
import { IconButton } from '../../../../shared/ui/IconButton/IconButton';
import { isSet, modelForms } from '../../model/userForms';
import { useTebEditorStore } from '../../store/useTebEditorStore';
import { ChartCard, StepSeriesChart } from '../SimulationChartsDocument/ChartCards';
import { FormCanvas } from './FormCanvas';
import { FormSelector, NoFormPlaceholder } from './FormHeader';
import '../BaseDocument/BaseDocument.css';
import '../SimulationChartsDocument/SimulationChartsDocument.css';
import './FormDocuments.css';

/**
 * "Динамическая форма": the form layout with indicators of the running model (SNA boxes coloured by
 * value intervals, charts) and the dynamics of the monitored indicators over model time.
 */
export function DynamicFormDocument() {
  const project = useTebEditorStore((state) => state.project);
  const modelIndex = useTebEditorStore((state) => state.projectModelIndex);
  const formIndex = useTebEditorStore((state) => state.projectFormIndex);
  const values = useTebEditorStore((state) => state.formIndicatorValues);
  const sessionId = useTebEditorStore((state) => state.simulationSessionId);
  const report = useTebEditorStore((state) => state.simulationReport);
  const clock = useTebEditorStore((state) => state.modelState?.clock ?? state.simulationReport?.EndTime ?? null);
  const busy = useTebEditorStore((state) => state.formBusy || state.simulationBusy);
  const openForm = useTebEditorStore((state) => state.openForm);
  const runForm = useTebEditorStore((state) => state.runForm);
  const refreshFormIndicators = useTebEditorStore((state) => state.refreshFormIndicators);
  const executeSimulationCommand = useTebEditorStore((state) => state.executeSimulationCommand);

  const forms = modelForms(project, modelIndex);
  const form = forms[formIndex];

  // Indicators follow the simulation: every new state of the session is read again.
  useEffect(() => {
    if (sessionId) {
      void refreshFormIndicators();
    }
  }, [sessionId, clock, formIndex, refreshFormIndicators]);

  if (!form) {
    return <NoFormPlaceholder title="Динамическая форма" />;
  }

  const monitors = report?.Charts.TimeSeries.filter((series) => series.Kind === 'monitor') ?? [];

  return (
    <section className="placeholder-document form-document" aria-label="Динамическая форма">
      <div className="placeholder-document__header">
        <h2>Динамическая форма — {form.Name}</h2>
        <div className="placeholder-document__actions">
          <FormSelector forms={forms} selected={formIndex} onSelect={(index) => openForm(index, 'dynamic-form')} />
          <IconButton
            label="Моделировать"
            title="Сформировать модель по форме ввода и выполнить моделирование"
            disabled={busy}
            onClick={() => void runForm()}
          />
          <IconButton label="STEP" title="Один вход транзакта в блок" disabled={busy || !sessionId} onClick={() => void executeSimulationCommand('STEP 1')} />
          <IconButton label="Обновить" title="Прочитать значения показателей" disabled={!sessionId} onClick={() => void refreshFormIndicators()} />
        </div>
      </div>

      <div className="form-document__body">
        <p className="form-document__status">
          {sessionId
            ? `Модельное время: ${isSet(clock) ? clock.toFixed(3) : '—'}`
            : 'Модель не запущена: нажмите «Моделировать», чтобы увидеть значения показателей.'}
        </p>
        {form.DynamicForm ? (
          <div className="form-document__canvas" aria-label="Макет динамической формы">
            <FormCanvas root={form.DynamicForm} images={form.Images} indicatorValue={(id) => values[id]} clock={clock} />
          </div>
        ) : (
          <p className="form-document__empty">У формы нет динамического макета.</p>
        )}

        {monitors.length > 0 && report ? (
          <section className="form-document__dynamics" aria-label="Динамика показателей">
            <h3>Динамика показателей</h3>
            <div className="chart-grid">
              {monitors.map((series) => (
                <ChartCard key={series.Name} title={series.Name} height={170}>
                  <StepSeriesChart series={series} valueLabel={series.Name} startTime={series.Points[0]?.[0] ?? 0} endTime={report.EndTime} />
                </ChartCard>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}
