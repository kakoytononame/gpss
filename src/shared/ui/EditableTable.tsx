import type { ReactNode } from 'react';

export interface TableColumn<Row> {
  key: string;
  label: string;
  width?: string;
  render: (row: Row, rowIndex: number) => ReactNode;
}

interface EditableTableProps<Row> {
  columns: TableColumn<Row>[];
  rows: Row[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  emptyText?: string;
  getRowKey: (row: Row, index: number) => string;
}

export function EditableTable<Row>({ columns, rows, selectedIndex, onSelect, emptyText = 'Нет данных', getRowKey }: EditableTableProps<Row>) {
  return (
    <div className="table-shell">
      <table className="editor-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} style={{ width: column.width }}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="table-empty" colSpan={columns.length}>
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={getRowKey(row, rowIndex)} className={selectedIndex === rowIndex ? 'is-selected' : ''} onClick={() => onSelect(rowIndex)}>
                {columns.map((column) => (
                  <td key={column.key}>{column.render(row, rowIndex)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
