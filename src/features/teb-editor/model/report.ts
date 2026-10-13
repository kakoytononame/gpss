/** Key of a user-edited standard report cell in `reportCellEdits`. */
export function reportCellKey(sectionId: string, rowIndex: number, columnIndex: number): string {
  return `${sectionId}:${rowIndex}:${columnIndex}`;
}

export interface ReportTable {
  id: string;
  label: string;
  columns: string[];
  rows: string[][];
}

function applyEdits(table: ReportTable, edits: Record<string, string>): string[][] {
  return table.rows.map((row, rowIndex) => row.map((cell, columnIndex) => edits[reportCellKey(table.id, rowIndex, columnIndex)] ?? cell));
}

/** Lets Excel recognise the CSV file as UTF-8. */
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

function csvCell(value: string): string {
  return /[;"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Standard report as CSV for Excel: UTF-8 with BOM, ";" separators (the Russian Excel default),
 * one block per section with its title and column headers. User edits of cells are applied.
 */
export function reportToCsv(modelName: string, tables: ReportTable[], edits: Record<string, string>): string {
  const lines = [csvCell(`Стандартный отчёт: ${modelName}`), ''];
  for (const table of tables) {
    lines.push(csvCell(table.label), table.columns.map(csvCell).join(';'));
    lines.push(...applyEdits(table, edits).map((row) => row.map(csvCell).join(';')), '');
  }

  return BYTE_ORDER_MARK + lines.join('\r\n');
}

/** Report tables as tab-separated text (pastes into Excel as cells). */
export function reportToTsv(tables: ReportTable[], edits: Record<string, string>): string {
  return tables.map((table) => [table.label, table.columns.join('\t'), ...applyEdits(table, edits).map((row) => row.join('\t'))].join('\n')).join('\n\n');
}
