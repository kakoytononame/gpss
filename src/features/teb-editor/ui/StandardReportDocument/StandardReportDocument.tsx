import { useMemo, useState } from 'react';
import { useTebEditorStore } from '../../store/useTebEditorStore';
import type { ReportSectionId } from '../../../../shared/types/teb';
import './StandardReportDocument.css';

interface ReportSection {
  id: ReportSectionId;
  label: string;
  columns: string[];
  rows: string[][];
  selectedRow?: number;
}

interface EditingCell {
  sectionId: ReportSectionId;
  rowIndex: number;
  columnIndex: number;
  draft: string;
}

const sectionLabels: Array<{ id: ReportSectionId; label: string }> = [
  { id: 'general', label: 'Общая информация' },
  { id: 'names', label: 'Имена' },
  { id: 'blocks', label: 'Блоки' },
  { id: 'facilities', label: 'Устройства' },
  { id: 'queues', label: 'Очереди' },
  { id: 'storages', label: 'Многоканальные устройства' },
  { id: 'switches', label: 'Логические переключатели' },
  { id: 'savevalues', label: 'Сохраняемые величины' },
  { id: 'future', label: 'Будущие события' },
];

const nameRows = [
  ['AUTOLABEL_1', '9.000'],
  ['AUTOLABEL_2', '69.000'],
  ['BUF1', '10033.000'],
  ['BUF1_1', '10035.000'],
  ['BUF2', '10025.000'],
  ['BUF2_1', '10027.000'],
  ['BUF3', '10021.000'],
  ['BUF3_1', '10023.000'],
  ['BUF4', '10037.000'],
  ['BUF4_1', '10039.000'],
  ['BUF5', '10029.000'],
  ['BUF5_1', '10031.000'],
  ['CHET', '47.000'],
  ['EDA', '10008.000'],
  ['EDA1', '10009.000'],
  ['HOLL', '10000.000'],
  ['INPUT', '10020.000'],
  ['INPUT1', '10019.000'],
  ['KASSA1', '10034.000'],
  ['KASSA2', '10026.000'],
  ['KASSA3', '10022.000'],
  ['KASSA4', '10038.000'],
  ['KASSA5', '10030.000'],
  ['KS', '10004.000'],
  ['KS1', '10005.000'],
  ['OBED_KON', '10013.000'],
  ['OBED_NACH', '10012.000'],
  ['PEREHOD', '10.000'],
  ['PEREHOD_1', '11.000'],
];

const blockRows = [
  ['', '1', 'TERMINATE', '0', '0', '0'],
  ['', '2', 'GENERATE', '22', '0', '0'],
  ['', '3', 'TEST', '22', '0', '0'],
  ['', '4', 'TERMINATE', '22', '0', '0'],
  ['', '5', 'GENERATE', '361', '0', '0'],
  ['VIP', '6', 'ENTER', '361', '0', '0'],
  ['', '7', 'ADVANCE', '361', '0', '0'],
  ['', '8', 'TRANSFER', '361', '0', '0'],
  ['AUTOLABEL_1', '9', 'TRANSFER', '361', '0', '0'],
  ['PEREHOD', '10', 'TRANSFER', '308', '0', '0'],
  ['PEREHOD_1', '11', 'TRANSFER', '173', '0', '0'],
  ['PEREHOD_2', '12', 'TRANSFER', '135', '0', '0'],
  ['', '13', 'TERMINATE', '0', '0', '0'],
  ['PERV', '14', 'QUEUE', '53', '0', '0'],
  ['', '15', 'SEIZE', '53', '0', '0'],
  ['', '16', 'DEPART', '53', '0', '0'],
  ['', '17', 'ADVANCE', '53', '0', '0'],
  ['', '18', 'RELEASE', '53', '0', '0'],
  ['', '19', 'QUEUE', '53', '0', '0'],
  ['', '20', 'SEIZE', '53', '0', '0'],
  ['', '21', 'DEPART', '53', '0', '0'],
  ['', '22', 'ADVANCE', '53', '0', '0'],
  ['', '23', 'RELEASE', '53', '0', '0'],
  ['', '24', 'TRANSFER', '53', '0', '0'],
  ['VTOR', '25', 'QUEUE', '93', '0', '0'],
  ['', '26', 'SEIZE', '93', '0', '0'],
  ['', '27', 'DEPART', '93', '0', '0'],
];

const facilityRows = [
  ['KASSA3', '80', '0.332', '5.977', '1', '0', '0', '0', '0', '0'],
  ['VIDACHA3', '80', '0.337', '6.057', '1', '0', '0', '0', '0', '0'],
  ['KASSA2', '93', '0.39', '6.033', '1', '0', '0', '0', '0', '0'],
  ['VIDACHA2', '93', '0.388', '6.014', '1', '0', '0', '0', '0', '0'],
  ['KASSA5', '64', '0.268', '6.029', '1', '0', '0', '0', '0', '0'],
  ['VIDACHA5', '64', '0.263', '5.926', '1', '0', '0', '0', '0', '0'],
  ['KASSA1', '53', '0.22', '5.971', '1', '0', '0', '0', '0', '0'],
  ['VIDACHA1', '53', '0.221', '6.017', '1', '0', '0', '0', '0', '0'],
  ['KASSA4', '71', '0.298', '6.048', '1', '0', '0', '0', '0', '0'],
  ['VIDACHA4', '71', '0.296', '6.005', '1', '0', '0', '0', '0', '0'],
];

const queueRows = [
  ['BUF3', '13', '0', '80', '9', '1.479', '26.621', '29.995', '0'],
  ['BUF3_1', '1', '0', '80', '12', '0.068', '1.226', '1.442', '0'],
  ['BUF2', '15', '0', '93', '6', '2.273', '35.2', '37.628', '0'],
  ['BUF2_1', '1', '0', '93', '23', '0.028', '0.436', '0.579', '0'],
  ['BUF5', '6', '0', '64', '10', '0.488', '10.975', '13.008', '0'],
  ['BUF5_1', '1', '0', '64', '25', '0.035', '0.777', '1.276', '0'],
  ['BUF1', '3', '0', '53', '14', '0.166', '4.5', '6.115', '0'],
  ['BUF1_1', '1', '0', '53', '20', '0.023', '0.625', '1.004', '0'],
  ['BUF4', '12', '0', '71', '8', '0.822', '16.667', '18.783', '0'],
  ['BUF4_1', '1', '0', '71', '32', '0.018', '0.359', '0.653', '0'],
];

const storageRows = [
  ['HOLL', '300', '300', '0', '61', '361', '1', '14.89', '0.05', '0', '0'],
  ['STOLIKI', '20', '20', '0', '15', '361', '1', '3.482', '0.174', '0', '0'],
];

const switchRows = [['VIP_PASSENGERS', '0', '0']];

const saveValueRows = [
  ['WALK', '0', '4.000'],
  ['WALK1', '0', '0.400'],
  ['KS', '0', '6.000'],
  ['KS1', '0', '0.500'],
  ['VD', '0', '6.000'],
  ['VD1', '0', '0.500'],
  ['EDA', '0', '14.000'],
  ['EDA1', '0', '6.000'],
  ['ZAVTRAK_NACH', '0', '5.000'],
  ['ZAVTRAK_KON', '0', '7.000'],
  ['OBED_NACH', '0', '12.000'],
  ['OBED_KON', '0', '14.000'],
  ['UJIN_NACH', '0', '16.000'],
  ['UJIN_KON', '0', '18.000'],
  ['VIP_OBED_NACH', '0', '20.000'],
  ['VIP_OBED_KON', '0', '21.000'],
];

const futureRows = [
  ['382', '0', '2581', '382', '0', '5', '', ''],
  ['386', '0', '2761', '386', '0', '2', '', ''],
];

export function StandardReportDocument() {
  const teb = useTebEditorStore((state) => state.teb);
  const simulationState = useTebEditorStore((state) => state.simulationState);
  const editedCells = useTebEditorStore((state) => state.reportCellEdits);
  const setReportCellEdit = useTebEditorStore((state) => state.setReportCellEdit);
  const [activeSectionId, setActiveSectionId] = useState<ReportSectionId>('general');
  const [selectedRows, setSelectedRows] = useState<Partial<Record<ReportSectionId, number>>>({});
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);

  const modelName = teb?.header || teb?.nameInModel || 'Столовая';
  const sections = useMemo<Record<ReportSectionId, ReportSection>>(
    () => ({
      general: {
        id: 'general',
        label: 'Общая информация',
        columns: ['Начальное время', 'Конечное время', 'Кол-во блоков', 'Кол-во устройств', 'Кол-во мн.канал. устройств'],
        rows: [['0', simulationState === 'running' ? '1440' : '1440', String(blockRows.length), '10', '2']],
      },
      names: {
        id: 'names',
        label: 'Имена',
        columns: ['Имя', 'Значение'],
        rows: nameRows,
      },
      blocks: {
        id: 'blocks',
        label: 'Блоки',
        columns: ['Метка', 'Позиция блока', 'Тип блока', 'Кол-во тран. вошедших в блок', 'Кол-во тран. в блоке в конце моделирования', 'Кол-во тран. ожидающих выполнения спец. условия'],
        rows: blockRows,
        selectedRow: 19,
      },
      facilities: {
        id: 'facilities',
        label: 'Устройства',
        columns: [
          'Имя / номер',
          'Кол-во раз, когда устройство было занято',
          'Коэффициент использования',
          'Ср. время занятия устройства одним тран.',
          'Состояние устройства в конце моделирования',
          'Номер тран., занимающего устройство',
          'Кол-во тран., ожидающих выполнения с прерыванием других тран.',
          'Кол-во прерванных тран.',
          'Кол-во тран., ожидающих выполнения спец. условия',
          'Кол-во тран. ожидающих занятия устройства',
        ],
        rows: facilityRows,
      },
      queues: {
        id: 'queues',
        label: 'Очереди',
        columns: [
          'Имя / номер',
          'Макс. содержимое очереди за период моделирования',
          'Текущее содержимое очереди',
          'Общее кол-во входов тран. в очередь',
          'Общее кол-во входов тран. в очередь с нулевым временем ожидания',
          'Ср. значение содержимого очереди',
          'Ср. время пребывания одного транзакта в очереди',
          'Ср. время пребывания одного транзакта очереди без учета нулевых входов',
          'Кол-во тран., ожидающих выполнения спец. условия',
        ],
        rows: queueRows,
      },
      storages: {
        id: 'storages',
        label: 'Многоканальные устройства',
        columns: [
          'Имя / номер',
          'Емкость памяти',
          'Число свободных единиц памяти к концу моделирования',
          'Мин. число единиц памяти за период моделирования',
          'Макс. число единиц памяти за период моделирования',
          'Кол-во входов в память',
          'Состояние памяти в конце моделирования',
          'Ср. значение занятой емкости',
          'Коэффициент использования памяти',
          'Кол-во тран., ожидающих выполнения спец. условия',
          'Кол-во тран. ожидающих в блоках ENTER',
        ],
        rows: storageRows,
      },
      switches: {
        id: 'switches',
        label: 'Логические переключатели',
        columns: ['Имя / номер', 'Значение ключа в конце моделирования', 'Кол-во тран., ожидающих выполнения спец. условия'],
        rows: switchRows,
      },
      savevalues: {
        id: 'savevalues',
        label: 'Сохраняемые величины',
        columns: ['Имя / номер', 'Кол-во тран. ожидающих выполнения спец. условия', 'Значение сохраняемой величины в конце моделирования'],
        rows: saveValueRows,
      },
      future: {
        id: 'future',
        label: 'Будущие события',
        columns: ['Номер транзакта', 'Приоритет транзакта', 'Время выхода из блока', 'Номер семейства транзакта', 'Номер блока, в котором находился транзакт в конце моделирования', 'Номер след. блока', 'Имя / номер параметра транзакта', 'Значение параметра'],
        rows: futureRows,
      },
    }),
    [simulationState],
  );

  const activeSection = sections[activeSectionId];
  const selectedRowIndex = selectedRows[activeSectionId] ?? activeSection.selectedRow ?? 0;

  function getCellKey(sectionId: ReportSectionId, rowIndex: number, columnIndex: number) {
    return `${sectionId}:${rowIndex}:${columnIndex}`;
  }

  function getCellValue(sectionId: ReportSectionId, rowIndex: number, columnIndex: number, fallback: string) {
    return editedCells[getCellKey(sectionId, rowIndex, columnIndex)] ?? fallback;
  }

  function selectRow(rowIndex: number) {
    setSelectedRows((current) => ({ ...current, [activeSectionId]: rowIndex }));
  }

  function beginCellEdit(rowIndex: number, columnIndex: number, value: string) {
    selectRow(rowIndex);
    setEditingCell({
      sectionId: activeSectionId,
      rowIndex,
      columnIndex,
      draft: value,
    });
  }

  function commitCellEdit() {
    if (!editingCell) {
      return;
    }

    setReportCellEdit(editingCell.sectionId, editingCell.rowIndex, editingCell.columnIndex, editingCell.draft);
    setEditingCell(null);
  }

  function cancelCellEdit() {
    setEditingCell(null);
  }

  return (
    <section className="standard-report-document" aria-label={`${modelName} - Стандартный отчёт`}>
      <aside className="standard-report-nav" aria-label="Разделы стандартного отчёта">
        <div className="standard-report-nav__title">Стандартный отчёт GPSS World Core</div>
        {sectionLabels.map((section) => (
          <button
            className={`standard-report-nav__item ${activeSectionId === section.id ? 'is-active' : ''}`}
            key={section.id}
            type="button"
            onClick={() => setActiveSectionId(section.id)}
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
                  const value = getCellValue(activeSection.id, rowIndex, columnIndex, row[columnIndex] ?? '');
                  const isEditing =
                    editingCell?.sectionId === activeSection.id &&
                    editingCell.rowIndex === rowIndex &&
                    editingCell.columnIndex === columnIndex;

                  return (
                    <td
                      className={isEditing ? 'is-editing' : ''}
                      key={`${column}-${columnIndex}`}
                      onDoubleClick={() => beginCellEdit(rowIndex, columnIndex, value)}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          className="standard-report-cell-editor"
                          value={editingCell.draft}
                          onBlur={commitCellEdit}
                          onChange={(event) => setEditingCell((current) => (current ? { ...current, draft: event.target.value } : current))}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              commitCellEdit();
                            }

                            if (event.key === 'Escape') {
                              event.preventDefault();
                              cancelCellEdit();
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
