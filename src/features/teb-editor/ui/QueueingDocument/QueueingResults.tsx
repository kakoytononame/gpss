import type { AnalysisQuality, MetricComparison, QueueingAnalysis, QueueingRunResult } from '../../../../shared/types/queueing';
import { QUALITY_LABELS, comparisonStatus, formatMetric, formatNumber } from '../../model/queueing';

const NODE_THEORY_KEYS: [string, string][] = [
  ['ArrivalRate', 'Интенсивность поступления λ'],
  ['Throughput', 'Обслужено в единицу времени'],
  ['Utilization', 'Загрузка канала ρ'],
  ['L', 'Среднее число заявок в узле L'],
  ['Lq', 'Средняя длина очереди Lq'],
  ['W', 'Среднее время пребывания W'],
  ['Wq', 'Среднее время ожидания Wq'],
  ['LossProbability', 'Вероятность отказа'],
  ['BalkProbability', 'Доля не вставших в очередь'],
  ['RenegeProbability', 'Доля ушедших из очереди'],
  ['OrbitSize', 'Среднее число заявок на орбите'],
  ['OrbitTime', 'Время на орбите на одну заявку'],
  ['DownFraction', 'Доля времени восстановления'],
  ['VacationFraction', 'Доля времени отпусков'],
];

export function QualityBadge({ quality }: { quality: AnalysisQuality }) {
  return <span className={`queueing-badge queueing-badge--${quality.toLowerCase()}`}>{QUALITY_LABELS[quality]}</span>;
}

function ComparisonTable({ metrics }: { metrics: MetricComparison[] }) {
  return (
    <table className="experiment-table queueing-results-table">
      <thead>
        <tr>
          <th>Показатель</th>
          <th>Теория</th>
          <th>Моделирование ± 95 %</th>
          <th>Отклонение</th>
        </tr>
      </thead>
      <tbody>
        {metrics.map((metric) => {
          const status = comparisonStatus(metric);
          return (
            <tr key={metric.Key} className={`is-${status}`}>
              <td>{metric.Label}</td>
              <td>{formatMetric(metric.Key, metric.Analytic)}</td>
              <td>
                {formatMetric(metric.Key, metric.Mean)}
                {metric.HalfWidth ? <span className="queueing-muted"> ± {formatMetric(metric.Key, metric.HalfWidth)}</span> : null}
              </td>
              <td title={status === 'agree' ? 'Теория в пределах доверительного интервала' : undefined}>
                {typeof metric.Deviation === 'number' ? `${metric.Deviation >= 0 ? '+' : ''}${formatNumber(metric.Deviation * 100, 2)} %` : ''}
                {status === 'agree' ? ' ✓' : ''}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

interface QueueingResultsProps {
  analysis: QueueingAnalysis | null;
  run: QueueingRunResult | null;
  stale: boolean;
  timeUnit: string;
}

/** Theory per node and class; after a simulation the replications are shown next to it. */
export function QueueingResults({ analysis, run, stale, timeUnit }: QueueingResultsProps) {
  if (!analysis && !run) {
    return <p className="queueing-muted">Результаты появятся после проверки описания.</p>;
  }

  const source = run?.Analysis ?? analysis!;
  return (
    <div className="queueing-results">
      <p className="queueing-network">
        <strong>Метод:</strong> {source.Network}. Время — в единицах «{timeUnit}».
      </p>
      {source.Messages.map((message) => (
        <p key={message} className="experiment-message">
          {message}
        </p>
      ))}
      {run && stale ? <p className="experiment-message">Описание изменено после моделирования: запустите моделирование снова.</p> : null}
      {run ? (
        <p className="queueing-muted">
          {run.Replications} независимых прогонов, {run.ElapsedSeconds.toFixed(1)} с. ✓ — теоретическое значение внутри доверительного интервала.
        </p>
      ) : null}

      {source.Nodes.map((node) => {
        const simulated = run?.Nodes.find((item) => item.NodeId === node.NodeId);
        return (
          <section key={node.NodeId} className="queueing-result-card" aria-label={`Результаты узла ${node.Name}`}>
            <header>
              <h4>
                {node.Name} <span className="queueing-kendall">{node.Kendall}</span>
              </h4>
              <QualityBadge quality={node.Quality} />
            </header>
            <p className="queueing-method">
              {node.Discipline}. {node.Method}
            </p>
            {node.Notes.map((note) => (
              <p key={note} className="queueing-note">
                {note}
              </p>
            ))}
            {simulated ? (
              <ComparisonTable metrics={simulated.Metrics} />
            ) : (
              <table className="experiment-table queueing-results-table">
                <tbody>
                  {NODE_THEORY_KEYS.filter(([key]) => typeof node.Metrics[key as keyof typeof node.Metrics] === 'number').map(([key, label]) => (
                    <tr key={key}>
                      <td>{label}</td>
                      <td>{formatMetric(key, node.Metrics[key as keyof typeof node.Metrics])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}

      <section className="queueing-result-card" aria-label="Результаты по классам заявок">
        <header>
          <h4>Классы заявок</h4>
        </header>
        {run
          ? run.Classes.map((item) => (
              <div key={item.ClassId}>
                <h5>
                  {item.Name} <QualityBadge quality={item.Quality} />
                </h5>
                <ComparisonTable metrics={item.Metrics} />
              </div>
            ))
          : source.Classes.map((item) => (
              <table key={item.ClassId} className="experiment-table queueing-results-table">
                <caption>
                  {item.Name} <QualityBadge quality={item.Quality} />
                </caption>
                <tbody>
                  <tr>
                    <td>Обслужено в единицу времени</td>
                    <td>{formatMetric('Throughput', item.Throughput)}</td>
                  </tr>
                  <tr>
                    <td>Среднее время пребывания</td>
                    <td>{formatMetric('ResponseTime', item.ResponseTime)}</td>
                  </tr>
                  <tr>
                    <td>Среднее число заявок в системе</td>
                    <td>{formatMetric('InSystem', item.InSystem)}</td>
                  </tr>
                  <tr>
                    <td>Доля потерянных заявок</td>
                    <td>{formatMetric('LossProbability', item.LossProbability)}</td>
                  </tr>
                </tbody>
              </table>
            ))}
      </section>
    </div>
  );
}
