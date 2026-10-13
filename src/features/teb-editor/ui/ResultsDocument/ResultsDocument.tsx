import { useState, type ReactNode } from 'react';
import type { SeriesResultPayload, SimulationResultDetail, SimulationResultKind, SingleResultPayload } from '../../../../shared/types/result';
import type { SimulationReport } from '../../../../shared/types/simulation';
import { IconButton } from '../../../../shared/ui/IconButton/IconButton';
import { FACTOR_KIND_LABELS } from '../../model/experimentPlan';
import { formatResultDate, groupResults, RESULT_KIND_LABELS } from '../../model/simulationResults';
import { useTebEditorStore } from '../../store/useTebEditorStore';
import { ExperimentResultChart, ExperimentResultTable } from '../ExperimentsDocument/ExperimentResultView';
import { ChartCard, StepSeriesChart } from '../SimulationChartsDocument/ChartCards';
import { formatNumber } from '../SimulationChartsDocument/chartTheme';
import '../BaseDocument/BaseDocument.css';
import '../ExperimentsDocument/ExperimentsDocument.css';
import '../SimulationChartsDocument/SimulationChartsDocument.css';
import './ResultsDocument.css';

interface ResultTab<T> {
  id: string;
  label: string;
  render: (payload: T, result: SimulationResultDetail) => ReactNode;
}

function InfoTable({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <table className="experiment-table results-info">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            <td>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ModelTextView({ text }: { text: string }) {
  return text.trim() ? <pre className="results-model-text">{text}</pre> : <p className="results-empty">Текст модели не сохранён.</p>;
}

/** Sections of the stored standard report (read only). */
function ReportView({ report }: { report: SimulationReport }) {
  const [sectionId, setSectionId] = useState(report.Sections[0]?.Id ?? '');
  const section = report.Sections.find((item) => item.Id === sectionId) ?? report.Sections[0];
  if (!section) {
    return <p className="results-empty">Отчёт пуст.</p>;
  }

  return (
    <div className="results-report">
      <div className="results-report__sections" role="tablist" aria-label="Разделы отчёта">
        {report.Sections.map((item) => (
          <button
            key={item.Id}
            type="button"
            role="tab"
            aria-selected={item.Id === section.Id}
            className={item.Id === section.Id ? 'is-active' : undefined}
            onClick={() => setSectionId(item.Id)}
          >
            {item.Label}
          </button>
        ))}
      </div>
      <table className="experiment-table" aria-label={section.Label}>
        <thead>
          <tr>
            {section.Columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section.Rows.length === 0 ? (
            <tr>
              <td colSpan={section.Columns.length}>Нет данных</td>
            </tr>
          ) : (
            section.Rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {section.Columns.map((column, columnIndex) => (
                  <td key={column}>{row[columnIndex] ?? ''}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function DynamicsView({ report }: { report: SimulationReport }) {
  const series = report.Charts.TimeSeries.filter((item) => item.Kind === 'monitor');
  if (series.length === 0) {
    return <p className="results-empty">Динамика показателей не собиралась: включите сбор динамики в настройках запуска формы.</p>;
  }

  return (
    <div className="chart-grid">
      {series.map((item) => (
        <ChartCard key={item.Name} title={item.Name} subtitle="Показатель во времени" height={190}>
          <StepSeriesChart series={item} valueLabel="Значение" startTime={report.StartTime} endTime={report.EndTime} />
        </ChartCard>
      ))}
    </div>
  );
}

function SeriesChartsView({ payload }: { payload: SeriesResultPayload }) {
  const { Result: result } = payload;
  if (result.Points.length < 2) {
    return <p className="results-empty">Для графика нужно не меньше двух точек плана.</p>;
  }

  return (
    <div className="chart-grid">
      {result.IndicatorNames.map((name, index) => (
        <ChartCard key={name} title={name} subtitle="Среднее по повторам и 95 % доверительный интервал" height={280}>
          <ExperimentResultChart result={result} indicator={index} />
        </ChartCard>
      ))}
    </div>
  );
}

const SINGLE_TABS: Array<ResultTab<SingleResultPayload>> = [
  {
    id: 'general',
    label: 'Общая информация',
    render: (payload, result) => (
      <InfoTable
        rows={[
          ['Вид', 'Одиночный эксперимент'],
          ['Модель', payload.ModelName],
          ['Форма', payload.FormName ?? '—'],
          ['Сохранён', formatResultDate(result.CreatedAt)],
          ['Модельное время', `${formatNumber(payload.Report.StartTime)} – ${formatNumber(payload.Report.EndTime)}`],
          ...(payload.StartCount === null ? [] : [['Число завершений (START) по форме', payload.StartCount] as [string, ReactNode]]),
          ['Показателей динамики', payload.Report.Charts.TimeSeries.filter((item) => item.Kind === 'monitor').length],
        ]}
      />
    ),
  },
  { id: 'model-text', label: 'Текст модели', render: (payload) => <ModelTextView text={payload.ModelText} /> },
  {
    id: 'inputs',
    label: 'Исходные данные',
    render: (payload) =>
      payload.Inputs.length === 0 ? (
        <p className="results-empty">Исходные данные не сохранялись: прогон выполнен без формы ввода данных.</p>
      ) : (
        <table className="experiment-table">
          <thead>
            <tr>
              <th>Исходные данные</th>
              <th>Параметр</th>
              <th>Операнд</th>
              <th>Значение</th>
            </tr>
          </thead>
          <tbody>
            {payload.Inputs.map((input, index) => (
              <tr key={index}>
                <td>{input.Input}</td>
                <td>{input.Name}</td>
                <td>{input.Operand}</td>
                <td>{input.Value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ),
  },
  { id: 'dynamics', label: 'Динамика показателей', render: (payload) => <DynamicsView report={payload.Report} /> },
  { id: 'report', label: 'Стандартный отчёт', render: (payload) => <ReportView report={payload.Report} /> },
];

const SERIES_TABS: Array<ResultTab<SeriesResultPayload>> = [
  {
    id: 'general',
    label: 'Общая информация',
    render: (payload, result) => (
      <InfoTable
        rows={[
          ['Вид', 'Серия экспериментов'],
          ['Модель', payload.ModelName],
          ['Сохранена', formatResultDate(result.CreatedAt)],
          ['Точек плана', payload.Result.Points.length],
          ['Прогонов', payload.Result.Runs.length],
          ['Повторов в точке', payload.Replications],
          ['Время выполнения', `${formatNumber(payload.Result.ElapsedSeconds, 1)} с`],
          ['Лучшая точка', payload.Result.BestPoint === null ? '—' : `${payload.Result.BestPoint + 1} (${payload.Maximize ? 'максимум' : 'минимум'} цели)`],
        ]}
      />
    ),
  },
  { id: 'model-text', label: 'Текст модели', render: (payload) => <ModelTextView text={payload.ModelText} /> },
  {
    id: 'plan',
    label: 'План эксперимента',
    render: (payload) => (
      <>
        <table className="experiment-table" aria-label="Факторы">
          <thead>
            <tr>
              <th>Фактор</th>
              <th>Вид</th>
              <th>Уровни</th>
            </tr>
          </thead>
          <tbody>
            {payload.Factors.map((factor) => (
              <tr key={factor.Name}>
                <td>{factor.Name}</td>
                <td>
                  {FACTOR_KIND_LABELS[factor.Kind]}
                  {factor.Kind === 'Operand' && factor.Line ? ` (стр. ${factor.Line}, оп. ${factor.Operand ?? ''})` : ''}
                </td>
                <td>{factor.Levels.map((level) => formatNumber(level)).join('; ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="experiment-table" aria-label="Показатели">
          <thead>
            <tr>
              <th>Показатель (СЧА)</th>
              <th>Название</th>
            </tr>
          </thead>
          <tbody>
            {payload.Indicators.map((indicator) => (
              <tr key={indicator.Expression}>
                <td>{indicator.Expression}</td>
                <td>{indicator.Label ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    ),
  },
  {
    id: 'table',
    label: 'Результаты серии',
    render: (payload) => (
      <>
        {payload.Result.Messages.map((message) => (
          <p key={message} className="experiment-message">
            {message}
          </p>
        ))}
        <ExperimentResultTable result={payload.Result} />
      </>
    ),
  },
  { id: 'charts', label: 'Графики', render: (payload) => <SeriesChartsView payload={payload} /> },
];

function ResultTabs<T>({ tabs, payload, result }: { tabs: Array<ResultTab<T>>; payload: T; result: SimulationResultDetail }) {
  const [tabId, setTabId] = useState(tabs[0].id);
  const tab = tabs.find((item) => item.id === tabId) ?? tabs[0];

  return (
    <>
      <div className="results-tabs" role="tablist" aria-label="Вкладки результата">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === tab.id}
            className={item.id === tab.id ? 'is-active' : undefined}
            onClick={() => setTabId(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="results-tab-content" role="tabpanel" aria-label={tab.label}>
        {tab.render(payload, result)}
      </div>
    </>
  );
}

function ResultView({ result }: { result: SimulationResultDetail }) {
  // Keyed by id so that the tabs start from "Общая информация" for every opened result.
  return result.Kind === 'single' ? (
    <ResultTabs key={result.Id} tabs={SINGLE_TABS} payload={result.Payload} result={result} />
  ) : (
    <ResultTabs key={result.Id} tabs={SERIES_TABS} payload={result.Payload} result={result} />
  );
}

/** "Результаты моделирования": tree of saved single experiments and series, and the tabs of the selected result. */
export function ResultsDocument() {
  const results = useTebEditorStore((state) => state.simulationResults);
  const selected = useTebEditorStore((state) => state.selectedResult);
  const busy = useTebEditorStore((state) => state.resultsBusy);
  const hasReport = useTebEditorStore((state) => state.simulationReport !== null);
  const hasSeries = useTebEditorStore((state) => state.experimentResult !== null);
  const projectName = useTebEditorStore((state) => state.project?.Name ?? null);
  const openResult = useTebEditorStore((state) => state.openResult);
  const saveSimulationResult = useTebEditorStore((state) => state.saveSimulationResult);
  const saveExperimentResult = useTebEditorStore((state) => state.saveExperimentResult);
  const renameResult = useTebEditorStore((state) => state.renameResult);
  const deleteResult = useTebEditorStore((state) => state.deleteResult);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const grouped = groupResults(results);

  function commitRename() {
    if (renaming) {
      void renameResult(renaming.id, renaming.name);
      setRenaming(null);
    }
  }

  return (
    <section className="placeholder-document results-document">
      <div className="placeholder-document__header">
        <h2>Результаты моделирования{projectName ? `: ${projectName}` : ''}</h2>
        <div className="placeholder-document__actions">
          <IconButton
            label="Сохранить прогон"
            title="Сохранить последний прогон модели как одиночный эксперимент"
            disabled={!hasReport}
            onClick={() => void saveSimulationResult()}
          />
          <IconButton
            label="Сохранить серию"
            title="Сохранить последнюю серию экспериментов"
            disabled={!hasSeries}
            onClick={() => void saveExperimentResult()}
          />
        </div>
      </div>

      <div className="results-document__body">
        <nav className="results-tree" aria-label="Дерево результатов">
          {(['single', 'series'] as SimulationResultKind[]).map((kind) => (
            <section key={kind} aria-label={RESULT_KIND_LABELS[kind]}>
              <h3>
                {RESULT_KIND_LABELS[kind]} ({grouped[kind].length})
              </h3>
              {grouped[kind].length === 0 ? (
                <p className="results-empty">
                  {kind === 'single' ? 'Сохраняются после моделирования по форме.' : 'Сохраняются после выполнения серии в «Экспериментах».'}
                </p>
              ) : (
                <ul>
                  {grouped[kind].map((item) => (
                    <li key={item.Id} className={selected?.Id === item.Id ? 'is-selected' : undefined}>
                      {renaming?.id === item.Id ? (
                        <input
                          autoFocus
                          aria-label="Имя результата"
                          value={renaming.name}
                          onChange={(event) => setRenaming({ id: item.Id, name: event.target.value })}
                          onBlur={commitRename}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              commitRename();
                            } else if (event.key === 'Escape') {
                              setRenaming(null);
                            }
                          }}
                        />
                      ) : (
                        <button type="button" className="results-tree__item" disabled={busy} onClick={() => void openResult(item.Id)}>
                          <span>{item.Name}</span>
                          <small>{formatResultDate(item.CreatedAt)}</small>
                        </button>
                      )}
                      <span className="results-tree__tools">
                        <button
                          type="button"
                          title="Переименовать"
                          aria-label={`Переименовать «${item.Name}»`}
                          onClick={() => setRenaming({ id: item.Id, name: item.Name })}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          title="Удалить"
                          aria-label={`Удалить «${item.Name}»`}
                          onClick={() => {
                            if (window.confirm(`Удалить результат «${item.Name}»?`)) {
                              void deleteResult(item.Id);
                            }
                          }}
                        >
                          ×
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </nav>

        <div className="results-detail">
          {selected ? (
            <>
              <h3 className="results-detail__title">{selected.Name}</h3>
              <ResultView result={selected} />
            </>
          ) : (
            <p className="results-empty">Выберите результат в дереве слева.</p>
          )}
        </div>
      </div>
    </section>
  );
}
