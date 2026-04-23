export function EditableTable({ columns, rows, selectedIndex, onSelect, emptyText = 'Нет данных' }) {
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
              <tr
                key={row.id || rowIndex}
                className={selectedIndex === rowIndex ? 'is-selected' : ''}
                onClick={() => onSelect(rowIndex)}
              >
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
