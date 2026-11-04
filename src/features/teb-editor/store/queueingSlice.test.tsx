import { render, screen, waitFor } from '@testing-library/react';
import type { QueueingAnalysis, QueueingModel, QueueingRunResult } from '../../../shared/types/queueing';
import { mockBackend } from '../../../test/fixtures';
import { resetStore, store } from '../../../test/store';
import {
  DEFAULT_QUEUEING_MODEL,
  comparisonStatus,
  createNode,
  distributionLabel,
  formatMetric,
  kendallPreview,
  networkLayout,
  removeNode,
} from '../model/queueing';
import { QueueingDocument } from '../ui/QueueingDocument/QueueingDocument';

const BASE = '/api/alina-gpss/studio/queueing';

const ANALYSIS: QueueingAnalysis = {
  Network: 'одиночная СМО',
  Messages: [],
  Nodes: [
    {
      NodeId: 'n1',
      Name: 'Касса',
      Kendall: 'M/M/1',
      Discipline: 'FIFO',
      Quality: 'Exact',
      Method: 'M/M/1: L = ρ/(1−ρ)',
      Notes: [],
      Metrics: { ArrivalRate: 0.1, Utilization: 0.8, L: 4, Lq: 3.2, W: 40, Wq: 32 },
    },
  ],
  Classes: [{ ClassId: 'c1', Name: 'Заявки', Quality: 'Exact', Throughput: 0.1, ResponseTime: 40, InSystem: 4, LossProbability: 0 }],
};

const RUN: QueueingRunResult = {
  ModelText: ' GENERATE 10',
  Analysis: ANALYSIS,
  Replications: 5,
  ElapsedSeconds: 0.4,
  Messages: [],
  Nodes: [
    {
      NodeId: 'n1',
      Name: 'Касса',
      GpssName: 'Node1',
      Analysis: ANALYSIS.Nodes[0],
      Metrics: [{ Key: 'L', Label: 'Среднее число заявок в узле L', Analytic: 4, Mean: 4.1, HalfWidth: 0.3, Deviation: 0.025, Agrees: true }],
    },
  ],
  Classes: [{ ClassId: 'c1', Name: 'Заявки', Quality: 'Exact', Metrics: [] }],
};

function queueingBackend() {
  return mockBackend((request) => {
    if (request.url === `${BASE}/presets`) {
      return { status: 200, body: [{ Id: 'mm1', Group: 'Классические системы', Title: 'M/M/1 — касса', Description: 'Описание', Model: DEFAULT_QUEUEING_MODEL }] };
    }

    if (request.url === `${BASE}/validate`) {
      return { status: 200, body: [] };
    }

    if (request.url === `${BASE}/analyze`) {
      return { status: 200, body: ANALYSIS };
    }

    if (request.url === `${BASE}/simulate`) {
      return { status: 200, body: RUN };
    }

    if (request.url.endsWith('/analysis/queueing')) {
      return {
        status: 200,
        body: { Findings: [{ Severity: 'Warning', NodeId: 'n1', Title: '«Касса» — узкое место', Text: 'Загрузка 80 %.' }], Explanation: 'Пояснение модели', Provider: 'локальная модель', ModelName: 'qwen2.5:3b', Error: null },
      };
    }

    if (request.url === `${BASE}/generate`) {
      return { status: 200, body: { Text: '; Модель СМО\n GENERATE 10', Warnings: [] } };
    }

    return undefined;
  });
}

beforeEach(() => {
  localStorage.clear();
  resetStore({ queueingModel: DEFAULT_QUEUEING_MODEL });
});

describe('queueing model helpers', () => {
  const tandem: QueueingModel = {
    ...DEFAULT_QUEUEING_MODEL,
    Nodes: [
      { ...DEFAULT_QUEUEING_MODEL.Nodes[0], Routes: [{ Target: 'n2', Probability: 1 }] },
      { Id: 'n2', Name: 'Выдача', Servers: 2, Capacity: 5, Discipline: 'Fifo', Service: { Kind: 'Erlang', Mean: 9, Shape: 3 }, Routes: [{ Target: 'n1', Probability: 0.2 }] },
    ],
  };

  it('describes distributions and Kendall notation', () => {
    expect(distributionLabel({ Kind: 'Uniform', Min: 4, Max: 16 })).toBe('U [4; 16]');
    expect(kendallPreview(tandem, tandem.Nodes[0])).toBe('G/M/1'); // feedback merges into the stream
    expect(kendallPreview(DEFAULT_QUEUEING_MODEL, DEFAULT_QUEUEING_MODEL.Nodes[0])).toBe('M/M/1');
    expect(kendallPreview(tandem, tandem.Nodes[1])).toBe('G/E3/2/5');
  });

  it('lays out forward routes in columns and marks feedback', () => {
    const layout = networkLayout(tandem);
    expect(layout.nodes.map((node) => node.column)).toEqual([0, 1]);
    expect(layout.edges).toContainEqual({ from: 'n2', to: 'n1', probability: 0.2, back: true });
    expect(layout.edges).toContainEqual(expect.objectContaining({ from: 'n2', to: null }));
  });

  it('removes a node with its routes and moves class entries', () => {
    const model = removeNode(tandem, 'n1');
    expect(model.Nodes).toHaveLength(1);
    expect(model.Nodes[0].Routes).toEqual([]);
    expect(model.Classes[0].Entry).toBe('n2');
    expect(createNode(model).Id).toBe('n3');
  });

  it('formats measures and comparisons', () => {
    expect(formatMetric('Utilization', 0.8)).toBe('80 %');
    expect(formatMetric('W', 40.123456)).toBe('40,12');
    expect(comparisonStatus({ Key: 'L', Label: '', Analytic: 4, Mean: 4.2, Agrees: false, Deviation: 0.05 })).toBe('close');
    expect(comparisonStatus({ Key: 'L', Label: '', Mean: 4.2 })).toBe('simulation');
  });
});

describe('queueing slice and document', () => {
  it('analyzes the description, simulates and opens the GPSS model', async () => {
    const backend = queueingBackend();
    await store().analyzeQueueing();
    expect(store().queueingAnalysis?.Nodes[0].Kendall).toBe('M/M/1');

    await store().simulateQueueing();
    expect(store().queueingRun?.Replications).toBe(5);
    store().setQueueingModel((model) => ({ ...model, Duration: 50_000 }));
    expect(store().queueingRunStale).toBe(true);
    expect(JSON.parse(localStorage.getItem('gpss.queueing.model')!).Duration).toBe(50_000);

    await store().openQueueingModelText();
    expect(store().activeDocument).toBe('model-text');
    expect(store().modelText).toContain('Модель СМО');
    expect(backend.requests.some((request) => request.url === `${BASE}/simulate` && (request.body as QueueingModel).Nodes.length === 1)).toBe(true);
  });

  it('requests the analysis of the last run and shows the findings', async () => {
    const backend = queueingBackend();
    await store().simulateQueueing();
    await store().explainQueueingResults();
    expect(store().queueingInsights?.Explanation).toBe('Пояснение модели');
    const request = backend.requests.find((item) => item.url.endsWith('/analysis/queueing'))!;
    expect((request.body as { Run: QueueingRunResult | null }).Run?.Replications).toBe(5);

    render(<QueueingDocument />);
    expect(screen.getByText('«Касса» — узкое место.')).toBeInTheDocument();
    expect(screen.getByText('Пояснение модели')).toBeInTheDocument();
  });

  it('shows validation problems instead of results', async () => {
    mockBackend((request) => (request.url === `${BASE}/validate` ? { status: 200, body: ['Узел «Касса»: время обслуживания: среднее должно быть положительным.'] } : undefined));
    await store().analyzeQueueing();
    expect(store().queueingErrors).toHaveLength(1);
    expect(store().queueingAnalysis).toBeNull();
  });

  it('renders the editor, the network and the theory', async () => {
    queueingBackend();
    render(<QueueingDocument />);
    expect(screen.getByRole('img', { name: 'Схема системы массового обслуживания' })).toBeInTheDocument();
    expect(screen.getByLabelText('Узел Касса', { selector: 'article' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('точное решение', { selector: '.queueing-badge' }).length).toBeGreaterThan(0));
    expect(screen.getByRole('option', { name: 'M/M/1 — касса' })).toBeInTheDocument();
  });
});
