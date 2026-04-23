import { useState } from 'react';
import { PARAMETER_TYPES } from '../model/tebEditorModel.js';
import { useTebEditorStore } from '../store/useTebEditorStore.js';
import { EditableTable } from './EditableTable.jsx';
import { EditorToolbar } from './EditorToolbar.jsx';

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

  const columns = [
    {
      key: 'type',
      label: 'Тип',
      width: '23%',
      render: (row, index) => (
        <select
          value={row.type}
          onBlur={() => commitParameter(index)}
          onChange={(event) => updateParameter(index, 'type', event.target.value)}
        >
          {PARAMETER_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'header',
      label: 'Заголовок',
      width: '20%',
      render: (row, index) => (
        <input
          value={row.header}
          onBlur={() => commitParameter(index)}
          onChange={(event) => updateParameter(index, 'header', event.target.value)}
        />
      ),
    },
    {
      key: 'nameInModel',
      label: 'Имя в модели',
      width: '17%',
      render: (row, index) => (
        <input
          value={row.nameInModel}
          onBlur={() => commitParameter(index)}
          onChange={(event) => updateParameter(index, 'nameInModel', event.target.value)}
        />
      ),
    },
    {
      key: 'defaultValue',
      label: 'По умолчанию',
      width: '17%',
      render: (row, index) => (
        <input
          value={row.defaultValue}
          onBlur={() => commitParameter(index)}
          onChange={(event) => updateParameter(index, 'defaultValue', event.target.value)}
        />
      ),
    },
    {
      key: 'allowEmptyValues',
      label: 'Пустые',
      width: '9%',
      render: (row, index) => (
        <label className="checkbox-cell">
          <input
            checked={row.allowEmptyValues}
            type="checkbox"
            onBlur={() => commitParameter(index)}
            onChange={(event) => updateParameter(index, 'allowEmptyValues', event.target.checked)}
          />
        </label>
      ),
    },
  ];

  if (showCurrentValue) {
    columns.push({
      key: 'currentValue',
      label: 'Текущее значение',
      width: '18%',
      render: (row, index) => (
        <input
          value={row.currentValue}
          onBlur={() => commitParameterValue(index)}
          onChange={(event) => updateParameter(index, 'currentValue', event.target.value)}
        />
      ),
    });
  }

  return (
    <div className="tab-stack">
      <EditorToolbar
        selectedIndex={selectedIndex}
        onAdd={addParameter}
        onRemove={() => removeParameter(selectedIndex)}
        onMoveUp={() => moveParameter(selectedIndex, 'up')}
        onMoveDown={() => moveParameter(selectedIndex, 'down')}
      />
      <EditableTable columns={columns} rows={rows} selectedIndex={selectedIndex} onSelect={setSelectedIndex} emptyText="Параметры не заданы" />
    </div>
  );
}
