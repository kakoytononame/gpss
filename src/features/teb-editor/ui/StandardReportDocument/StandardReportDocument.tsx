import { useMemo, useState } from 'react';
import { reportCellKey } from '../../model/report';
import { useTebEditorStore } from '../../store/useTebEditorStore';
import { DEMO_REPORT_SECTIONS, type ReportSection } from './reportData';
import './StandardReportDocument.css';

interface EditingCell {
  sectionId: string;
  rowIndex: number;
  columnIndex: number;
  draft: string;
}

/** Sections of the last simulation, or the demo report before the first run. */
function useReportSections(): { sections: ReportSection[]; isDemo: boolean } {
  const report = useTebEditorStore((state) => state.simulationReport);

  return useMemo(
    () =>
      report
        ? {
            sections: report.Sections.map((section) => ({ id: section.Id, label: section.Label, columns: section.Columns, rows: section.Rows })),
            isDemo: false,
          }
        : { sections: DEMO_REPORT_SECTIONS, isDemo: true },
    [report],
  );
}

export function StandardReportDocument() {
  const modelName = useTebEditorStore((state) => state.simulationReport?.ModelName || state.teb?.header || state.teb?.nameInModel || 'Столовая');
  const editedCells = useTebEditorStore((state) => state.reportCellEdits);
  const setReportCellEdit = useTebEditorStore((state) => state.setReportCellEdit);
  const { sections, isDemo } = useReportSections();
  const [activeSectionId, setActiveSectionId] = useState('general');
  const [selectedRows, setSelectedRows] = useState<Record<string, number>>({});
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);

  const activeSection = sections.find((section) => section.id === activeSectionId) ?? sections[0];
  const selectedRowIndex = selectedRows[activeSection.id] ?? activeSection.selectedRow ?? 0;

  function cellValue(rowIndex: number, columnIndex: number, fallback: string): string {
    return editedCells[reportCellKey(activeSection.id, rowIndex, columnIndex)] ?? fallback;
  }

  function selectRow(rowIndex: number) {
    setSelectedRows((current) => ({ ...current, [activeSection.id]: rowIndex }));
  }

  function beginCellEdit(rowIndex: number, columnIndex: number, value: string) {
    selectRow(rowIndex);
    setEditingCell({ sectionId: activeSection.id, rowIndex, columnIndex, draft: value });
  }

  function commitCellEdit() {
    if (editingCell) {
      setReportCellEdit(editingCell.sectionId, editingCell.rowIndex, editingCell.columnIndex, editingCell.draft);
      setEditingCell(null);
    }
  }

  function isEditing(rowIndex: number, columnIndex: number): boolean {
    return editingCell?.sectionId === activeSection.id && editingCell.rowIndex === rowIndex && editingCell.columnIndex === columnIndex;
  }

  return (
    <section className="standard-report-document" aria-label={`${modelName} - Стандартный отчёт`}>
      <aside className="standard-report-nav" aria-label="Разделы стандартного отчёта">
        <div className="standard-report-nav__title">{isDemo ? 'Стандартный отчёт GPSS World Core (демонстрационный)' : `Стандартный отчёт: ${modelName}`}</div>
        {sections.map((section) => (
          <button
            className={`standard-report-nav__item ${activeSection.id === section.id ? 'is-active' : ''}`}
            key={section.id}
            type="button"
            aria-current={activeSection.id === section.id}
            onClick={() => {
              setEditingCell(null);
              setActiveSectionId(section.id);
            }}
          >
            {section.label}
          </button>
        ))}
      </aside>

      <div className="standard-report-grid" role="region" aria-label={activeSection.label}>
        <table className={`standard-report-table standard-report-table--${activeSection.id}`}>
          <thead>
            <tr>
              {activeSection.columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeSection.rows.length === 0 ? (
              <tr>
                <td className="standard-report-empty" colSpan={activeSection.columns.length}>
                  Нет данных
                </td>
              </tr>
            ) : null}
            {activeSection.rows.map((row, rowIndex) => (
              <tr className={rowIndex === selectedRowIndex ? 'is-selected' : ''} key={`${activeSection.id}-${rowIndex}`} onClick={() => selectRow(rowIndex)}>
                {activeSection.columns.map((column, columnIndex) => {
                  const value = cellValue(rowIndex, columnIndex, row[columnIndex] ?? '');
                  const editing = isEditing(rowIndex, columnIndex);

                  return (
                    <td
                      className={editing ? 'is-editing' : ''}
                      key={`${column}-${columnIndex}`}
                      onDoubleClick={() => beginCellEdit(rowIndex, columnIndex, value)}
                    >
                      {editing && editingCell ? (
                        <input
                          autoFocus
                          aria-label={column}
                          className="standard-report-cell-editor"
                          value={editingCell.draft}
                          onBlur={commitCellEdit}
                          onChange={(event) => setEditingCell({ ...editingCell, draft: event.target.value })}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              commitCellEdit();
                            } else if (event.key === 'Escape') {
                              event.preventDefault();
                              setEditingCell(null);
                            }
                          }}
                        />
                      ) : (
                        value
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
