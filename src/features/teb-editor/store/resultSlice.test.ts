import type { ExperimentResult } from '../../../shared/types/experiment';
import { mockBackend, simulationResult, studioProjectWithForm } from '../../../test/fixtures';
import { resetStore, store } from '../../../test/store';

const PROJECTS = '/api/alina-gpss/studio/projects';
const RESULTS = '/api/alina-gpss/studio/results';

const EXPERIMENT: ExperimentResult = {
  FactorNames: ['Gap'],
  IndicatorNames: ['QA$Q'],
  Points: [
    { Index: 0, Factors: [20], Indicators: [{ Mean: 1.5, StandardDeviation: 0.1, ConfidenceHalfWidth: 0.2, Min: 1.4, Max: 1.6, Count: 2 }], Failed: 0 },
    { Index: 1, Factors: [30], Indicators: [{ Mean: 0.5, StandardDeviation: 0.1, ConfidenceHalfWidth: 0.2, Min: 0.4, Max: 0.6, Count: 2 }], Failed: 0 },
  ],
  Runs: [],
  BestPoint: 1,
  ElapsedSeconds: 0.4,
  Messages: [],
};

function resultsBackend() {
  return mockBackend((request) => {
    if (request.url === `${PROJECTS}/project-1` && request.method === 'GET') {
      return { status: 200, body: studioProjectWithForm() };
    }

    if (request.url === `${PROJECTS}/forms/apply`) {
      return { status: 200, body: { Text: (request.body as { ModelText: string }).ModelText, Messages: [] } };
    }

    if (request.url.endsWith('/simulation/sessions')) {
      return { status: 200, body: simulationResult({ SessionId: 'session-1', State: 'idle' }) };
    }

    if (request.url.endsWith('/evaluate')) {
      return { status: 200, body: [1, 0.5] };
    }

    if (request.url.endsWith('/studio/experiments')) {
      return { status: 200, body: EXPERIMENT };
    }

    return undefined;
  });
}

const created = (backend: ReturnType<typeof mockBackend>) =>
  backend.requests.filter((request) => request.url === RESULTS && request.method === 'POST').map((request) => request.body as Record<string, unknown>);

beforeEach(() => resetStore());

describe('simulation results', () => {
  it('loads the result tree of the opened project', async () => {
    const backend = resultsBackend();
    await store().openProject('project-1');
    await vi.waitFor(() => expect(backend.requests.some((request) => request.url === `${RESULTS}?projectId=project-1`)).toBe(true));
    expect(store().simulationResults).toEqual([]);
  });

  it('saves a single experiment with the form input data after a form run', async () => {
    const backend = resultsBackend();
    await store().openProject('project-1');
    store().openForm(0, 'input-form');

    await store().runForm();

    const [saved] = created(backend);
    expect(saved).toMatchObject({
      ProjectId: 'project-1',
      Kind: 'single',
      Name: expect.stringMatching(/^Эксперимент «Порт» от \d\d\.\d\d\.\d{4} \d\d:\d\d$/),
      Payload: {
        ModelName: 'Модель 1',
        FormName: 'Порт',
        StartCount: 50,
        Inputs: [
          { Input: 'Berth', Name: 'Операнд A', Operand: 'A', Value: '1' },
          { Input: '(2) INITIAL', Name: 'Интервал', Operand: 'B', Value: '30' },
        ],
        Report: { EndTime: 1440 },
      },
    });
    expect(store().simulationResults.map((result) => result.Kind)).toEqual(['single']);
    expect(store().syncMessage).toContain('сохранён');
  });

  it('saves a series with its plan after an experiment', async () => {
    const backend = resultsBackend();
    await store().openProject('project-1');
    store().setExperimentPlan(() => ({
      factors: [{ name: 'Gap', kind: 'Savevalue', levels: '20; 30' }],
      indicators: [{ expression: 'QA$Q', label: '' }],
      replications: 2,
    }));

    await store().runExperiment();

    const [saved] = created(backend);
    expect(saved).toMatchObject({
      Kind: 'series',
      Payload: {
        Factors: [{ Name: 'Gap', Kind: 'Savevalue', Levels: [20, 30] }],
        Indicators: [{ Expression: 'QA$Q', Label: null }],
        Replications: 2,
        Result: { BestPoint: 1 },
      },
    });
    expect(store().syncMessage).toMatch(/^Серия выполнена.*сохранён\.$/);
  });

  it('opens, renames and deletes a saved result', async () => {
    resultsBackend();
    await store().openProject('project-1');
    store().openForm(0, 'input-form');
    await store().runForm();
    const [{ Id: id }] = store().simulationResults;

    await store().openResult(id);
    expect(store().activeDocument).toBe('results');
    expect(store().selectedResult?.Kind).toBe('single');

    await store().renameResult(id, '  Базовый вариант ');
    expect(store().simulationResults[0].Name).toBe('Базовый вариант');
    expect(store().selectedResult?.Name).toBe('Базовый вариант');

    await store().deleteResult(id);
    expect(store().simulationResults).toEqual([]);
    expect(store().selectedResult).toBeNull();
  });

  it('forgets the results when the project is closed', async () => {
    resultsBackend();
    await store().openProject('project-1');
    store().openForm(0, 'input-form');
    await store().runForm();

    store().closeProject();

    expect(store().simulationResults).toEqual([]);
  });

  it('saves a run without a form on request and replaces the status message', async () => {
    const backend = mockBackend();
    withReport();
    store().setStatusMessage('Открыт документ: результаты моделирования.', 'saved');

    await store().saveSimulationResult();

    const [saved] = created(backend);
    expect(saved).toMatchObject({ ProjectId: null, Kind: 'single', Payload: { FormName: null, Inputs: [], StartCount: null } });
    expect(store().syncMessage).toMatch(/^Результат «Эксперимент от .*» сохранён\.$/);
  });

  it('reports a failed save without losing the run', async () => {
    mockBackend((request) => (request.url === RESULTS && request.method === 'POST' ? { status: 500, body: { detail: 'Нет связи с базой' } } : undefined));
    withReport();

    await store().saveSimulationResult();

    expect(store().syncStatus).toBe('warning');
    expect(store().syncMessage).toContain('Результат моделирования не сохранён');
    expect(store().simulationReport).not.toBeNull();
  });
});

function withReport() {
  resetStore({ simulationReport: simulationResult().Report, modelText: '  GENERATE 10\n  TERMINATE 1' });
}
