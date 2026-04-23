import { useState } from 'react';
import { useTebEditorStore } from '../store/useTebEditorStore.js';
import { EditableTable } from './EditableTable.jsx';
import { EditorToolbar } from './EditorToolbar.jsx';

export function StatesTab() {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const rows = useTebEditorStore((state) => state.teb?.states ?? []);
  const addCollectionRow = useTebEditorStore((state) => state.addCollectionRow);
  const removeCollectionRow = useTebEditorStore((state) => state.removeCollectionRow);
  const moveCollectionRow = useTebEditorStore((state) => state.moveCollectionRow);
  const updateCollectionField = useTebEditorStore((state) => state.updateCollectionField);
  const commitCollectionField = useTebEditorStore((state) => state.commitCollectionField);

  const columns = [
    {
      key: 'name',
      label: 'Имя',
      width: '22%',
      render: (row, index) => (
        <input
          value={row.name}
          onBlur={() => commitCollectionField('states', index)}
          onChange={(event) => updateCollectionField('states', index, 'name', event.target.value)}
        />
      ),
    },
    {
      key: 'expression',
      label: 'Выражение',
      width: '36%',
      render: (row, index) => (
        <input
          value={row.expression}
          onBlur={() => commitCollectionField('states', index)}
          onChange={(event) => updateCollectionField('states', index, 'expression', event.target.value)}
        />
      ),
    },
    {
      key: 'description',
      label: 'Описание',
      render: (row, index) => (
        <input
          value={row.description}
          onBlur={() => commitCollectionField('states', index)}
          onChange={(event) => updateCollectionField('states', index, 'description', event.target.value)}
        />
      ),
    },
  ];

  return (
    <div className="tab-stack">
      <EditorToolbar
        selectedIndex={selectedIndex}
        onAdd={() => addCollectionRow('states')}
        onRemove={() => removeCollectionRow('states', selectedIndex)}
        onMoveUp={() => moveCollectionRow('states', selectedIndex, 'up')}
        onMoveDown={() => moveCollectionRow('states', selectedIndex, 'down')}
      />
      <EditableTable columns={columns} rows={rows} selectedIndex={selectedIndex} onSelect={setSelectedIndex} emptyText="Состояния не заданы" />
    </div>
  );
}
