import type {
  AnalysisQuality,
  BalkingKind,
  CustomerClass,
  Distribution,
  DistributionKind,
  MetricComparison,
  QueueDiscipline,
  QueueingModel,
  QueueingNode,
} from '../../../shared/types/queueing';

export const DISTRIBUTION_LABELS: Record<DistributionKind, string> = {
  Exponential: 'Экспоненциальное (M)',
  Deterministic: 'Постоянное (D)',
  Erlang: 'Эрланга (Ek)',
  HyperExponential: 'Гиперэкспоненциальное (H2)',
  Uniform: 'Равномерное (U)',
  Normal: 'Нормальное (N)',
  LogNormal: 'Логнормальное (LN)',
  Triangular: 'Треугольное (T)',
  Gamma: 'Гамма (Γ)',
  Weibull: 'Вейбулла (W)',
};

export const DISCIPLINE_LABELS: Record<QueueDiscipline, string> = {
  Fifo: 'FIFO — в порядке поступления',
  Lifo: 'LIFO — последним пришёл, первым обслужен',
  Random: 'SIRO — случайный выбор',
  ShortestJob: 'SPT — кратчайшая работа первой',
  Priority: 'Относительный приоритет',
  PreemptivePriority: 'Абсолютный приоритет (прерывание)',
  RoundRobin: 'Циклическое (квант времени)',
};

export const BALKING_LABELS: Record<BalkingKind, string> = {
  None: 'всегда встаёт в очередь',
  Linear: 'вероятность 1 − w/порог',
  Discouraged: 'вероятность 1/(w + 1)',
};

export const QUALITY_LABELS: Record<AnalysisQuality, string> = {
  Exact: 'точное решение',
  Approximate: 'приближение',
  Unavailable: 'только моделирование',
};

/** Probabilities and utilisation are shown in per cent. */
export const PERCENT_METRICS = new Set(['Utilization', 'LossProbability', 'BalkProbability', 'RenegeProbability', 'DownFraction', 'VacationFraction']);

const isFiniteNumber = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value);

/** Distribution of the given kind with mean <paramref name="mean"/> and typical shape parameters. */
export function defaultDistribution(kind: DistributionKind, mean = 10): Distribution {
  switch (kind) {
    case 'Exponential':
    case 'Deterministic':
      return { Kind: kind, Mean: mean };
    case 'Erlang':
      return { Kind: kind, Mean: mean, Shape: 2 };
    case 'HyperExponential':
      return { Kind: kind, Mean: mean, Cv: 2 };
    case 'Uniform':
      return { Kind: kind, Min: round(mean / 2), Max: round(mean * 1.5) };
    case 'Normal':
      return { Kind: kind, Mean: mean, Cv: 0.3 };
    case 'LogNormal':
    case 'Gamma':
      return { Kind: kind, Mean: mean, Cv: 0.7 };
    case 'Triangular':
      return { Kind: kind, Min: round(mean / 2), Mode: mean, Max: round(mean * 1.5) };
    case 'Weibull':
      return { Kind: kind, Mean: mean, Shape: 2 };
  }
}

export function distributionMean(distribution: Distribution): number {
  switch (distribution.Kind) {
    case 'Uniform':
      return ((distribution.Min ?? 0) + (distribution.Max ?? 0)) / 2;
    case 'Triangular':
      return ((distribution.Min ?? 0) + (distribution.Mode ?? 0) + (distribution.Max ?? 0)) / 3;
    default:
      return distribution.Mean ?? 0;
  }
}

export function distributionCode(distribution: Distribution): string {
  switch (distribution.Kind) {
    case 'Exponential':
      return 'M';
    case 'Deterministic':
      return 'D';
    case 'Erlang':
      return `E${distribution.Shape ?? 1}`;
    case 'HyperExponential':
      return 'H2';
    case 'Uniform':
      return 'U';
    case 'Normal':
      return 'N';
    case 'LogNormal':
      return 'LN';
    case 'Triangular':
      return 'T';
    case 'Gamma':
      return 'Γ';
    case 'Weibull':
      return 'W';
  }
}

/** Short label such as "M, среднее 10" or "U [4; 16]". */
export function distributionLabel(distribution: Distribution | null | undefined): string {
  if (!distribution) {
    return '—';
  }

  const d = distribution;
  switch (d.Kind) {
    case 'Exponential':
      return `M, среднее ${formatNumber(d.Mean)}`;
    case 'Deterministic':
      return `D = ${formatNumber(d.Mean)}`;
    case 'Erlang':
      return `E${d.Shape ?? 1}, среднее ${formatNumber(d.Mean)}`;
    case 'HyperExponential':
    case 'Normal':
    case 'LogNormal':
    case 'Gamma':
      return `${distributionCode(d)}, среднее ${formatNumber(d.Mean)}, v = ${formatNumber(d.Cv)}`;
    case 'Uniform':
      return `U [${formatNumber(d.Min)}; ${formatNumber(d.Max)}]`;
    case 'Triangular':
      return `T [${formatNumber(d.Min)}; ${formatNumber(d.Mode)}; ${formatNumber(d.Max)}]`;
    case 'Weibull':
      return `W, среднее ${formatNumber(d.Mean)}, k = ${formatNumber(d.Shape)}`;
  }
}

/** Kendall notation preview computed on the client (the server refines the arrival code). */
export function kendallPreview(model: QueueingModel, node: QueueingNode): string {
  const external = model.Classes.filter((item) => item.Entry === node.Id);
  const internal = model.Nodes.some((other) => other.Routes.some((route) => route.Target === node.Id && route.Probability > 0));
  const closed = model.Classes.find((item) => item.Kind === 'Closed');
  let arrival = 'G';
  if (!internal && external.length === 1) {
    const item = external[0];
    arrival = item.Kind === 'Open' && item.Arrival ? distributionCode(item.Arrival) + (item.Batch && !(item.Batch.Kind === 'Fixed' && (item.Batch.Size ?? 1) === 1) ? '^X' : '') : item.Think ? distributionCode(item.Think) : 'G';
  } else if (!internal && external.length > 1 && external.every((item) => item.Kind === 'Open' && item.Arrival?.Kind === 'Exponential')) {
    arrival = 'M';
  }

  const services = model.Classes.map((item) => item.Services?.find((service) => service.Node === node.Id)?.Service ?? node.Service);
  const codes = new Set(services.map(distributionCode));
  const service = codes.size === 1 ? [...codes][0] : 'G';
  let text = `${arrival}/${service}/${node.Servers === 0 ? '∞' : node.Servers}`;
  if (isFiniteNumber(node.Capacity)) {
    text += `/${node.Capacity}`;
  }

  if (closed && closed.Population) {
    text += isFiniteNumber(node.Capacity) ? `/${closed.Population}` : `//${closed.Population}`;
  }

  if (node.Patience) {
    text += `+${distributionCode(node.Patience)}`;
  }

  return text;
}

function nextId(prefix: string, used: string[]): string {
  let index = used.length + 1;
  while (used.includes(`${prefix}${index}`)) {
    index += 1;
  }

  return `${prefix}${index}`;
}

export function createNode(model: QueueingModel): QueueingNode {
  const id = nextId('n', model.Nodes.map((node) => node.Id));
  return { Id: id, Name: `Узел ${model.Nodes.length + 1}`, Servers: 1, Capacity: null, Discipline: 'Fifo', Service: defaultDistribution('Exponential', 8), Routes: [] };
}

export function createClass(model: QueueingModel): CustomerClass {
  const id = nextId('c', model.Classes.map((item) => item.Id));
  return {
    Id: id,
    Name: `Класс ${model.Classes.length + 1}`,
    Kind: 'Open',
    Arrival: defaultDistribution('Exponential', 20),
    Priority: 0,
    Entry: model.Nodes[0]?.Id ?? '',
    Services: [],
  };
}

/** Removes the node with its routes, service overrides and class entries (classes move to the first remaining node). */
export function removeNode(model: QueueingModel, nodeId: string): QueueingModel {
  const nodes = model.Nodes.filter((node) => node.Id !== nodeId).map((node) => ({ ...node, Routes: node.Routes.filter((route) => route.Target !== nodeId) }));
  return {
    ...model,
    Nodes: nodes,
    Classes: model.Classes.map((item) => ({
      ...item,
      Entry: item.Entry === nodeId ? (nodes[0]?.Id ?? '') : item.Entry,
      Services: (item.Services ?? []).filter((service) => service.Node !== nodeId),
    })),
  };
}

export function updateNode(model: QueueingModel, nodeId: string, patch: Partial<QueueingNode>): QueueingModel {
  return { ...model, Nodes: model.Nodes.map((node) => (node.Id === nodeId ? { ...node, ...patch } : node)) };
}

export function updateClass(model: QueueingModel, classId: string, patch: Partial<CustomerClass>): QueueingModel {
  return { ...model, Classes: model.Classes.map((item) => (item.Id === classId ? { ...item, ...patch } : item)) };
}

/** Probability of leaving the system after the node. */
export function exitProbability(node: QueueingNode): number {
  return Math.max(0, 1 - node.Routes.filter((route) => route.Target).reduce((sum, route) => sum + (route.Probability || 0), 0));
}

export interface NetworkLayoutNode {
  id: string;
  name: string;
  x: number;
  y: number;
  column: number;
}

export interface NetworkLayoutEdge {
  from: string;
  /** null — the exit of the system. */
  to: string | null;
  probability: number;
  /** Edge to an earlier or the same column (feedback). */
  back: boolean;
}

export interface NetworkLayout {
  nodes: NetworkLayoutNode[];
  edges: NetworkLayoutEdge[];
  sources: { classId: string; name: string; entry: string; closed: boolean }[];
  width: number;
  height: number;
  columns: number;
}

export const LAYOUT = { nodeWidth: 150, nodeHeight: 58, columnGap: 70, rowGap: 26, margin: 24, sourceWidth: 118 };

/** Columns by the longest forward path from the entry nodes (feedback edges are ignored), rows in model order. */
export function networkLayout(model: QueueingModel): NetworkLayout {
  const ids = model.Nodes.map((node) => node.Id);
  const column = new Map<string, number>();
  const entries = [...new Set(model.Classes.map((item) => item.Entry).filter((id) => ids.includes(id)))];
  const queue = entries.length > 0 ? [...entries] : ids.slice(0, 1);
  queue.forEach((id) => column.set(id, 0));
  const order = new Map(ids.map((id, index) => [id, index]));
  for (let guard = 0; queue.length > 0 && guard < 10_000; guard += 1) {
    const id = queue.shift()!;
    const node = model.Nodes.find((item) => item.Id === id)!;
    for (const route of node.Routes) {
      if (!route.Target || route.Probability <= 0 || !ids.includes(route.Target)) {
        continue;
      }

      const forward = (order.get(route.Target) ?? 0) > (order.get(id) ?? 0);
      const next = (column.get(id) ?? 0) + 1;
      if (forward && (column.get(route.Target) ?? -1) < next) {
        column.set(route.Target, next);
        queue.push(route.Target);
      } else if (!column.has(route.Target)) {
        column.set(route.Target, next);
        queue.push(route.Target);
      }
    }
  }

  let unplaced = Math.max(0, ...column.values()) + 1;
  for (const id of ids) {
    if (!column.has(id)) {
      column.set(id, unplaced);
      unplaced += 1;
    }
  }

  const rowsByColumn = new Map<number, number>();
  const left = LAYOUT.margin + LAYOUT.sourceWidth + LAYOUT.columnGap;
  const nodes = model.Nodes.map<NetworkLayoutNode>((node) => {
    const c = column.get(node.Id) ?? 0;
    const row = rowsByColumn.get(c) ?? 0;
    rowsByColumn.set(c, row + 1);
    return {
      id: node.Id,
      name: node.Name || node.Id,
      column: c,
      x: left + c * (LAYOUT.nodeWidth + LAYOUT.columnGap),
      y: LAYOUT.margin + row * (LAYOUT.nodeHeight + LAYOUT.rowGap),
    };
  });

  const position = new Map(nodes.map((node) => [node.id, node]));
  const edges: NetworkLayoutEdge[] = [];
  for (const node of model.Nodes) {
    for (const route of node.Routes) {
      if (route.Target && route.Probability > 0 && position.has(route.Target)) {
        edges.push({ from: node.Id, to: route.Target, probability: route.Probability, back: (position.get(route.Target)!.column ?? 0) <= (position.get(node.Id)!.column ?? 0) });
      }
    }

    const exit = exitProbability(node);
    if (exit > 1e-9) {
      edges.push({ from: node.Id, to: null, probability: exit, back: false });
    }
  }

  const columns = Math.max(1, ...nodes.map((node) => node.column + 1));
  const rows = Math.max(1, ...rowsByColumn.values(), model.Classes.length);
  return {
    nodes,
    edges,
    sources: model.Classes.map((item) => ({ classId: item.Id, name: item.Name || item.Id, entry: item.Entry, closed: item.Kind === 'Closed' })),
    columns,
    width: left + columns * (LAYOUT.nodeWidth + LAYOUT.columnGap) + 60,
    height: LAYOUT.margin * 2 + rows * (LAYOUT.nodeHeight + LAYOUT.rowGap),
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Up to 4 significant digits with a decimal comma. */
export function formatNumber(value: number | null | undefined, digits = 4): string {
  if (!isFiniteNumber(value)) {
    return '—';
  }

  if (value === 0) {
    return '0';
  }

  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  const decimals = Math.min(6, Math.max(0, digits - 1 - magnitude));
  return Number(value.toFixed(decimals)).toLocaleString('ru-RU', { maximumFractionDigits: decimals, useGrouping: false });
}

export function formatMetric(key: string, value: number | null | undefined): string {
  if (!isFiniteNumber(value)) {
    return '—';
  }

  return PERCENT_METRICS.has(key) ? `${formatNumber(value * 100, 3)} %` : formatNumber(value);
}

export type ComparisonStatus = 'agree' | 'close' | 'differ' | 'simulation';

/** How the simulated value relates to theory: within the interval, within 10 %, further, or no theory. */
export function comparisonStatus(metric: MetricComparison): ComparisonStatus {
  if (!isFiniteNumber(metric.Analytic)) {
    return 'simulation';
  }

  if (metric.Agrees) {
    return 'agree';
  }

  return Math.abs(metric.Deviation ?? 1) <= 0.1 ? 'close' : 'differ';
}

/** Problems that the editor can show at once, before the server validates the description. */
export function quickChecks(model: QueueingModel): string[] {
  const problems: string[] = [];
  if (model.Nodes.length === 0) {
    problems.push('Добавьте хотя бы один узел обслуживания.');
  }

  if (model.Classes.length === 0) {
    problems.push('Добавьте хотя бы один класс заявок.');
  }

  for (const node of model.Nodes) {
    const total = node.Routes.filter((route) => route.Target).reduce((sum, route) => sum + (route.Probability || 0), 0);
    if (total > 1 + 1e-9) {
      problems.push(`Узел «${node.Name}»: сумма вероятностей переходов больше 1.`);
    }
  }

  return problems;
}

export const DEFAULT_QUEUEING_MODEL: QueueingModel = {
  Name: 'M/M/1',
  TimeUnit: 'мин',
  Duration: 100_000,
  WarmUp: 5_000,
  Replications: 5,
  Seed: 1,
  Classes: [{ Id: 'c1', Name: 'Заявки', Kind: 'Open', Arrival: { Kind: 'Exponential', Mean: 10 }, Priority: 0, Entry: 'n1', Services: [] }],
  Nodes: [{ Id: 'n1', Name: 'Касса', Servers: 1, Capacity: null, Discipline: 'Fifo', Service: { Kind: 'Exponential', Mean: 8 }, Routes: [] }],
};
