import type { ProjectReport } from '../../../shared/types/project';
import { escapeHtml, fragmentsFromElement, reportFileName, reportToHtml, reportToMhtml, utf8ToBase64 } from './finalReport';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';

const REPORT: ProjectReport = {
  Title: 'Отчёт <порт>',
  Fragments: [
    { Id: '1', Kind: 'heading', Title: '', Text: 'Исходный вариант' },
    {
      Id: '2',
      Kind: 'table',
      Title: 'Устройства',
      Columns: ['Имя', 'Загрузка'],
      Rows: [['KASSA', '0.8 & более']],
      Source: 'Эксперимент 1 — Стандартный отчёт',
    },
    { Id: '3', Kind: 'code', Title: 'Текст модели', Text: ' GENERATE 10\n TERMINATE 1' },
    { Id: '4', Kind: 'image', Title: 'Очередь', Image: PNG },
    { Id: '5', Kind: 'text', Title: 'Выводы', Text: 'Касса перегружена.\n\nНужна вторая касса.' },
  ],
};

function decodeBase64Utf8(base64: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(base64.replace(/\s+/g, '')), (char) => char.charCodeAt(0)));
}

describe('final report', () => {
  it('collects tables, model text and charts shown by a tab in document order', async () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <table><tbody><tr><th>Вид</th><td>Одиночный эксперимент</td></tr><tr><th>Модель</th><td>Порт</td></tr></tbody></table>
      <pre> GENERATE 10</pre>
      <figure class="chart-card"><figcaption><span class="chart-card__title">Причал</span></figcaption><svg class="recharts-surface"></svg><table><tr><td>x</td></tr></table></figure>
      <figure class="chart-card"><figcaption><span class="chart-card__title">Без SVG</span></figcaption></figure>
      <table aria-label="Устройства"><thead><tr><th>Имя</th><th>Загрузка</th></tr></thead><tbody><tr><td>KASSA</td><td> 0.8 </td></tr></tbody></table>
      <table aria-label="Очереди"><thead><tr><th>Имя</th></tr></thead><tbody><tr><td colspan="1">Нет данных</td></tr></tbody></table>`;
    const renderChart = vi.fn(async () => PNG);

    const fragments = await fragmentsFromElement(root, 'Общая информация', 'Эксперимент 1 — Общая информация', renderChart);

    expect(renderChart).toHaveBeenCalledTimes(1);
    expect(fragments).toEqual([
      {
        Kind: 'table',
        Title: 'Общая информация',
        Columns: ['Параметр', 'Значение'],
        Rows: [
          ['Вид', 'Одиночный эксперимент'],
          ['Модель', 'Порт'],
        ],
        Source: 'Эксперимент 1 — Общая информация',
      },
      { Kind: 'code', Title: 'Общая информация', Text: ' GENERATE 10', Source: 'Эксперимент 1 — Общая информация' },
      { Kind: 'image', Title: 'Причал', Image: PNG, Source: 'Эксперимент 1 — Общая информация' },
      { Kind: 'table', Title: 'Устройства', Columns: ['Имя', 'Загрузка'], Rows: [['KASSA', '0.8']], Source: 'Эксперимент 1 — Общая информация' },
      { Kind: 'table', Title: 'Очереди', Columns: ['Имя'], Rows: [], Source: 'Эксперимент 1 — Общая информация' },
    ]);
  });

  it('renders the report as an escaped HTML page', () => {
    const html = reportToHtml(REPORT);

    expect(html).toContain('<title>Отчёт &lt;порт&gt;</title>');
    expect(html).toContain('<h2>Исходный вариант</h2>');
    expect(html).toContain('<thead><tr><th>Имя</th><th>Загрузка</th></tr></thead><tbody><tr><td>KASSA</td><td>0.8 &amp; более</td></tr></tbody>');
    expect(html).toContain('<p class="source">Эксперимент 1 — Стандартный отчёт</p>');
    expect(html).toContain('<pre> GENERATE 10\n TERMINATE 1</pre>');
    expect(html).toContain(`<img src="${PNG}" alt="Очередь">`);
    expect(html).toContain('<h3>Выводы</h3><p>Касса перегружена.</p><p>Нужна вторая касса.</p>');
  });

  it('packs the report and its pictures into MHTML for Word', () => {
    const mhtml = reportToMhtml(REPORT);
    const boundary = /boundary="([^"]+)"/.exec(mhtml)?.[1];
    expect(boundary).toBeTruthy();

    const parts = mhtml.split(`--${boundary}`).slice(1, -1);
    expect(parts).toHaveLength(2);
    expect(parts[1]).toContain('Content-Type: image/png');
    expect(parts[1]).toContain('Content-Location: file:///C:/gpss-report/image001.png');
    expect(parts[1]).toContain('iVBORw0KGgoAAAANSUhEUg==');
    expect(mhtml.trimEnd().endsWith(`--${boundary}--`)).toBe(true);

    const html = decodeBase64Utf8(parts[0].split('\r\n\r\n')[1]);
    expect(html).toContain('<img src="file:///C:/gpss-report/image001.png" alt="Очередь">');
    expect(html).toContain('Касса перегружена.');
  });

  it('encodes UTF-8 to base64 and makes safe file names', () => {
    expect(decodeBase64Utf8(utf8ToBase64('Отчёт ✓'))).toBe('Отчёт ✓');
    expect(escapeHtml('"a" <b>')).toBe('&quot;a&quot; &lt;b&gt;');
    expect(reportFileName('Порт: вариант 1/2', 'doc')).toBe('Порт вариант 1 2.doc');
    expect(reportFileName('  ', 'html')).toBe('Итоговый отчёт.html');
  });
});
