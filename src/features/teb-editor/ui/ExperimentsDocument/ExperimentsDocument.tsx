import { useMemo, useState } from 'react';
import { CartesianGrid, ErrorBar, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ExperimentResult, FactorKind } from '../../../../shared/types/experiment';
import { IconButton } from '../../../../shared/ui/IconButton/IconButton';
import { FACTOR_KIND_LABELS, parseLevels } from '../../model/experimentPlan';
import { useTebEditorStore } from '../../store/useTebEditorStore';
import { AXIS_TICK, CHART_THEME, formatNumber } from '../SimulationChartsDocument/chartTheme';
import '../BaseDocument/BaseDocument.css';
import './ExperimentsDocument.css';

function formatSummary(mean: number, halfWidth: number): string {
  return halfWidth > 0 ? `${formatNumber(mean)} ± ${formatNumber(halfWidth)}` : formatNumber(mean);
}

/** Indicator against the first factor (or against the plan point when there are several factors). */
function ResultChart({ result, indicator }: { result: ExperimentResult; indicator: number }) {
  const data = result.Points.map((point) => {
    const summary = point.Indicators[indicator];
    return {
      x: result.FactorNames.length === 1 ? point.Factors[0] : point.Index + 1,
      mean: summary?.Mean ?? null,
      error: summary?.ConfidenceHalfWidth ?? 0,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 12, right: 20, bottom: 8, left: 8 }}>
        <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" />
        <XAxis
          dataKey="x"
          tick={AXIS_TICK}
          label={{ value: result.FactorNames.length === 1 ? result.FactorNames[0] : 'Точка плана', position: 'insideBottom', offset: -4 }}
        />
        <YAxis tick={AXIS_TICK} />
        <Tooltip formatter={(value: number) => formatNumber(value)} />
        <Line type="monotone" dataKey="mean" name={result.IndicatorNames[indicator]} stroke={CHART_THEME.series} strokeWidth={2} dot isAnimationActive={false}>
          <ErrorBar dataKey="error" width={6} stroke={CHART_THEME.axis} />
        </Line>
      </LineChart>
    </ResponsiveContainer>
  );
}

/** "Эксперименты": plan of factors and indicators, series of runs with replications, results with 95 % intervals. */
export function ExperimentsDocument() {
  const plan = useTebEditorStore((state) => state.experimentPlan);
  const result = useTebEditorStore((state) => state.experimentResult);
  const busy = useTebEditorStore((state) => state.experimentBusy);
  const setPlan = useTebEditorStore((state) => state.setExperimentPlan);
  const suggestPlan = useTebEditorStore((state) => state.suggestExperimentPlan);
  const runExperiment = useTebEditorStore((state) => state.runExperiment);
  const exportExperiment = useTebEditorStore((state) => state.exportExperiment);
  const [chartIndicator, setChartIndicator] = useState(0);

  const runCount = useMemo(
    () =>
      plan.factors.filter((factor) => factor.name.trim()).reduce((count, factor) => count * Math.max(1, parseLevels(factor.levels).length), 1) *
      Math.max(1, plan.replications),
    [plan],
  );

  return (
    <section className="placeholder-document experiments-document">
      <div className="placeholder-document__header">
        <h2>Эксперименты</h2>
        <div className="placeholder-document__actions">
          <IconButton label="Предложить по модели" title="Найти факторы и показатели в тексте модели" onClick={suggestPlan} />
          <IconButton
            label={busy ? 'Выполняется...' : `Запустить серию (${runCount})`}
            title="Выполнить все прогоны плана"
            disabled={busy}
            onClick={() => void runExperiment()}
          />
          <IconButton label="Выгрузить CSV" title="Сохранить результаты для Excel" disabled={!result} onClick={exportExperiment} />
        </div>
      </div>

      <div className="experiments-document__body">
        <section className="experiment-card" aria-label="Факторы">
          <header>
            <h3>Факторы</h3>
            <button type="button" onClick={() => setPlan((current) => ({ factors: [...current.factors, { name: '', kind: 'Savevalue', levels: '' }] }))}>
              Добавить
            </button>
          </header>
          <table className="experiment-table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Вид</th>
                <th>Уровни («4; 6; 8» или «4..10 step 2»)</th>
                <th aria-label="Удалить" />
              </tr>
            </thead>
            <tbody>
              {plan.factors.map((factor, index) => (
                <tr key={index}>
                  <td>
                    <input
                      aria-label="Имя фактора"
                      value={factor.name}
                      onChange={(event) =>
                        setPlan((current) => ({ factors: current.factors.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)) }))
                      }
                    />
                  </td>
                  <td>
                    <select
                      aria-label="Вид фактора"
                      value={factor.kind}
                      onChange={(event) =>
                        setPlan((current) => ({
                          factors: current.factors.map((item, i) => (i === index ? { ...item, kind: event.target.value as FactorKind } : item)),
                        }))
                      }
                    >
                      {Object.entries(FACTOR_KIND_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      aria-label="Уровни фактора"
                      value={factor.levels}
                      onChange={(event) =>
                        setPlan((current) => ({ factors: current.factors.map((item, i) => (i === index ? { ...item, levels: event.target.value } : item)) }))
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      aria-label="Удалить фактор"
                      onClick={() => setPlan((current) => ({ factors: current.factors.filter((_, i) => i !== index) }))}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="experiment-card" aria-label="Показатели">
          <header>
            <h3>Показатели</h3>
            <button type="button" onClick={() => setPlan((current) => ({ indicators: [...current.indicators, { expression: '', label: '' }] }))}>
              Добавить
            </button>
          </header>
          <table className="experiment-table">
            <thead>
              <tr>
                <th>Выражение (СЧА)</th>
                <th>Название</th>
                <th>Цель</th>
                <th aria-label="Удалить" />
              </tr>
            </thead>
            <tbody>
              {plan.indicators.map((indicator, index) => (
                <tr key={index}>
                  <td>
                    <input
                      aria-label="Выражение показателя"
                      value={indicator.expression}
                      onChange={(event) =>
                        setPlan((current) => ({
                          indicators: current.indicators.map((item, i) => (i === index ? { ...item, expression: event.target.value } : item)),
                        }))
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label="Название показателя"
                      value={indicator.label}
                      onChange={(event) =>
                        setPlan((current) => ({
                          indicators: current.indicators.map((item, i) => (i === index ? { ...item, label: event.target.value } : item)),
                        }))
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="radio"
                      name="objective"
                      aria-label="Целевой показатель"
                      checked={plan.objective === index}
                      onChange={() => setPlan(() => ({ objective: index }))}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      aria-label="Удалить показатель"
                      onClick={() => setPlan((current) => ({ indicators: current.indicators.filter((_, i) => i !== index), objective: -1 }))}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="experiment-settings">
            <label>
              Повторов в точке
              <input
                type="number"
                min={1}
                max={50}
                value={plan.replications}
                onChange={(event) => setPlan(() => ({ replications: Math.max(1, Number(event.target.value) || 1) }))}
              />
            </label>
            <label>
              START (если нет в модели)
              <input
                type="number"
                min={1}
                value={plan.startCount}
                onChange={(event) => setPlan(() => ({ startCount: Math.max(1, Number(event.target.value) || 1) }))}
              />
            </label>
            <label>
              Цель
              <select value={plan.maximize ? 'max' : 'min'} onChange={(event) => setPlan(() => ({ maximize: event.target.value === 'max' }))}>
                <option value="min">минимум</option>
                <option value="max">максимум</option>
              </select>
            </label>
          </div>
        </section>

        {result ? (
          <section className="experiment-card experiment-card--wide" aria-label="Результаты серии">
            <header>
              <h3>Результаты: {result.Runs.length} прогонов</h3>
              {result.IndicatorNames.length > 1 ? (
                <select aria-label="Показатель на графике" value={chartIndicator} onChange={(event) => setChartIndicator(Number(event.target.value))}>
                  {result.IndicatorNames.map((name, index) => (
                    <option key={name} value={index}>
                      {name}
                    </option>
                  ))}
                </select>
              ) : null}
            </header>
            {result.Messages.map((message) => (
              <p key={message} className="experiment-message">
                {message}
              </p>
            ))}
            <table className="experiment-table experiment-table--results">
              <thead>
                <tr>
                  <th>Точка</th>
                  {result.FactorNames.map((name) => (
                    <th key={name}>{name}</th>
                  ))}
                  {result.IndicatorNames.map((name) => (
                    <th key={name}>{name} (среднее ± 95%)</th>
                  ))}
                  <th>Ошибок</th>
                </tr>
              </thead>
              <tbody>
                {result.Points.map((point) => (
                  <tr key={point.Index} className={point.Index === result.BestPoint ? 'is-best' : undefined}>
                    <td>
                      {point.Index + 1}
                      {point.Index === result.BestPoint ? ' ★' : ''}
                    </td>
                    {point.Factors.map((value, index) => (
                      <td key={index}>{formatNumber(value)}</td>
                    ))}
                    {point.Indicators.map((summary, index) => (
                      <td key={index}>{summary ? formatSummary(summary.Mean, summary.ConfidenceHalfWidth) : '—'}</td>
                    ))}
                    <td>{point.Failed || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.Points.length > 1 ? <ResultChart result={result} indicator={Math.min(chartIndicator, result.IndicatorNames.length - 1)} /> : null}
          </section>
        ) : null}
      </div>
    </section>
  );
}
