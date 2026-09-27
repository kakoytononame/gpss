import { useState } from 'react';
import type { ReportSectionId } from '../../../../shared/types/teb';
import { reportCellKey } from '../../model/report';
import { useTebEditorStore } from '../../store/useTebEditorStore';
import { REPORT_SECTION_LINKS, REPORT_SECTIONS } from './reportData';
import './StandardReportDocument.css';

interface EditingCell {
  sectionId: ReportSectionId;
  rowIndex: number;
  columnIndex: number;
  draft: string;
}

export function StandardReportDocument() {
  const modelName = useTebEditorStore((state) => state.teb?.header || state.teb?.nameInModel || 'Столовая');
  const editedCells = useTebEditorStore((state) => state.reportCellEdits);
  const setReportCellEdit = useTebEditorStore((state) => state.setReportCellEdit);
  const [activeSectionId, setActiveSectionId] = useState<ReportSectionId>('general');
  const [selectedRows, setSelectedRows] = useState<Partial<Record<ReportSectionId, number>>>({});
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);

  const activeSection = REPORT_SECTIONS[activeSectionId];
  const selectedRowIndex = selectedRows[activeSectionId] ?? activeSection.selectedRow ?? 0;

  function cellValue(rowIndex: number, columnIndex: number, fallback: string): string {
    return editedCells[reportCellKey(activeSectionId, rowIndex, columnIndex)] ?? fallback;
  }

  function selectRow(rowIndex: number) {
    setSelectedRows((current) => ({ ...current, [activeSectionId]: rowIndex }));
  }

  function beginCellEdit(rowIndex: number, columnIndex: number, value: string) {
    selectRow(rowIndex);
    setEditingCell({ sectionId: activeSectionId, rowIndex, columnIndex, draft: value });
  }

  function commitCellEdit() {
    if (editingCell) {
      setReportCellEdit(editingCell.sectionId, editingCell.rowIndex, editingCell.columnIndex, editingCell.draft);
      setEditingCell(null);
    }
  }

  function isEditing(rowIndex: number, columnIndex: number): boolean {
    return editingCell?.sectionId === activeSectionId && editingCell.rowIndex === rowIndex && editingCell.columnIndex === columnIndex;
  }

  return (
    <section className="standard-report-document" aria-label={`${modelName} - Стандартный отчёт`}>
      <aside className="standard-report-nav" aria-label="Разделы стандартного отчёта">
        <div className="standard-report-nav__title">Стандартный отчёт GPSS World Core</div>
        {REPORT_SECTION_LINKS.map((section) => (
          <button
            className={`standard-report-nav__item ${activeSectionId === section.id ? 'is-active' : ''}`}
            key={section.id}
            type="button"
            aria-current={activeSectionId === section.id}
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
