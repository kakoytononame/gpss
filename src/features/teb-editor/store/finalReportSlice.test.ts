import { mockBackend, studioProject } from '../../../test/fixtures';
import { resetStore, store } from '../../../test/store';

const PROJECTS = '/api/alina-gpss/studio/projects';

function captureDownloads() {
  const blobs: Blob[] = [];
  const names: string[] = [];
  vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn((blob: Blob) => (blobs.push(blob), 'blob:report')), revokeObjectURL: vi.fn() });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    names.push(this.download);
  });
  return { blobs, names, restore: () => click.mockRestore() };
}

beforeEach(() => resetStore());
afterEach(() => vi.unstubAllGlobals());

describe('final report', () => {
  it('asks for a project before collecting fragments', () => {
    store().addReportFragments([{ Kind: 'text', Title: '', Text: 'x' }]);

    expect(store().syncStatus).toBe('warning');
    expect(store().syncMessage).toContain('откройте или создайте проект');
  });

  it('collects, edits, orders and removes fragments of the project report', () => {
    resetStore({ project: studioProject() });

    store().addReportFragments([
      { Kind: 'table', Title: 'Устройства', Columns: ['Имя'], Rows: [['KASSA']] },
      { Kind: 'code', Title: 'Текст модели', Text: ' GENERATE 10' },
    ]);
    store().addReportText('heading');
    expect(store().projectDirty).toBe(true);
    expect(store().syncMessage).toContain('добавлен заголовок');

    const [table, code, heading] = store().project!.Report!.Fragments;
    expect(new Set([table.Id, code.Id, heading.Id]).size).toBe(3);
    expect(heading).toMatchObject({ Kind: 'heading', Text: 'Новый раздел' });

    store().moveReportFragment(heading.Id, 'up');
    store().moveReportFragment(heading.Id, 'up');
    store().updateReportFragment(heading.Id, { Text: 'Базовый вариант' });
    store().removeReportFragment(code.Id);
    store().setReportTitle('Итоги');

    expect(store().project!.Report).toEqual({
      Title: 'Итоги',
      Fragments: [{ ...heading, Text: 'Базовый вариант' }, table],
    });
  });

  it('warns about an empty tab and an empty report', () => {
    resetStore({ project: studioProject() });

    store().addReportFragments([]);
    expect(store().syncMessage).toContain('нет таблиц');

    store().exportFinalReport('html');
    expect(store().syncMessage).toContain('Итоговый отчёт пуст');
  });

  it('saves the report with the project', async () => {
    const backend = mockBackend((request) => (request.method === 'PUT' && request.url.startsWith(PROJECTS) ? { status: 200, body: request.body } : undefined));
    resetStore({ project: studioProject() });
    store().addReportText('text');

    await store().saveProject();

    const put = backend.requests.find((request) => request.method === 'PUT');
    expect(put?.body).toMatchObject({ Report: { Title: '', Fragments: [{ Kind: 'text' }] } });
  });

  it('exports the report as HTML and as a Word document', async () => {
    const downloads = captureDownloads();
    resetStore({ project: studioProject() });
    store().addReportFragments([{ Kind: 'table', Title: 'Устройства', Columns: ['Имя'], Rows: [['KASSA']] }]);

    store().exportFinalReport('html');
    store().exportFinalReport('word');
    downloads.restore();

    expect(downloads.names).toEqual(['Отчёт по проекту «Мастерская».html', 'Отчёт по проекту «Мастерская».doc']);
    expect(await downloads.blobs[0].text()).toContain('<td>KASSA</td>');
    expect(downloads.blobs[1].type).toBe('application/msword');
    expect(await downloads.blobs[1].text()).toContain('Content-Type: multipart/related');
    expect(store().syncMessage).toContain('выгружен для Word');
  });
});
