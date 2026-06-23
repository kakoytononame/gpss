import { useState } from 'react';
import addIcon from '../../../../shared/assets/icons/add.png';
import moveDownIcon from '../../../../shared/assets/icons/move-down.png';
import moveUpIcon from '../../../../shared/assets/icons/move-up.png';
import removeIcon from '../../../../shared/assets/icons/remove.png';
import type { TebPort } from '../../../../shared/types/teb';
import { EditableTable, type TableColumn } from '../../../../shared/ui/EditableTable/EditableTable';
import { IconButton } from '../../../../shared/ui/IconButton/IconButton';
import { useTebEditorStore } from '../../store/useTebEditorStore';

interface PortsTabProps {
  collection: 'inputs' | 'outputs';
}

export function PortsTab({ collection }: PortsTabProps) {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const rows = useTebEditorStore((state) => state.teb?.[collection] ?? []);
  const addCollectionRow = useTebEditorStore((state) => state.addCollectionRow);
  const removeCollectionRow = useTebEditorStore((state) => state.removeCollectionRow);
  const moveCollectionRow = useTebEditorStore((state) => state.moveCollectionRow);
  const updateCollectionField = useTebEditorStore((state) => state.updateCollectionField);
  const commitCollectionField = useTebEditorStore((state) => state.commitCollectionField);

  const columns: TableColumn<TebPort>[] = [
    {
      key: 'nameInModel',
      label: 'Имя в модели',
      width: '18%',
      render: (row, index) => (
        <input value={row.nameInModel} onChange={(event) => updateCollectionField(collection, index, 'nameInModel', event.target.value)} onBlur={() => void commitCollectionField(collection, index)} />
      ),
    },
    {
      key: 'header',
      label: 'Заголовок',
      width: '18%',
      render: (row, index) => (
        <input value={row.header} onChange={(event) => updateCollectionField(collection, index, 'header', event.target.value)} onBlur={() => void commitCollectionField(collection, index)} />
      ),
    },
    {
      key: 'connectedBlock',
      label: 'Связанный блок',
      width: '22%',
      render: (row, index) => (
        <input
          value={row.connectedBlock}
          onChange={(event) => updateCollectionField(collection, index, 'connectedBlock', event.target.value)}
          onBlur={() => void commitCollectionField(collection, index)}
        />
      ),
    },
    {
      key: 'connectionsLimit',
      label: 'Лимит',
      width: '12%',
      render: (row, index) => (
        <input
          value={String(row.connectionsLimit)}
          onChange={(event) => updateCollectionField(collection, index, 'connectionsLimit', event.target.value)}
          onBlur={() => void commitCollectionField(collection, index)}
        />
      ),
    },
    {
      key: 'description',
      label: 'Описание',
      render: (row, index) => (
        <input value={row.description} onChange={(event) => updateCollectionField(collection, index, 'description', event.target.value)} onBlur={() => void commitCollectionField(collection, index)} />
      ),
    },
  ];

  return (
    <div className="tab-stack">
      <div className="editor-toolbar">
        <IconButton icon={addIcon} label="Добавить" title="Добавить строку" onClick={() => addCollectionRow(collection)} />
        <IconButton icon={removeIcon} label="Удалить" title="Удалить строку" onClick={() => removeCollectionRow(collection, selectedIndex)} disabled={selectedIndex < 0} />
        <IconButton icon={moveUpIcon} label="Выше" title="Переместить выше" onClick={() => moveCollectionRow(collection, selectedIndex, 'up')} disabled={selectedIndex < 0} />
        <IconButton icon={moveDownIcon} label="Ниже" title="Переместить ниже" onClick={() => moveCollectionRow(collection, selectedIndex, 'down')} disabled={selectedIndex < 0} />
      </div>
      <EditableTable columns={columns} rows={rows} selectedIndex={selectedIndex} onSelect={setSelectedIndex} getRowKey={(row) => row.id} />
    </div>
  );
}
