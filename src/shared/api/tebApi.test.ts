import { mockBackend } from '../../test/fixtures';
import { createSimulationApi } from './simulationApi';
import { createTebApi, DEFAULT_EDITOR_QUERY, readEditorQueryFromUrl, TebApiError } from './tebApi';

const CLASS_URL = '/api/alina-gpss/studio/tebs/libraries/0/classes/3ef71b95-07f7-41c6-b532-03d83d8a3973';

describe('readEditorQueryFromUrl', () => {
  it('uses the demo class for both class and instance by default', () => {
    const query = readEditorQueryFromUrl('');
    expect(query.mode).toBe('class');
    expect(query.instanceClassId).toBe(query.classId);
  });

  it('reads overrides from the query string', () => {
    const query = readEditorQueryFromUrl('?mode=instance&classId=abc&instanceId=i1&libraryId=7');
    expect(query).toMatchObject({ mode: 'instance', classId: 'abc', instanceClassId: 'abc', instanceId: 'i1', libraryId: '7' });
  });
});

describe('createTebApi', () => {
  const api = () => createTebApi(DEFAULT_EDITOR_QUERY);

  it('addresses parameters by index with the right verbs', async () => {
    const backend = mockBackend();

    await api().updateParameter(1, { id: 'x' } as never);
    await api().moveParameter(0, 'down');
    await api().deleteParameter(2);
    await api().updateClassProperty('states[0]', { name: 'A' });
    await api().setParameterValue(0, 5);

    expect(backend.requests.map((request) => `${request.method} ${request.url}`)).toEqual([
      `PATCH ${CLASS_URL}/parameters/1`,
      `POST ${CLASS_URL}/parameters/0/move`,
      `DELETE ${CLASS_URL}/parameters/2`,
      `PATCH ${CLASS_URL}/properties`,
      `PUT ${CLASS_URL}/instances/80ba15bc-7a4a-4b36-ba57-df2cab3b89ad/parameters/0/value`,
    ]);
    expect(backend.requests[1].body).toEqual({ direction: 'down' });
    expect(backend.requests[3].body).toEqual({ path: 'states[0]', value: { name: 'A' } });
  });

  it('returns null for a missing workspace and unwraps saved snapshots', async () => {
    mockBackend();
    await expect(api().getWorkspaceSnapshot()).resolves.toBeNull();

    mockBackend(() => ({ status: 200, body: { Snapshot: { activeTab: 'states' } } }));
    await expect(api().getWorkspaceSnapshot()).resolves.toEqual({ activeTab: 'states' });
  });

  it('raises ApiError with the problem-details message', async () => {
    mockBackend(() => ({ status: 400, body: { title: 'Invalid request', detail: 'Unsupported property path: x' } }));

    const error = await api()
      .updateClassProperty('x', 1)
      .catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(TebApiError);
    expect(error).toMatchObject({ status: 400, message: 'Unsupported property path: x' });
  });
});

describe('createSimulationApi', () => {
  it('posts models and commands to the simulation endpoints', async () => {
    const backend = mockBackend();
    const api = createSimulationApi('');

    await api.createSession('GENERATE 1', 'Модель');
    await api.execute('abc', 'START 1');
    await api.translate('GENERATE 1');

    expect(backend.requests.map((request) => request.url)).toEqual([
      '/api/alina-gpss/studio/simulation/sessions',
      '/api/alina-gpss/studio/simulation/sessions/abc/commands',
      '/api/alina-gpss/studio/simulation/translate',
    ]);
    expect(backend.requests[0].body).toEqual({ text: 'GENERATE 1', modelName: 'Модель' });
    expect(backend.requests[1].body).toEqual({ command: 'START 1' });
  });
});
