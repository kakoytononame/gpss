import { mockBackend, simulationResult } from '../../../test/fixtures';
import { resetStore, store } from '../../../test/store';

const CLASS_URL = '/api/alina-gpss/studio/tebs/libraries/0/classes/3ef71b95-07f7-41c6-b532-03d83d8a3973';

beforeEach(() => resetStore());

describe('loading', () => {
  it('loads the class from the API', async () => {
    mockBackend();
    await store().load();

    expect(store()).toMatchObject({ source: 'api', loadError: '', mode: 'class', historyIndex: 0 });
    expect(store().teb?.nameInModel).toBe('BI_U_3');
    expect(store().modelLogText).toContain('Проект "Блок-участок 2" открыт.');
  });

  it('loads the demo instance through its own class', async () => {
    const backend = mockBackend();
    await store().setMode('instance');

    expect(backend.requests[0].url).toBe(`${CLASS_URL}/instances/80ba15bc-7a4a-4b36-ba57-df2cab3b89ad`);
    expect(store().teb?.parameters[0].currentValue).toBe('6');
  });

  it('falls back to demo data when the API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await store().load();

    expect(store()).toMatchObject({ source: 'sample', syncStatus: 'offline' });
    expect(store().teb).not.toBeNull();
  });
});

describe('editing', () => {
  beforeEach(async () => {
    mockBackend();
    await store().load();
  });

  it('records edits in history and supports undo / redo', () => {
    store().updateGeneralField('header', 'Новый');
    expect(store().teb?.header).toBe('Новый');

    store().undo();
    expect(store().teb?.header).toBe('Блок-участок 2');
    store().redo();
    expect(store().teb?.header).toBe('Новый');
  });

  it('sends parameter changes by position', async () => {
    const backend = mockBackend();
    await store().addParameter();
    await store().moveParameter(2, 'up');
    await store().removeParameter(0);

    expect(backend.mutations().map((request) => `${request.method} ${request.url.replace(CLASS_URL, '')}`)).toEqual([
      'POST /parameters',
      'POST /parameters/2/move',
      'DELETE /parameters/0',
    ]);
    expect(store().teb?.parameters).toHaveLength(2);
    expect(store().syncStatus).toBe('saved');
  });

  it('ignores out-of-range row operations', async () => {
    const backend = mockBackend();
    await store().removeParameter(10);
    await store().removeCollectionRow('states', 5);
    await store().moveCollectionRow('inputs', 3, 'down');

    expect(backend.mutations()).toHaveLength(0);
  });

  it('syncs whole collections after structural changes and single rows after edits', async () => {
    const backend = mockBackend();
    await store().addCollectionRow('states');
    store().updateCollectionField('states', 0, 'expression', 'F$X = 0');
    await store().commitCollectionField('states', 0);

    const [add, edit] = backend.mutations();
    expect(add.body).toMatchObject({ path: 'states' });
    expect((add.body as { value: unknown[] }).value).toHaveLength(2);
    expect(edit.body).toMatchObject({ path: 'states[0]', value: { expression: 'F$X = 0' } });
  });

  it('reports server errors as offline and keeps the local change', async () => {
    mockBackend(() => ({ status: 500, body: { title: 'Unexpected server error' } }));
    store().updateGeneralField('description', 'Локально');
    await store().commitGeneralField('description');

    expect(store()).toMatchObject({ syncStatus: 'offline' });
    expect(store().syncMessage).toContain('HTTP 500');
    expect(store().teb?.description).toBe('Локально');
  });

  it('flags model validation problems as warnings, not errors', () => {
    store().updateGpssModelText('');
    store().validateModel();
    expect(store().syncStatus).toBe('warning');
  });
});

describe('workspace persistence', () => {
  it('saves to local storage and the server', async () => {
    const backend = mockBackend();
    await store().load();
    await store().saveWorkspaceSnapshot();

    const put = backend.mutations().find((request) => request.url.endsWith('/workspace'));
    expect(put?.body).toMatchObject({ snapshot: { activeTab: 'general', teb: { nameInModel: 'BI_U_3' } } });
    expect(localStorage.getItem('gpss.teb-editor.workspace')).not.toBeNull();
  });

  it('restores the layout but keeps the server document authoritative', async () => {
    mockBackend((request) =>
      request.url.endsWith('/workspace') && request.method === 'GET'
        ? {
            status: 200,
            body: {
              Snapshot: {
                teb: { header: 'Старая копия' },
                activeTab: 'states',
                activeDocument: 'scheme',
                modelFontSize: 18,
                explorerVisible: true,
                modelText: 'GENERATE 5',
              },
            },
          }
        : undefined,
    );
    await store().load();
    await store().loadWorkspaceSnapshot();

    expect(store()).toMatchObject({ activeTab: 'states', activeDocument: 'scheme', modelFontSize: 18, modelText: 'GENERATE 5' });
    expect(store().teb?.header).toBe('Блок-участок 2');
  });

  it('does not report a missing snapshot on start-up', async () => {
    mockBackend();
    await store().load();
    await store().loadWorkspaceSnapshot({ quiet: true });

    expect(store().syncStatus).not.toBe('offline');
    expect(store().syncMessage).toBe('Данные загружены с локального API.');
  });
});

describe('simulation', () => {
  beforeEach(() => resetStore({ modelText: '  GENERATE 10\n  TERMINATE 1\n  START 1' }));

  it('runs the model, stores the report and opens it', async () => {
    const backend = mockBackend();
    await store().startSimulation();

    expect(backend.requests[0]).toMatchObject({ method: 'POST', url: '/api/alina-gpss/studio/simulation/sessions' });
    expect(store()).toMatchObject({ simulationState: 'completed', simulationSessionId: 'session-1', activeDocument: 'std-report', simulationBusy: false });
    expect(store().simulationReport?.EndTime).toBe(1440);
    expect(store().modelLogText).toMatch(/\[\d\d:\d\d:\d\d\] Моделирование завершено/);
    expect(store().issues[0]).toMatchObject({ id: 'sim-completed', type: 'info' });
    expect(store().issues.some((issue) => issue.id === 'issue-no-errors')).toBe(false);
  });

  it('starts models without a START statement with START 1', async () => {
    const backend = mockBackend((request) =>
      request.url.endsWith('/sessions') ? { status: 200, body: simulationResult({ State: 'idle', Report: null }) } : undefined,
    );
    await store().startSimulation();

    expect(backend.requests.map((request) => request.body)).toContainEqual({ command: 'START 1' });
    expect(store().simulationState).toBe('completed');
  });

  it('turns translation errors into issues pointing at the model text', async () => {
    mockBackend(() => ({
      status: 200,
      body: simulationResult({ SessionId: null, Success: false, State: 'error', Report: null, Errors: [{ Line: 3, Message: 'Метка "X" не определена.' }] }),
    }));
    await store().startSimulation();

    expect(store()).toMatchObject({ simulationState: 'error', activeDocument: 'model-text', issuesPanelVisible: true, syncStatus: 'warning' });
    expect(store().issues[0]).toMatchObject({ type: 'error', description: 'Строка 3: Метка "X" не определена.', documentId: 'model-text' });
  });

  it('re-creates an expired session before executing a command', async () => {
    let expired = true;
    const backend = mockBackend((request) => {
      if (request.url.includes('/commands') && expired) {
        expired = false;
        return { status: 404, body: { title: 'Resource not found' } };
      }

      return undefined;
    });
    resetStore({ modelText: 'GENERATE 1', simulationSessionId: 'old' });
    await store().executeSimulationCommand('SHOW AC1');

    expect(backend.requests.map((request) => request.url.split('/simulation/')[1])).toEqual([
      'sessions/old/commands',
      'sessions',
      'sessions/session-1/commands',
    ]);
    expect(store().modelLogText).toContain('> SHOW AC1');
  });

  it('does not call the server for an empty model', async () => {
    const backend = mockBackend();
    resetStore({ modelText: '   ' });
    await store().startSimulation();

    expect(backend.requests).toHaveLength(0);
    expect(store()).toMatchObject({ syncStatus: 'warning', activeDocument: 'model-text' });
  });

  it('marks the simulator as offline when the server is down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await store().startSimulation();

    expect(store()).toMatchObject({ simulationState: 'error', syncStatus: 'offline', simulationBusy: false });
  });

  it('maps ribbon commands to GPSS statements', async () => {
    const backend = mockBackend();
    resetStore({ modelText: 'GENERATE 1', simulationSessionId: 'session-1' });
    await store().runSimulationCommand('step');
    await store().runSimulationCommand('reset');
    await store().runSimulationCommand('custom');

    expect(backend.requests.map((request) => request.body)).toEqual([{ command: 'STEP 1' }, { command: 'RESET' }]);
    expect(store()).toMatchObject({ activeDocument: 'model-log', commandLineFocusRequest: 1 });
  });

  it('loads the example model only when the project has none', async () => {
    mockBackend();
    resetStore({ modelText: '' });
    await store().loadExampleModel();
    expect(store().modelText).toContain('GENERATE 10');

    resetStore({ modelText: 'мой текст' });
    await store().loadExampleModel();
    expect(store().modelText).toBe('мой текст');
  });

  it('forgets the session when the model text changes', () => {
    resetStore({ simulationSessionId: 'session-1' });
    store().setModelText('GENERATE 2');
    expect(store().simulationSessionId).toBeNull();
  });
});

describe('mutation ordering', () => {
  it('sends a row edit only after the row was added on the server', async () => {
    const order: string[] = [];
    let releaseAdd: () => void = () => undefined;
    mockBackend();
    await store().load();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init: RequestInit = {}) => {
        const body = JSON.parse(String(init.body)) as { path: string };
        if (body.path === 'states') {
          await new Promise<void>((resolve) => (releaseAdd = resolve));
        }

        order.push(body.path);
        return new Response('{}', { status: 200 });
      }),
    );

    const add = store().addCollectionRow('states');
    store().updateCollectionField('states', 1, 'name', 'NEW');
    const edit = store().commitCollectionField('states', 1);
    await Promise.resolve();
    releaseAdd();
    await Promise.all([add, edit]);

    expect(order).toEqual(['states', 'states[1]']);
  });
});

describe('debugger', () => {
  beforeEach(() => resetStore({ modelText: '  GENERATE 10\n  SEIZE F\n  TERMINATE 1\n  START 1' }));

  const stopped = () =>
    simulationResult({
      State: 'paused',
      StopReason: 'Останов: транзакт 1 перед входом в блок 2 SEIZE. Время 10.000.',
      BlockLines: [1, 2, 3],
      Breakpoints: [{ Transaction: 0, Block: 2, Line: 2 }],
      Transactions: [
        { Number: 1, Priority: 0, AssemblySet: 1, CurrentBlock: 1, NextBlock: 2, Chain: 'Текущих событий', MoveTime: null, TransitTime: 0, Parameters: {} },
      ],
    });

  it('sends breakpoint lines with a new session and shows the model state', async () => {
    const backend = mockBackend((request) => (request.url.endsWith('/sessions') ? { status: 200, body: stopped() } : undefined));
    await store().toggleBreakpoint(2);
    await store().startSimulation();

    expect(backend.requests[0].body).toMatchObject({ BreakpointLines: [2] });
    expect(store().modelState).toMatchObject({ clock: 1440, blockLines: [1, 2, 3], stopReason: expect.stringContaining('блок 2') });
    expect(store().syncMessage).toContain('Останов');
  });

  it('sends STOP commands to a running session and refuses lines without blocks', async () => {
    const backend = mockBackend((request) => (request.url.endsWith('/sessions') ? { status: 200, body: stopped() } : undefined));
    await store().startSimulation();

    await store().toggleBreakpoint(3);
    expect(backend.requests.at(-1)?.body).toEqual({ command: 'STOP ,3' });
    await store().toggleBreakpoint(3);
    expect(backend.requests.at(-1)?.body).toEqual({ command: 'STOP ,3,OFF' });

    await store().toggleBreakpoint(4);
    expect(store().syncStatus).toBe('warning');
    expect(store().breakpointLines).toEqual([]);
  });
});
