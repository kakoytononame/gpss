import { useState } from 'react';
import { useTebEditorStore } from '../store/useTebEditorStore.js';
import { EditableTable } from './EditableTable.jsx';
import { EditorToolbar } from './EditorToolbar.jsx';

export function GpssObjectsTab() {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const rows = useTebEditorStore((state) => state.teb?.gpssEntities ?? []);
  const addCollectionRow = useTebEditorStore((state) => state.addCollectionRow);
  const removeCollectionRow = useTebEditorStore((state) => state.removeCollectionRow);
  const moveCollectionRow = useTebEditorStore((state) => state.moveCollectionRow);
  const updateCollectionField = useTebEditorStore((state) => state.updateCollectionField);
  const commitCollectionField = useTebEditorStore((state) => state.commitCollectionField);

  const columns = [
    {
      key: 'type',
      label: 'Тип объекта',
      width: '22%',
      render: (row, index) => (
        <input
          value={row.type}
          onBlur={() => commitCollectionField('gpssEntities', index)}
          onChange={(event) => updateCollectionField('gpssEntities', index, 'type', event.target.value)}
        />
      ),
    },
    {
      key: 'nameInModel',
      label: 'Имя в модели',
      width: '22%',
      render: (row, index) => (
        <input
          value={row.nameInModel}
          onBlur={() => commitCollectionField('gpssEntities', index)}
          onChange={(event) => updateCollectionField('gpssEntities', index, 'nameInModel', event.target.value)}
        />
      ),
    },
    {
      key: 'value',
      label: 'Данные',
      width: '20%',
      render: (row, index) => (
        <input
          value={row.value}
          onBlur={() => commitCollectionField('gpssEntities', index)}
          onChange={(event) => updateCollectionField('gpssEntities', index, 'value', event.target.value)}
        />
      ),
    },
    {
      key: 'description',
      label: 'Описание',
      render: (row, index) => (
        <input
          value={row.description}
          onBlur={() => commitCollectionField('gpssEntities', index)}
          onChange={(event) => updateCollectionField('gpssEntities', index, 'description', event.target.value)}
        />
      ),
    },
  ];

  return (
    <div className="tab-stack">
      <EditorToolbar
        selectedIndex={selectedIndex}
        onAdd={() => addCollectionRow('gpssEntities')}
        onRemove={() => removeCollectionRow('gpssEntities', selectedIndex)}
        onMoveUp={() => moveCollectionRow('gpssEntities', selectedIndex, 'up')}
        onMoveDown={() => moveCollectionRow('gpssEntities', selectedIndex, 'down')}
      />
      <EditableTable columns={columns} rows={rows} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />
    </div>
  );
}
