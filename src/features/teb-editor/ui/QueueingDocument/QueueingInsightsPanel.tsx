import type { QueueingInsightsResponse } from '../../../../shared/types/queueing';

const SEVERITY_LABELS = { Critical: 'важно', Warning: 'внимание', Info: 'сведения' } as const;

interface QueueingInsightsPanelProps {
  insights: QueueingInsightsResponse | null;
  busy: boolean;
  onAnalyze: () => void;
}

/** Findings with recommendations and, when the server has a language model, its explanation. */
export function QueueingInsightsPanel({ insights, busy, onAnalyze }: QueueingInsightsPanelProps) {
  return (
    <section className="queueing-result-card queueing-insights" aria-label="Анализ результатов">
      <header>
        <h4>Анализ результатов</h4>
        <button type="button" disabled={busy} onClick={onAnalyze}>
          {busy ? 'Анализ...' : insights ? 'Обновить анализ' : 'Проанализировать'}
        </button>
      </header>
      {!insights ? (
        <p className="queueing-muted">Узкие места, потери, точность оценок и что изменить. Если на сервере подключена языковая модель, она поясняет выводы.</p>
      ) : (
        <>
          <ul className="queueing-findings">
            {insights.Findings.map((finding) => (
              <li key={`${finding.NodeId}-${finding.Title}`} className={`is-${finding.Severity.toLowerCase()}`}>
                <span className="queueing-findings__severity">{SEVERITY_LABELS[finding.Severity]}</span>
                <strong>{finding.Title}.</strong> {finding.Text}
              </li>
            ))}
          </ul>
          {insights.Explanation ? (
            <div className="queueing-explanation">
              <p className="queueing-muted">
                Пояснение: {insights.Provider}
                {insights.ModelName ? `, ${insights.ModelName}` : ''}
              </p>
              {insights.Explanation.split(/\n{2,}/).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          ) : insights.Error ? (
            <p className="queueing-note">{insights.Error}</p>
          ) : insights.Provider === null ? (
            <p className="queueing-muted">Языковая модель на сервере не подключена — показан встроенный анализ (настройка: AI_ANALYSIS.md).</p>
          ) : null}
        </>
      )}
    </section>
  );
}
