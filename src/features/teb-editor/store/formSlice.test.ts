import { mockBackend, simulationResult, studioProjectWithForm } from '../../../test/fixtures';
import { resetStore, store } from '../../../test/store';

const PROJECTS = '/api/alina-gpss/studio/projects';

function formBackend() {
  return mockBackend((request) => {
    if (request.url === `${PROJECTS}/project-1` && request.method === 'GET') {
      return { status: 200, body: studioProjectWithForm() };
    }

    if (request.url === `${PROJECTS}/forms/apply`) {
      const body = request.body as { ModelText: string; Inputs: Array<{ Operands: Array<{ Value: string }> }> };
      return { status: 200, body: { Text: body.ModelText.replace('X$Gap,26', `X$Gap,${body.Inputs[1].Operands[0].Value}`), Messages: [] } };
    }

    if (request.url.endsWith('/evaluate')) {
      return { status: 200, body: [3, 0.5] };
    }

    if (request.url.endsWith('/simulation/sessions')) {
      return { status: 200, body: simulationResult({ SessionId: 'session-1', State: 'idle' }) };
    }

    return undefined;
  });
}

beforeEach(() => resetStore());

describe('user forms', () => {
  it('edits input data and writes it into the model text', async () => {
    const backend = formBackend();
    await store().openProject('project-1');
    store().openForm(0, 'input-form');
    expect(store().activeDocument).toBe('input-form');

    store().setFormInputValue(1, 'B', '35');
    expect(store().projectDirty).toBe(true);
    expect(await store().applyFormToModel()).toBe(true);

    expect(store().modelText).toContain('INITIAL X$Gap,35');
    expect(store().simulationStartCount).toBe(50);
    expect(store().simulationMonitoring?.monitors.map((monitor) => monitor.Expression)).toEqual(['S$Berth']);
    const apply = backend.requests.find((request) => request.url.endsWith('/forms/apply'));
    expect(apply?.body).toMatchObject({ ModelText: expect.stringContaining('Berth EQU 1') });
  });

  it('runs the form with its START count and monitors, then shows the dynamic form', async () => {
    const backend = formBackend();
    await store().openProject('project-1');
    store().openForm(0, 'input-form');

    await store().runForm();

    const session = backend.requests.find((request) => request.url.endsWith('/simulation/sessions'));
    expect(session?.body).toMatchObject({ Monitors: [{ Expression: 'S$Berth' }], MonitorInterval: 60 });
    const start = backend.requests.find((request) => request.url.endsWith('/commands'));
    expect(start?.body).toEqual({ command: 'START 50' });
    expect(store().activeDocument).toBe('dynamic-form');
    expect(store().formIndicatorValues).toEqual({ 10: 3, 15: 0.5 });
  });

  it('fills the experiment plan from the form', async () => {
    formBackend();
    await store().openProject('project-1');
    store().openForm(0, 'input-form');

    await store().planExperimentFromForm();

    expect(store().activeDocument).toBe('experiments');
    expect(store().experimentPlan.factors).toEqual([{ name: 'Интервал', kind: 'Operand', levels: '20..24 шаг 2', line: 2, operand: 'B' }]);
    expect(store().experimentPlan.startCount).toBe(50);
  });
});
