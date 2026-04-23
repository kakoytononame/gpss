import { useState } from 'react';
import addIcon from '../../../../shared/assets/icons/add.png';
import moveDownIcon from '../../../../shared/assets/icons/move-down.png';
import moveUpIcon from '../../../../shared/assets/icons/move-up.png';
import removeIcon from '../../../../shared/assets/icons/remove.png';
import type { TebState } from '../../../../shared/types/teb';
import { EditableTable, type TableColumn } from '../../../../shared/ui/EditableTable';
import { IconButton } from '../../../../shared/ui/IconButton';
import { useTebEditorStore } from '../../store/useTebEditorStore';

export function StatesTab() {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const rows = useTebEditorStore((state) => state.teb?.states ?? []);
  const addCollectionRow = useTebEditorStore((state) => state.addCollectionRow);
  const removeCollectionRow = useTebEditorStore((state) => state.removeCollectionRow);
  const moveCollectionRow = useTebEditorStore((state) => state.moveCollectionRow);
  const updateCollectionField = useTebEditorStore((state) => state.updateCollectionField);
  const commitCollectionField = useTebEditorStore((state) => state.commitCollectionField);

  const columns: TableColumn<TebState>[] = [
    {
      key: 'name',
      label: 'Имя',
      width: '22%',
      render: (row, index) => (
        <input value={row.name} onChange={(event) => updateCollectionField('states', index, 'name', event.target.value)} onBlur={() => void commitCollectionField('states', index)} />
      ),
    },
    {
      key: 'expression',
      label: 'Выражение',
      width: '34%',
      render: (row, index) => (
        <input value={row.expression} onChange={(event) => updateCollectionField('states', index, 'expression', event.target.value)} onBlur={() => void commitCollectionField('states', index)} />
      ),
    },
    {
      key: 'description',
      label: 'Описание',
      render: (row, index) => (
        <input value={row.description} onChange={(event) => updateCollectionField('states', index, 'description', event.target.value)} onBlur={() => void commitCollectionField('states', index)} />
      ),
    },
  ];

  return (
    <div className="tab-stack">
      <div className="editor-toolbar">
        <IconButton icon={addIcon} label="Добавить" title="Добавить состояние" onClick={() => addCollectionRow('states')} />
        <IconButton icon={removeIcon} label="Удалить" title="Удалить состояние" onClick={() => removeCollectionRow('states', selectedIndex)} disabled={selectedIndex < 0} />
        <IconButton icon={moveUpIcon} label="Выше" title="Поднять состояние" onClick={() => moveCollectionRow('states', selectedIndex, 'up')} disabled={selectedIndex < 0} />
        <IconButton icon={moveDownIcon} label="Ниже" title="Опустить состояние" onClick={() => moveCollectionRow('states', selectedIndex, 'down')} disabled={selectedIndex < 0} />
      </div>
      <EditableTable columns={columns} rows={rows} selectedIndex={selectedIndex} onSelect={setSelectedIndex} getRowKey={(row) => row.id} emptyText="Состояния не заданы" />
    </div>
  );
}
