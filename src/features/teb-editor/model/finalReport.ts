import type { ProjectReport, ReportFragment } from '../../../shared/types/project';

/** Fragment before it gets an id in the report. */
export type ReportFragmentDraft = Omit<ReportFragment, 'Id'>;

/** Renders a chart (SVG) to a PNG data URI; null when the browser cannot draw it. */
export type ChartRenderer = (svg: SVGSVGElement) => Promise<string | null>;

function cellText(cell: Element): string {
  return (cell.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function tableFragment(table: HTMLTableElement, fallbackTitle: string, source: string): ReportFragmentDraft {
  const headRow = table.tHead?.rows[0];
  const bodyRows = Array.from(table.tBodies).flatMap((body) => Array.from(body.rows));
  const rows = bodyRows.map((row) => Array.from(row.cells, cellText)).filter((row) => row.length > 1 || row[0] !== 'Нет данных');
  const width = Math.max(headRow?.cells.length ?? 0, ...rows.map((row) => row.length));

  return {
    Kind: 'table',
    Title: table.getAttribute('aria-label') ?? fallbackTitle,
    // Tables without a header row are "name — value" lists (general information of a result).
    Columns: headRow ? Array.from(headRow.cells, cellText) : width === 2 ? ['Параметр', 'Значение'] : [],
    Rows: rows,
    Source: source,
  };
}

/**
 * Fragments of what a result tab shows, in document order: tables, preformatted texts (model text)
 * and charts (rendered to PNG). Tables inside charts belong to the chart and are skipped.
 */
export async function fragmentsFromElement(root: HTMLElement, title: string, source: string, renderChart: ChartRenderer): Promise<ReportFragmentDraft[]> {
  const fragments: ReportFragmentDraft[] = [];
  for (const element of Array.from(root.querySelectorAll<HTMLElement>('table, pre, figure.chart-card'))) {
    if (element.tagName === 'TABLE') {
      if (!element.closest('figure.chart-card')) {
        fragments.push(tableFragment(element as HTMLTableElement, title, source));
      }
    } else if (element.tagName === 'PRE') {
      fragments.push({ Kind: 'code', Title: title, Text: element.textContent ?? '', Source: source });
    } else {
      const svg = element.querySelector<SVGSVGElement>('svg.recharts-surface') ?? element.querySelector<SVGSVGElement>('svg');
      const image = svg ? await renderChart(svg) : null;
      if (image) {
        const caption = element.querySelector('.chart-card__title')?.textContent ?? title;
        fragments.push({ Kind: 'image', Title: caption, Image: image, Source: source });
      }
    }
  }

  return fragments;
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const REPORT_STYLE = `
body { font-family: 'Times New Roman', serif; font-size: 12pt; margin: 2cm; }
h1 { font-size: 16pt; text-align: center; }
h2 { font-size: 14pt; margin-top: 18pt; }
h3 { font-size: 12pt; margin: 12pt 0 4pt; }
p.source { margin: 0 0 4pt; color: #555555; font-size: 9pt; }
table { border-collapse: collapse; margin-bottom: 8pt; }
th, td { border: 1px solid #000000; padding: 2pt 5pt; font-size: 10pt; text-align: left; vertical-align: top; }
th { background: #e8eef4; }
pre { font-family: 'Courier New', monospace; font-size: 9pt; border: 1px solid #999999; padding: 4pt; white-space: pre-wrap; }
img { max-width: 16cm; }
`;

function fragmentHtml(fragment: ReportFragment, imageSrc: string): string {
  const source = fragment.Source ? `<p class="source">${escapeHtml(fragment.Source)}</p>` : '';
  switch (fragment.Kind) {
    case 'heading':
      return `<h2>${escapeHtml(fragment.Text || fragment.Title)}</h2>`;
    case 'text':
      return `${fragment.Title ? `<h3>${escapeHtml(fragment.Title)}</h3>` : ''}${(fragment.Text ?? '')
        .split(/\n{2,}/)
        .filter((paragraph) => paragraph.trim())
        .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
        .join('')}`;
    case 'code':
      return `<h3>${escapeHtml(fragment.Title)}</h3>${source}<pre>${escapeHtml(fragment.Text ?? '')}</pre>`;
    case 'table': {
      const head = fragment.Columns?.length ? `<thead><tr>${fragment.Columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead>` : '';
      const body = (fragment.Rows ?? []).map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('');
      return `<h3>${escapeHtml(fragment.Title)}</h3>${source}<table>${head}<tbody>${body}</tbody></table>`;
    }
    case 'image':
      return `<h3>${escapeHtml(fragment.Title)}</h3>${source}<p><img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(fragment.Title)}"></p>`;
  }
}

/**
 * The report as an HTML page. Word opens it as a document; `imageSrc` lets the MHTML export point
 * pictures to its attached parts instead of data URIs.
 */
export function reportToHtml(
  report: ProjectReport,
  imageSrc: (fragment: ReportFragment, index: number) => string = (fragment) => fragment.Image ?? '',
): string {
  let imageIndex = 0;
  const body = report.Fragments.map((fragment) => fragmentHtml(fragment, fragment.Kind === 'image' ? imageSrc(fragment, imageIndex++) : '')).join('\n');
  return [
    '<!DOCTYPE html>',
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">',
    `<head><meta charset="utf-8"><title>${escapeHtml(report.Title)}</title><style>${REPORT_STYLE}</style></head>`,
    `<body><h1>${escapeHtml(report.Title)}</h1>`,
    body,
    '</body></html>',
  ].join('\n');
}

function wrapBase64(base64: string): string {
  return base64.replace(/.{1,76}/g, '$&\r\n').trimEnd();
}

export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }

  return btoa(binary);
}

const MHTML_BOUNDARY = '----=_NextPart_GPSS_Studio_Report';
const MHTML_ROOT = 'file:///C:/gpss-report/';

/**
 * The report as a single-file web page (MHTML) with the pictures as attached parts. Saved with the .doc
 * extension it opens in Microsoft Word with the charts, which plain HTML with data URIs does not guarantee.
 */
export function reportToMhtml(report: ProjectReport): string {
  const images = report.Fragments.filter((fragment) => fragment.Kind === 'image' && fragment.Image?.startsWith('data:'));
  const imageName = (index: number) => `image${String(index + 1).padStart(3, '0')}.png`;
  const html = reportToHtml(report, (_fragment, index) => `${MHTML_ROOT}${imageName(index)}`);

  const parts = [
    [
      'Content-Type: text/html; charset="utf-8"',
      'Content-Transfer-Encoding: base64',
      `Content-Location: ${MHTML_ROOT}report.htm`,
      '',
      wrapBase64(utf8ToBase64(html)),
    ].join('\r\n'),
    ...images.map((fragment, index) => {
      const [header, data = ''] = (fragment.Image ?? '').split(',', 2);
      const mimeType = /^data:([^;,]+)/.exec(header)?.[1] ?? 'image/png';
      return [
        `Content-Type: ${mimeType}`,
        'Content-Transfer-Encoding: base64',
        `Content-Location: ${MHTML_ROOT}${imageName(index)}`,
        '',
        wrapBase64(data),
      ].join('\r\n');
    }),
  ];

  return [
    'MIME-Version: 1.0',
    `Content-Type: multipart/related; boundary="${MHTML_BOUNDARY}"; type="text/html"`,
    '',
    ...parts.map((part) => `--${MHTML_BOUNDARY}\r\n${part}\r\n`),
    `--${MHTML_BOUNDARY}--`,
    '',
  ].join('\r\n');
}

/** File name of an exported report: the title without characters forbidden in file names. */
export function reportFileName(title: string, extension: string): string {
  const base =
    title
      .replace(/[\\/:*?"<>|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Итоговый отчёт';
  return `${base}.${extension}`;
}
