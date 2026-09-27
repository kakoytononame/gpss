import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ChartBar, ChartSeries, TableHistogram } from '../../../../shared/types/simulation';
import { AXIS_TICK, CHART_THEME, formatNumber } from './chartTheme';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  height?: number;
  children: ReactNode;
}

export function ChartCard({ title, subtitle, height = 240, children }: ChartCardProps) {
  return (
    <figure className="chart-card">
      <figcaption>
        <span className="chart-card__title">{title}</span>
        {subtitle ? <span className="chart-card__subtitle">{subtitle}</span> : null}
      </figcaption>
      <div className="chart-card__plot" style={{ height }}>
        {children}
      </div>
    </figure>
  );
}

const tooltipStyle = {
  contentStyle: { border: `1px solid ${CHART_THEME.grid}`, borderRadius: 4, fontSize: 12, color: CHART_THEME.textPrimary },
  labelStyle: { color: CHART_THEME.textSecondary },
  itemStyle: { color: CHART_THEME.textPrimary },
};

interface BarsChartProps {
  data: ChartBar[];
  valueLabel: string;
  domainMax?: number;
  horizontal?: boolean;
}

/** Single-series bar chart; bars are the hover targets. */
export function BarsChart({ data, valueLabel, domainMax, horizontal = false }: BarsChartProps) {
  const tooltip = <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(42, 120, 214, 0.08)' }} formatter={(value: number) => [formatNumber(value), valueLabel]} />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      {horizontal ? (
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }} barCategoryGap={2}>
          <CartesianGrid horizontal={false} stroke={CHART_THEME.grid} />
          <XAxis type="number" tick={AXIS_TICK} stroke={CHART_THEME.axis} domain={[0, domainMax ?? 'auto']} />
          <YAxis type="category" dataKey="Name" tick={AXIS_TICK} stroke={CHART_THEME.axis} width={120} interval={0} />
          {tooltip}
          <Bar dataKey="Value" fill={CHART_THEME.series} radius={[0, 4, 4, 0]} isAnimationActive={false} />
        </BarChart>
      ) : (
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }} barCategoryGap="18%">
          <CartesianGrid vertical={false} stroke={CHART_THEME.grid} />
          <XAxis
            dataKey="Name"
            tick={AXIS_TICK}
            stroke={CHART_THEME.axis}
            interval={0}
            angle={data.length > 8 ? -30 : 0}
            textAnchor={data.length > 8 ? 'end' : 'middle'}
            height={data.length > 8 ? 56 : 28}
          />
          <YAxis tick={AXIS_TICK} stroke={CHART_THEME.axis} domain={[0, domainMax ?? 'auto']} width={48} />
          {tooltip}
          <Bar dataKey="Value" fill={CHART_THEME.series} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}

/** Step line of an entity's content over model time; the crosshair tooltip shows the value at the pointer. */
export function StepSeriesChart({ series, valueLabel, startTime, endTime }: { series: ChartSeries; valueLabel: string; startTime: number; endTime: number }) {
  const data = series.Points.map(([time, value]) => ({ time, value }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} stroke={CHART_THEME.grid} />
        <XAxis
          dataKey="time"
          type="number"
          domain={[startTime, endTime]}
          allowDataOverflow
          tick={AXIS_TICK}
          stroke={CHART_THEME.axis}
          tickFormatter={(value: number) => formatNumber(value, 0)}
        />
        <YAxis allowDecimals={false} tick={AXIS_TICK} stroke={CHART_THEME.axis} width={40} />
        <Tooltip
          {...tooltipStyle}
          cursor={{ stroke: CHART_THEME.axis, strokeWidth: 1 }}
          labelFormatter={(value: number) => `Время ${formatNumber(value)}`}
          formatter={(value: number) => [value, valueLabel]}
        />
        <Line type="stepAfter" dataKey="value" stroke={CHART_THEME.series} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function HistogramChart({ table }: { table: TableHistogram }) {
  const data = table.Bins.map((bin) => ({ Name: bin.Label, Value: bin.Frequency }));
  return <BarsChart data={data} valueLabel="Частота" />;
}
