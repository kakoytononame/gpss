import { CartesianGrid, ErrorBar, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ExperimentResult } from '../../../../shared/types/experiment';
import { AXIS_TICK, CHART_THEME, formatNumber } from '../SimulationChartsDocument/chartTheme';

function formatSummary(mean: number, halfWidth: number): string {
  return halfWidth > 0 ? `${formatNumber(mean)} ± ${formatNumber(halfWidth)}` : formatNumber(mean);
}

/** Indicator against the first factor (or against the plan point when there are several factors). */
export function ExperimentResultChart({ result, indicator }: { result: ExperimentResult; indicator: number }) {
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

/** Points of the series: factor levels and indicator means with 95 % intervals; the best point is starred. */
export function ExperimentResultTable({ result }: { result: ExperimentResult }) {
  return (
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
  );
}
