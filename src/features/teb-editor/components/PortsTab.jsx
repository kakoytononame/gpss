import { useState } from 'react';
import { useTebEditorStore } from '../store/useTebEditorStore.js';
import { EditableTable } from './EditableTable.jsx';
import { EditorToolbar } from './EditorToolbar.jsx';

const TITLES = {
  inputs: 'Входы',
  outputs: 'Выходы',
};

export function PortsTab({ collection }) {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const rows = useTebEditorStore((state) => state.teb?.[collection] ?? []);
  const addCollectionRow = useTebEditorStore((state) => state.addCollectionRow);
  const removeCollectionRow = useTebEditorStore((state) => state.removeCollectionRow);
  const moveCollectionRow = useTebEditorStore((state) => state.moveCollectionRow);
  const updateCollectionField = useTebEditorStore((state) => state.updateCollectionField);
  const commitCollectionField = useTebEditorStore((state) => state.commitCollectionField);

  const columns = [
    {
      key: 'nameInModel',
      label: 'Имя в модели',
      width: '20%',
      render: (row, index) => (
        <input
          value={row.nameInModel}
          onBlur={() => commitCollectionField(collection, index)}
          onChange={(event) => updateCollectionField(collection, index, 'nameInModel', event.target.value)}
        />
      ),
    },
    {
      key: 'header',
      label: 'Заголовок',
      width: '22%',
      render: (row, index) => (
        <input
          value={row.header}
          onBlur={() => commitCollectionField(collection, index)}
          onChange={(event) => updateCollectionField(collection, index, 'header', event.target.value)}
        />
      ),
    },
    {
      key: 'connectedBlock',
      label: 'Связанный блок',
      width: '22%',
      render: (row, index) => (
        <input
          value={row.connectedBlock}
          onBlur={() => commitCollectionField(collection, index)}
          onChange={(event) => updateCollectionField(collection, index, 'connectedBlock', event.target.value)}
        />
      ),
    },
    {
      key: 'connectionsLimit',
      label: 'Лимит',
      width: '12%',
      render: (row, index) => (
        <input
          value={row.connectionsLimit}
          onBlur={() => commitCollectionField(collection, index)}
          onChange={(event) => updateCollectionField(collection, index, 'connectionsLimit', event.target.value)}
        />
      ),
    },
    {
      key: 'description',
      label: 'Описание',
      render: (row, index) => (
        <input
          value={row.description}
          onBlur={() => commitCollectionField(collection, index)}
          onChange={(event) => updateCollectionField(collection, index, 'description', event.target.value)}
        />
      ),
    },
  ];

  return (
    <div className="tab-stack">
      <EditorToolbar
        selectedIndex={selectedIndex}
        onAdd={() => addCollectionRow(collection)}
        onRemove={() => removeCollectionRow(collection, selectedIndex)}
        onMoveUp={() => moveCollectionRow(collection, selectedIndex, 'up')}
        onMoveDown={() => moveCollectionRow(collection, selectedIndex, 'down')}
      />
      <EditableTable columns={columns} rows={rows} selectedIndex={selectedIndex} onSelect={setSelectedIndex} emptyText={`Нет строк: ${TITLES[collection]}`} />
    </div>
  );
}
