import { useEffect, useMemo, useState } from 'react';
import type { BalkingKind, CustomerClass, QueueDiscipline, QueueingModel, QueueingNode } from '../../../../shared/types/queueing';
import { IconButton } from '../../../../shared/ui/IconButton/IconButton';
import {
  BALKING_LABELS,
  DISCIPLINE_LABELS,
  createClass,
  createNode,
  defaultDistribution,
  exitProbability,
  formatNumber,
  kendallPreview,
  removeNode,
  updateClass,
  updateNode,
} from '../../model/queueing';
import { useTebEditorStore } from '../../store/useTebEditorStore';
import { DistributionEditor, OptionalDistribution } from './DistributionEditor';
import { NetworkDiagram } from './NetworkDiagram';
import { QueueingInsightsPanel } from './QueueingInsightsPanel';
import { QueueingResults } from './QueueingResults';
import '../BaseDocument/BaseDocument.css';
import '../ExperimentsDocument/ExperimentsDocument.css';
import './QueueingDocument.css';

type Update = (update: (model: QueueingModel) => QueueingModel) => void;

const numberOr = (text: string, fallback: number) => (text.trim() === '' || !Number.isFinite(Number(text)) ? fallback : Number(text));

function ClassEditor({ model, item, setModel }: { model: QueueingModel; item: CustomerClass; setModel: Update }) {
  const patch = (value: Partial<CustomerClass>) => setModel((current) => updateClass(current, item.Id, value));
  const overrides = item.Services ?? [];
  return (
    <article className="queueing-item" aria-label={`Класс ${item.Name}`}>
      <div className="queueing-row">
        <input className="queueing-name" aria-label="Название класса" value={item.Name} onChange={(event) => patch({ Name: event.target.value })} />
        <select
          aria-label="Тип класса"
          value={item.Kind}
          onChange={(event) =>
            patch(
              event.target.value === 'Closed'
                ? { Kind: 'Closed', Population: item.Population || 5, Think: item.Think ?? defaultDistribution('Exponential', 50), Batch: null }
                : { Kind: 'Open', Arrival: item.Arrival ?? defaultDistribution('Exponential', 10) },
            )
          }
        >
          <option value="Open">открытый поток</option>
          <option value="Closed">замкнутый (конечный источник)</option>
        </select>
        <label>
          в узел
          <select aria-label="Узел поступления" value={item.Entry} onChange={(event) => patch({ Entry: event.target.value })}>
            {model.Nodes.map((node) => (
              <option key={node.Id} value={node.Id}>
                {node.Name}
              </option>
            ))}
          </select>
        </label>
        <label title="Больший номер обслуживается первым в узлах с приоритетом">
          приоритет
          <input type="number" className="queueing-short" aria-label="Приоритет класса" value={item.Priority} onChange={(event) => patch({ Priority: Math.round(numberOr(event.target.value, 0)) })} />
        </label>
        <button
          type="button"
          className="queueing-remove"
          aria-label={`Удалить класс ${item.Name}`}
          disabled={model.Classes.length <= 1}
          onClick={() => setModel((current) => ({ ...current, Classes: current.Classes.filter((other) => other.Id !== item.Id) }))}
        >
          ×
        </button>
      </div>
      {item.Kind === 'Open' ? (
        <div className="queueing-row">
          <DistributionEditor label="Интервал между поступлениями" value={item.Arrival ?? defaultDistribution('Exponential', 10)} onChange={(Arrival) => patch({ Arrival })} />
          <label>
            группы
            <select
              aria-label="Групповое поступление"
              value={item.Batch?.Kind ?? 'None'}
              onChange={(event) =>
                patch({
                  Batch:
                    event.target.value === 'None'
                      ? null
                      : event.target.value === 'Uniform'
                        ? { Kind: 'Uniform', Min: 1, Max: 4 }
                        : { Kind: event.target.value as 'Fixed' | 'Geometric', Size: 2 },
                })
              }
            >
              <option value="None">по одной</option>
              <option value="Fixed">фиксированного размера</option>
              <option value="Uniform">размер от … до …</option>
              <option value="Geometric">геометрический размер</option>
            </select>
          </label>
          {item.Batch?.Kind === 'Uniform' ? (
            <>
              <input type="number" className="queueing-short" aria-label="Минимальный размер группы" min={1} value={item.Batch.Min ?? 1} onChange={(event) => patch({ Batch: { ...item.Batch!, Min: numberOr(event.target.value, 1) } })} />
              <input type="number" className="queueing-short" aria-label="Максимальный размер группы" min={1} value={item.Batch.Max ?? 1} onChange={(event) => patch({ Batch: { ...item.Batch!, Max: numberOr(event.target.value, 1) } })} />
            </>
          ) : item.Batch ? (
            <input type="number" className="queueing-short" aria-label="Размер группы" min={1} value={item.Batch.Size ?? 1} onChange={(event) => patch({ Batch: { ...item.Batch!, Size: numberOr(event.target.value, 1) } })} />
          ) : null}
        </div>
      ) : (
        <div className="queueing-row">
          <label>
            заявок
            <input type="number" className="queueing-short" min={1} aria-label="Число заявок замкнутого класса" value={item.Population ?? 1} onChange={(event) => patch({ Population: Math.round(numberOr(event.target.value, 1)) })} />
          </label>
          <DistributionEditor label="Время вне системы" value={item.Think ?? defaultDistribution('Exponential', 50)} onChange={(Think) => patch({ Think })} />
        </div>
      )}
      {overrides.map((override, index) => (
        <div key={index} className="queueing-row">
          <label>
            своё обслуживание в узле
            <select
              aria-label="Узел с особым временем обслуживания"
              value={override.Node}
              onChange={(event) => patch({ Services: overrides.map((other, i) => (i === index ? { ...other, Node: event.target.value } : other)) })}
            >
              {model.Nodes.map((node) => (
                <option key={node.Id} value={node.Id}>
                  {node.Name}
                </option>
              ))}
            </select>
          </label>
          <DistributionEditor label="Обслуживание класса" value={override.Service} onChange={(Service) => patch({ Services: overrides.map((other, i) => (i === index ? { ...other, Service } : other)) })} />
          <button type="button" className="queueing-remove" aria-label="Удалить особое обслуживание" onClick={() => patch({ Services: overrides.filter((_, i) => i !== index) })}>
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="queueing-link"
        onClick={() => patch({ Services: [...overrides, { Node: item.Entry || model.Nodes[0]?.Id || '', Service: defaultDistribution('Exponential', 8) }] })}
      >
        + своё время обслуживания класса в узле
      </button>
    </article>
  );
}

function NodeEditor({ model, node, setModel, selected }: { model: QueueingModel; node: QueueingNode; setModel: Update; selected: boolean }) {
  const patch = (value: Partial<QueueingNode>) => setModel((current) => updateNode(current, node.Id, value));
  const exit = exitProbability(node);
  return (
    <article className={`queueing-item${selected ? ' is-selected' : ''}`} id={`queueing-node-${node.Id}`} aria-label={`Узел ${node.Name}`}>
      <div className="queueing-row">
        <input className="queueing-name" aria-label="Название узла" value={node.Name} onChange={(event) => patch({ Name: event.target.value })} />
        <span className="queueing-kendall" title="Обозначение Кендалла A/B/c/K/N">
          {kendallPreview(model, node)}
        </span>
        <button
          type="button"
          className="queueing-remove"
          aria-label={`Удалить узел ${node.Name}`}
          disabled={model.Nodes.length <= 1}
          onClick={() => setModel((current) => removeNode(current, node.Id))}
        >
          ×
        </button>
      </div>
      <div className="queueing-row">
        <label>
          каналов
          <input
            type="number"
            className="queueing-short"
            min={1}
            aria-label="Число каналов"
            disabled={node.Servers === 0}
            value={node.Servers === 0 ? '' : node.Servers}
            onChange={(event) => patch({ Servers: Math.max(1, Math.round(numberOr(event.target.value, 1))) })}
          />
        </label>
        <label className="queueing-check">
          <input type="checkbox" checked={node.Servers === 0} onChange={(event) => patch({ Servers: event.target.checked ? 0 : 1, Patience: null, Balking: 'None', Vacation: null, TimeToFailure: null, Repair: null })} />
          неограниченно (∞)
        </label>
        <label title="Мест всего: в очереди и на обслуживании; пусто — без ограничения">
          мест всего
          <input
            type="number"
            className="queueing-short"
            min={1}
            aria-label="Ёмкость узла"
            placeholder="∞"
            value={node.Capacity ?? ''}
            onChange={(event) => patch({ Capacity: event.target.value === '' ? null : Math.max(1, Math.round(Number(event.target.value))), WhenFull: event.target.value === '' ? 'Lose' : node.WhenFull })}
          />
        </label>
        {(node.Capacity ?? null) !== null ? (
          <label>
            нет мест —
            <select
              aria-label="Если мест нет"
              value={node.WhenFull ?? 'Lose'}
              onChange={(event) => patch({ WhenFull: event.target.value as 'Lose' | 'Retry', Retrial: event.target.value === 'Retry' ? (node.Retrial ?? defaultDistribution('Exponential', 15)) : null })}
            >
              <option value="Lose">отказ</option>
              <option value="Retry">повтор с орбиты</option>
            </select>
          </label>
        ) : null}
      </div>
      {node.WhenFull === 'Retry' && (node.Capacity ?? null) !== null ? (
        <DistributionEditor label="Интервал повторных попыток" value={node.Retrial ?? defaultDistribution('Exponential', 15)} onChange={(Retrial) => patch({ Retrial })} />
      ) : null}
      <DistributionEditor label="Время обслуживания" value={node.Service} onChange={(Service) => patch({ Service })} />
      {node.Servers !== 0 ? (
        <>
          <div className="queueing-row">
            <label>
              дисциплина
              <select aria-label="Дисциплина обслуживания" value={node.Discipline} onChange={(event) => patch({ Discipline: event.target.value as QueueDiscipline, Quantum: node.Quantum || 0.5 })}>
                {Object.entries(DISCIPLINE_LABELS).map(([value, label]) => (
                  <option key={value} value={value} disabled={value === 'PreemptivePriority' && node.Servers !== 1}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {node.Discipline === 'RoundRobin' ? (
              <label>
                квант
                <input type="number" className="queueing-short" min={0} step="any" aria-label="Квант времени" value={node.Quantum ?? 0.5} onChange={(event) => patch({ Quantum: numberOr(event.target.value, 0.5) })} />
              </label>
            ) : null}
            <label>
              вступление в очередь
              <select aria-label="Отказ от вступления в очередь" value={node.Balking ?? 'None'} onChange={(event) => patch({ Balking: event.target.value as BalkingKind, BalkingThreshold: node.BalkingThreshold || 5 })}>
                {Object.entries(BALKING_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {node.Balking === 'Linear' ? (
              <label>
                порог w
                <input type="number" className="queueing-short" min={1} aria-label="Порог длины очереди" value={node.BalkingThreshold ?? 5} onChange={(event) => patch({ BalkingThreshold: numberOr(event.target.value, 5) })} />
              </label>
            ) : null}
          </div>
          <OptionalDistribution label="Нетерпеливые заявки: время терпения" value={node.Patience} defaultMean={20} onChange={(Patience) => patch({ Patience })} />
          <OptionalDistribution label="Отпуска прибора, когда узел пуст" value={node.Vacation} defaultMean={5} onChange={(Vacation) => patch({ Vacation, TimeToFailure: Vacation ? null : node.TimeToFailure, Repair: Vacation ? null : node.Repair })} />
          <OptionalDistribution
            label="Отказы: время работы до отказа"
            value={node.TimeToFailure}
            defaultMean={200}
            onChange={(TimeToFailure) => patch({ TimeToFailure, Repair: TimeToFailure ? (node.Repair ?? defaultDistribution('Exponential', 20)) : null, Vacation: TimeToFailure ? null : node.Vacation })}
          />
          {node.TimeToFailure ? <DistributionEditor label="Время восстановления" value={node.Repair ?? defaultDistribution('Exponential', 20)} onChange={(Repair) => patch({ Repair })} /> : null}
        </>
      ) : null}
      <div className="queueing-routes">
        <span>После обслуживания:</span>
        {node.Routes.map((route, index) => (
          <span key={index} className="queueing-route">
            <input
              type="number"
              className="queueing-short"
              min={0}
              max={1}
              step={0.05}
              aria-label="Вероятность перехода"
              value={route.Probability}
              onChange={(event) => patch({ Routes: node.Routes.map((other, i) => (i === index ? { ...other, Probability: numberOr(event.target.value, 0) } : other)) })}
            />
            →
            <select
              aria-label="Узел перехода"
              value={route.Target ?? ''}
              onChange={(event) => patch({ Routes: node.Routes.map((other, i) => (i === index ? { ...other, Target: event.target.value } : other)) })}
            >
              {model.Nodes.map((other) => (
                <option key={other.Id} value={other.Id}>
                  {other.Name}
                </option>
              ))}
            </select>
            <button type="button" className="queueing-remove" aria-label="Удалить переход" onClick={() => patch({ Routes: node.Routes.filter((_, i) => i !== index) })}>
              ×
            </button>
          </span>
        ))}
        <span className={exit < -1e-9 ? 'queueing-error' : 'queueing-muted'}>выход {formatNumber(exit, 3)}</span>
        <button
          type="button"
          className="queueing-link"
          onClick={() => patch({ Routes: [...node.Routes, { Target: model.Nodes.find((other) => other.Id !== node.Id)?.Id ?? node.Id, Probability: Math.min(1, Math.max(0, exit)) || 0.5 }] })}
        >
          + переход
        </button>
      </div>
    </article>
  );
}

/** "Конструктор СМО": queueing systems and networks of any type, their theory, simulation and GPSS model. */
export function QueueingDocument() {
  const model = useTebEditorStore((state) => state.queueingModel);
  const presets = useTebEditorStore((state) => state.queueingPresets);
  const analysis = useTebEditorStore((state) => state.queueingAnalysis);
  const run = useTebEditorStore((state) => state.queueingRun);
  const stale = useTebEditorStore((state) => state.queueingRunStale);
  const errors = useTebEditorStore((state) => state.queueingErrors);
  const busy = useTebEditorStore((state) => state.queueingBusy);
  const setModel = useTebEditorStore((state) => state.setQueueingModel);
  const loadPresets = useTebEditorStore((state) => state.loadQueueingPresets);
  const applyPreset = useTebEditorStore((state) => state.applyQueueingPreset);
  const analyze = useTebEditorStore((state) => state.analyzeQueueing);
  const simulate = useTebEditorStore((state) => state.simulateQueueing);
  const openModelText = useTebEditorStore((state) => state.openQueueingModelText);
  const reset = useTebEditorStore((state) => state.resetQueueingModel);
  const insights = useTebEditorStore((state) => state.queueingInsights);
  const explain = useTebEditorStore((state) => state.explainQueueingResults);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    void loadPresets();
  }, [loadPresets]);

  // Theory follows the description: recomputed shortly after every change.
  useEffect(() => {
    const timer = window.setTimeout(() => void analyze(), 350);
    return () => window.clearTimeout(timer);
  }, [model, analyze]);

  const groups = useMemo(() => {
    const result = new Map<string, typeof presets>();
    for (const preset of presets) {
      result.set(preset.Group, [...(result.get(preset.Group) ?? []), preset]);
    }

    return [...result.entries()];
  }, [presets]);
  const description = presets.find((preset) => preset.Model.Name === model.Name)?.Description;

  const selectNode = (nodeId: string) => {
    setSelected(nodeId);
    document.getElementById(`queueing-node-${nodeId}`)?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  };

  return (
    <section className="placeholder-document queueing-document">
      <div className="placeholder-document__header">
        <h2>Конструктор систем массового обслуживания</h2>
        <div className="placeholder-document__actions">
          <select aria-label="Пример системы" value="" onChange={(event) => event.target.value && applyPreset(event.target.value)}>
            <option value="">Пример системы…</option>
            {groups.map(([group, items]) => (
              <optgroup key={group} label={group}>
                {items.map((preset) => (
                  <option key={preset.Id} value={preset.Id}>
                    {preset.Title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <IconButton
            label={busy === 'simulate' ? 'Моделирование...' : 'Моделировать и сравнить'}
            title="Выполнить прогоны модели GPSS и сравнить с теорией"
            disabled={busy !== null || errors.length > 0}
            onClick={() => void simulate()}
          />
          <IconButton label="Открыть текст модели GPSS" title="Сформировать модель GPSS и открыть её в документе «Текст модели»" disabled={errors.length > 0} onClick={() => void openModelText()} />
          <IconButton label="Сбросить" title="Вернуть систему M/M/1" onClick={reset} />
        </div>
      </div>

      <div className="queueing-document__body">
        <div className="queueing-editor">
          <section className="experiment-card" aria-label="Параметры моделирования">
            <header>
              <h3>Система</h3>
            </header>
            {description ? <p className="queueing-muted">{description}</p> : null}
            <div className="experiment-settings">
              <label>
                Название
                <input aria-label="Название системы" value={model.Name} onChange={(event) => setModel((current) => ({ ...current, Name: event.target.value }))} />
              </label>
              <label>
                Единица времени
                <input aria-label="Единица времени" value={model.TimeUnit} onChange={(event) => setModel((current) => ({ ...current, TimeUnit: event.target.value }))} />
              </label>
              <label>
                Длительность сбора статистики
                <input type="number" min={1} aria-label="Длительность" value={model.Duration} onChange={(event) => setModel((current) => ({ ...current, Duration: numberOr(event.target.value, current.Duration) }))} />
              </label>
              <label>
                Разгон (отбрасывается)
                <input type="number" min={0} aria-label="Разгонный период" value={model.WarmUp} onChange={(event) => setModel((current) => ({ ...current, WarmUp: numberOr(event.target.value, 0) }))} />
              </label>
              <label>
                Прогонов
                <input type="number" min={1} max={30} aria-label="Число прогонов" value={model.Replications} onChange={(event) => setModel((current) => ({ ...current, Replications: Math.round(numberOr(event.target.value, 1)) }))} />
              </label>
            </div>
          </section>

          <section className="experiment-card" aria-label="Схема сети">
            <header>
              <h3>Схема</h3>
              <span className="queueing-muted">щелчок по узлу — к его параметрам</span>
            </header>
            <div className="queueing-diagram-wrap">
              <NetworkDiagram model={model} analysis={(run?.Analysis ?? analysis)?.Nodes} selected={selected} onSelect={selectNode} />
            </div>
          </section>

          <section className="experiment-card" aria-label="Классы заявок">
            <header>
              <h3>Классы заявок</h3>
              <button type="button" onClick={() => setModel((current) => ({ ...current, Classes: [...current.Classes, createClass(current)] }))}>
                Добавить класс
              </button>
            </header>
            {model.Classes.map((item) => (
              <ClassEditor key={item.Id} model={model} item={item} setModel={setModel} />
            ))}
          </section>

          <section className="experiment-card" aria-label="Узлы обслуживания">
            <header>
              <h3>Узлы обслуживания</h3>
              <button type="button" onClick={() => setModel((current) => ({ ...current, Nodes: [...current.Nodes, createNode(current)] }))}>
                Добавить узел
              </button>
            </header>
            {model.Nodes.map((node) => (
              <NodeEditor key={node.Id} model={model} node={node} setModel={setModel} selected={selected === node.Id} />
            ))}
          </section>
        </div>

        <section className="experiment-card queueing-results-panel" aria-label="Результаты">
          <header>
            <h3>Теория и моделирование</h3>
          </header>
          {errors.length > 0 ? (
            <ul className="queueing-errors">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : (
            <>
              <QueueingInsightsPanel insights={insights} busy={busy === 'insights'} onAnalyze={() => void explain()} />
              <QueueingResults analysis={analysis} run={run} stale={stale} timeUnit={model.TimeUnit} />
            </>
          )}
        </section>
      </div>
    </section>
  );
}
