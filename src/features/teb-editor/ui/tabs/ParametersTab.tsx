import type { TebParameter } from '../../../../shared/types/teb';
import type { TableColumn } from '../../../../shared/ui/EditableTable/EditableTable';
import { PARAMETER_TYPES } from '../../model/constants';
import { useTebEditorStore } from '../../store/useTebEditorStore';
import { CollectionEditor } from './CollectionEditor';

const TITLES = {
  add: 'Добавить параметр',
  remove: 'Удалить параметр',
  moveUp: 'Поднять параметр',
  moveDown: 'Опустить параметр',
};

const NO_ROWS: TebParameter[] = [];

type TextField = 'header' | 'nameInModel' | 'defaultValue' | 'currentValue';

export function ParametersTab() {
  const mode = useTebEditorStore((state) => state.teb?.mode ?? state.mode);
  const rows = useTebEditorStore((state) => state.teb?.parameters ?? NO_ROWS);
  const addParameter = useTebEditorStore((state) => state.addParameter);
  const removeParameter = useTebEditorStore((state) => state.removeParameter);
  const moveParameter = useTebEditorStore((state) => state.moveParameter);
  const updateParameter = useTebEditorStore((state) => state.updateParameter);
  const commitParameter = useTebEditorStore((state) => state.commitParameter);
  const commitParameterValue = useTebEditorStore((state) => state.commitParameterValue);

  const textColumn = (key: TextField, label: string, width: string, onCommit: (index: number) => Promise<void>): TableColumn<TebParameter> => ({
    key,
    label,
    width,
    render: (row, index) => (
      <input
        aria-label={label}
        value={String(row[key])}
        onChange={(event) => updateParameter(index, key, event.target.value)}
        onBlur={() => void onCommit(index)}
      />
    ),
  });

  const columns: TableColumn<TebParameter>[] = [
    {
      key: 'type',
      label: 'Тип',
      width: '20%',
      render: (row, index) => (
        <select
          aria-label="Тип"
          value={row.type}
          onChange={(event) => {
            updateParameter(index, 'type', event.target.value);
            void commitParameter(index);
          }}
        >
          {PARAMETER_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ),
    },
    textColumn('header', 'Заголовок', '18%', commitParameter),
    textColumn('nameInModel', 'Имя в модели', '18%', commitParameter),
    textColumn('defaultValue', 'По умолчанию', '16%', commitParameter),
    {
      key: 'allowEmptyValues',
      label: 'Пустые',
      width: '8%',
      render: (row, index) => (
        <label className="checkbox-cell">
          <input
            aria-label="Разрешить пустые значения"
            checked={row.allowEmptyValues}
            type="checkbox"
            onChange={(event) => {
              updateParameter(index, 'allowEmptyValues', event.target.checked);
              void commitParameter(index);
            }}
          />
        </label>
      ),
    },
  ];

  if (mode === 'instance') {
    columns.push(textColumn('currentValue', 'Текущее значение', '20%', commitParameterValue));
  }

  return (
    <CollectionEditor
      rows={rows}
      columns={columns}
      titles={TITLES}
      emptyText="Параметры не заданы"
      onAdd={() => void addParameter()}
      onRemove={(index) => void removeParameter(index)}
      onMove={(index, direction) => void moveParameter(index, direction)}
    />
  );
}
