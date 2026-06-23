import { useState } from 'react';
import addIcon from '../../../../shared/assets/icons/add.png';
import moveDownIcon from '../../../../shared/assets/icons/move-down.png';
import moveUpIcon from '../../../../shared/assets/icons/move-up.png';
import removeIcon from '../../../../shared/assets/icons/remove.png';
import type { TebParameter } from '../../../../shared/types/teb';
import { EditableTable, type TableColumn } from '../../../../shared/ui/EditableTable/EditableTable';
import { IconButton } from '../../../../shared/ui/IconButton/IconButton';
import { PARAMETER_TYPES } from '../../model/constants';
import { useTebEditorStore } from '../../store/useTebEditorStore';

export function ParametersTab() {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const mode = useTebEditorStore((state) => state.teb?.mode ?? state.mode);
  const rows = useTebEditorStore((state) => state.teb?.parameters ?? []);
  const addParameter = useTebEditorStore((state) => state.addParameter);
  const removeParameter = useTebEditorStore((state) => state.removeParameter);
  const moveParameter = useTebEditorStore((state) => state.moveParameter);
  const updateParameter = useTebEditorStore((state) => state.updateParameter);
  const commitParameter = useTebEditorStore((state) => state.commitParameter);
  const commitParameterValue = useTebEditorStore((state) => state.commitParameterValue);
  const showCurrentValue = mode === 'instance';

  const columns: TableColumn<TebParameter>[] = [
    {
      key: 'type',
      label: 'Тип',
      width: '20%',
      render: (row, index) => (
        <select value={row.type} onChange={(event) => updateParameter(index, 'type', event.target.value)} onBlur={() => void commitParameter(index)}>
          {PARAMETER_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'header',
      label: 'Заголовок',
      width: '18%',
      render: (row, index) => (
        <input value={row.header} onChange={(event) => updateParameter(index, 'header', event.target.value)} onBlur={() => void commitParameter(index)} />
      ),
    },
    {
      key: 'nameInModel',
      label: 'Имя в модели',
      width: '18%',
      render: (row, index) => (
        <input value={row.nameInModel} onChange={(event) => updateParameter(index, 'nameInModel', event.target.value)} onBlur={() => void commitParameter(index)} />
      ),
    },
    {
      key: 'defaultValue',
      label: 'По умолчанию',
      width: '16%',
      render: (row, index) => (
        <input value={String(row.defaultValue)} onChange={(event) => updateParameter(index, 'defaultValue', event.target.value)} onBlur={() => void commitParameter(index)} />
      ),
    },
    {
      key: 'allowEmptyValues',
      label: 'Пустые',
      width: '8%',
      render: (row, index) => (
        <label className="checkbox-cell">
          <input checked={row.allowEmptyValues} type="checkbox" onChange={(event) => updateParameter(index, 'allowEmptyValues', event.target.checked)} onBlur={() => void commitParameter(index)} />
        </label>
      ),
    },
  ];

  if (showCurrentValue) {
    columns.push({
      key: 'currentValue',
      label: 'Текущее значение',
      width: '20%',
      render: (row, index) => (
        <input value={String(row.currentValue)} onChange={(event) => updateParameter(index, 'currentValue', event.target.value)} onBlur={() => void commitParameterValue(index)} />
      ),
    });
  }

  return (
    <div className="tab-stack">
      <div className="editor-toolbar">
        <IconButton icon={addIcon} label="Добавить" title="Добавить параметр" onClick={() => void addParameter()} />
        <IconButton icon={removeIcon} label="Удалить" title="Удалить параметр" onClick={() => void removeParameter(selectedIndex)} disabled={selectedIndex < 0} />
        <IconButton icon={moveUpIcon} label="Выше" title="Поднять параметр" onClick={() => void moveParameter(selectedIndex, 'up')} disabled={selectedIndex < 0} />
        <IconButton icon={moveDownIcon} label="Ниже" title="Опустить параметр" onClick={() => void moveParameter(selectedIndex, 'down')} disabled={selectedIndex < 0} />
      </div>
      <EditableTable columns={columns} rows={rows} selectedIndex={selectedIndex} onSelect={setSelectedIndex} getRowKey={(row) => row.id} emptyText="Параметры не заданы" />
    </div>
  );
}
