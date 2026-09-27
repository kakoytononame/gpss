import { useState } from 'react';
import addIcon from '../../../../shared/assets/icons/add.png';
import moveDownIcon from '../../../../shared/assets/icons/move-down.png';
import moveUpIcon from '../../../../shared/assets/icons/move-up.png';
import removeIcon from '../../../../shared/assets/icons/remove.png';
import { movedIndex } from '../../../../shared/lib/utils';
import type { Direction } from '../../../../shared/types/teb';
import { EditableTable, type TableColumn } from '../../../../shared/ui/EditableTable/EditableTable';
import { IconButton } from '../../../../shared/ui/IconButton/IconButton';

export interface CollectionEditorTitles {
  add: string;
  remove: string;
  moveUp: string;
  moveDown: string;
}

interface CollectionEditorProps<Row extends { id: string }> {
  rows: Row[];
  columns: TableColumn<Row>[];
  titles: CollectionEditorTitles;
  emptyText?: string;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: Direction) => void;
}

/**
 * Toolbar (add / remove / move) plus editable table. The selection follows a moved row
 * and stays inside the table after a removal.
 */
export function CollectionEditor<Row extends { id: string }>({ rows, columns, titles, emptyText, onAdd, onRemove, onMove }: CollectionEditorProps<Row>) {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const hasSelection = selectedIndex >= 0 && selectedIndex < rows.length;

  function handleRemove() {
    if (!hasSelection) {
      return;
    }

    onRemove(selectedIndex);
    setSelectedIndex(Math.min(selectedIndex, rows.length - 2));
  }

  function handleMove(direction: Direction) {
    if (!hasSelection) {
      return;
    }

    onMove(selectedIndex, direction);
    setSelectedIndex(movedIndex(selectedIndex, direction, rows.length));
  }

  return (
    <div className="tab-stack">
      <div className="editor-toolbar">
        <IconButton icon={addIcon} label="Добавить" title={titles.add} onClick={onAdd} />
        <IconButton icon={removeIcon} label="Удалить" title={titles.remove} onClick={handleRemove} disabled={!hasSelection} />
        <IconButton icon={moveUpIcon} label="Выше" title={titles.moveUp} onClick={() => handleMove('up')} disabled={!hasSelection || selectedIndex === 0} />
        <IconButton
          icon={moveDownIcon}
          label="Ниже"
          title={titles.moveDown}
          onClick={() => handleMove('down')}
          disabled={!hasSelection || selectedIndex === rows.length - 1}
        />
      </div>
      <EditableTable
        columns={columns}
        rows={rows}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
        getRowKey={(row) => row.id}
        emptyText={emptyText}
      />
    </div>
  );
}
