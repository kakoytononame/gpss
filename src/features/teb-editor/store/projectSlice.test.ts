import { mockBackend, studioProject } from '../../../test/fixtures';
import { resetStore, store } from '../../../test/store';

const PROJECTS = '/api/alina-gpss/studio/projects';

function projectBackend(generation = { Text: '* модель\n GENERATE 5\n', Messages: [], GeneratedLines: 3, Success: true }) {
  return mockBackend((request) => {
    if (request.url === `${PROJECTS}/project-1` && request.method === 'GET') {
      return { status: 200, body: studioProject() };
    }

    if (request.url === `${PROJECTS}/generate`) {
      return { status: 200, body: generation };
    }

    if (request.url === PROJECTS && request.method === 'GET') {
      return { status: 200, body: [{ Id: 'project-1', Name: 'Мастерская', ModelCount: 1, UpdatedAt: '2026-10-01T10:00:00Z' }] };
    }

    if (request.url === `${PROJECTS}/project-1` && request.method === 'PUT') {
      return { status: 200, body: request.body };
    }

    return undefined;
  });
}

beforeEach(() => resetStore());

describe('projects', () => {
  it('opens a project: root scheme, saved model text and the scheme document', async () => {
    projectBackend();
    await store().openProject('project-1');

    expect(store()).toMatchObject({ projectModelIndex: 0, schemePath: [], projectDirty: false, activeDocument: 'scheme' });
    expect(store().schemeNodes.map((node) => node.id)).toEqual(['teb1', 'teb2', 'data']);
    expect(store().modelText).toContain('сохранённый текст');
  });

  it('navigates into composite TEBs and back', async () => {
    projectBackend();
    await store().openProject('project-1');

    store().openSchemeNode('teb2');
    expect(store().schemePath).toEqual(['teb2']);
    expect(store().schemeNodes.map((node) => node.id)).toEqual(['teb3']);

    store().leaveToSchemeLevel(0);
    expect(store().schemePath).toEqual([]);
  });

  it('writes scheme edits into the project and saves it', async () => {
    const backend = projectBackend();
    await store().openProject('project-1');
    store().setSchemeNodes((nodes) => nodes.map((node) => (node.id === 'teb1' ? { ...node, x: 33 } : node)));

    await store().saveProject();

    const put = backend.requests.find((request) => request.method === 'PUT');
    expect(put?.url).toBe(`${PROJECTS}/project-1`);
    expect((put?.body as { Models: { Scheme: { Nodes: { X: number }[] } }[] }).Models[0].Scheme.Nodes[0].X).toBe(33);
    expect(store().projectDirty).toBe(false);
  });

  it('edits a project TEB in the TEB editor without calling the TEB API', async () => {
    const backend = projectBackend();
    await store().openProject('project-1');
    store().openSchemeNode('teb1');
    expect(store()).toMatchObject({ source: 'project', activeDocument: 'editor', editingNodeId: 'teb1' });

    store().updateGeneralField('header', 'Заявки');
    await store().commitGeneralField('header');

    expect(backend.mutations()).toEqual([]);
    expect(store().project?.Models[0].Scheme?.Nodes[0].Header).toBe('Заявки');
    expect(store().schemeNodes[0].label).toBe('Заявки');
    expect(store().projectDirty).toBe(true);
  });

  it('generates the model text and reports generator messages as issues', async () => {
    const backend = projectBackend({
      Text: '* модель\n',
      Messages: [{ Severity: 'error', Message: 'Метка входа не найдена.', NodeId: 'teb3', Teb: 'Станок' }],
      GeneratedLines: 1,
      Success: false,
    } as never);
    await store().openProject('project-1');

    await store().generateModelText();

    expect(backend.requests.find((request) => request.url.endsWith('/generate'))?.body).toMatchObject({ ModelName: 'Модель 1' });
    expect(store().modelText).toBe('* модель\n');
    expect(store().issues.find((issue) => issue.id === 'gen-0')).toMatchObject({ type: 'error', instance: 'Станок', sourceNodeId: 'teb3' });
    expect(store().issuesPanelVisible).toBe(true);
    expect(store().activeDocument).toBe('scheme');
  });

  it('switches to the model text after a successful generation', async () => {
    projectBackend();
    await store().openProject('project-1');
    await store().generateModelText();

    expect(store()).toMatchObject({ activeDocument: 'model-text', modelText: '* модель\n GENERATE 5\n' });
    expect(store().syncMessage).toMatch(/из них автоматически 3/);
  });

  it('reports server failures instead of throwing', async () => {
    mockBackend(() => ({ status: 400, body: { detail: 'Не удалось прочитать проект: архив повреждён' } }));
    await store().importProject(new File(['x'], 'broken.zip'));

    expect(store()).toMatchObject({ projectBusy: false, syncStatus: 'offline' });
    expect(store().syncMessage).toContain('архив повреждён');
  });
});
