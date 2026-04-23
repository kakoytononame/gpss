import { useState } from 'react';
import addIcon from '../../../../shared/assets/icons/add.png';
import moveDownIcon from '../../../../shared/assets/icons/move-down.png';
import moveUpIcon from '../../../../shared/assets/icons/move-up.png';
import removeIcon from '../../../../shared/assets/icons/remove.png';
import type { GpssEntity } from '../../../../shared/types/teb';
import { EditableTable, type TableColumn } from '../../../../shared/ui/EditableTable';
import { IconButton } from '../../../../shared/ui/IconButton';
import { useTebEditorStore } from '../../store/useTebEditorStore';

export function GpssObjectsTab() {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const rows = useTebEditorStore((state) => state.teb?.gpssEntities ?? []);
  const addCollectionRow = useTebEditorStore((state) => state.addCollectionRow);
  const removeCollectionRow = useTebEditorStore((state) => state.removeCollectionRow);
  const moveCollectionRow = useTebEditorStore((state) => state.moveCollectionRow);
  const updateCollectionField = useTebEditorStore((state) => state.updateCollectionField);
  const commitCollectionField = useTebEditorStore((state) => state.commitCollectionField);

  const columns: TableColumn<GpssEntity>[] = [
    {
      key: 'type',
      label: 'Тип объекта',
      width: '22%',
      render: (row, index) => (
        <input value={row.type} onChange={(event) => updateCollectionField('gpssEntities', index, 'type', event.target.value)} onBlur={() => void commitCollectionField('gpssEntities', index)} />
      ),
    },
    {
      key: 'nameInModel',
      label: 'Имя в модели',
      width: '22%',
      render: (row, index) => (
        <input
          value={row.nameInModel}
          onChange={(event) => updateCollectionField('gpssEntities', index, 'nameInModel', event.target.value)}
          onBlur={() => void commitCollectionField('gpssEntities', index)}
        />
      ),
    },
    {
      key: 'value',
      label: 'Данные',
      width: '20%',
      render: (row, index) => (
        <input value={String(row.value)} onChange={(event) => updateCollectionField('gpssEntities', index, 'value', event.target.value)} onBlur={() => void commitCollectionField('gpssEntities', index)} />
      ),
    },
    {
      key: 'description',
      label: 'Описание',
      render: (row, index) => (
        <input
          value={row.description}
          onChange={(event) => updateCollectionField('gpssEntities', index, 'description', event.target.value)}
          onBlur={() => void commitCollectionField('gpssEntities', index)}
        />
      ),
    },
  ];

  return (
    <div className="tab-stack">
      <div className="editor-toolbar">
        <IconButton icon={addIcon} label="Добавить" title="Добавить GPSS объект" onClick={() => addCollectionRow('gpssEntities')} />
        <IconButton icon={removeIcon} label="Удалить" title="Удалить выбранный GPSS объект" onClick={() => removeCollectionRow('gpssEntities', selectedIndex)} disabled={selectedIndex < 0} />
        <IconButton icon={moveUpIcon} label="Выше" title="Переместить объект выше" onClick={() => moveCollectionRow('gpssEntities', selectedIndex, 'up')} disabled={selectedIndex < 0} />
        <IconButton icon={moveDownIcon} label="Ниже" title="Переместить объект ниже" onClick={() => moveCollectionRow('gpssEntities', selectedIndex, 'down')} disabled={selectedIndex < 0} />
      </div>
      <EditableTable columns={columns} rows={rows} selectedIndex={selectedIndex} onSelect={setSelectedIndex} getRowKey={(row) => row.id} />
    </div>
  );
}
