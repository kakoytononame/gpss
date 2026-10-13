import type { TebPort } from '../../../../shared/types/teb';
import type { TableColumn } from '../../../../shared/ui/EditableTable/EditableTable';
import { FIRST_BLOCK_LABEL, LAST_BLOCK_LABEL, TRANSFER_MODE_LABELS } from '../../model/projectScheme';
import { useTebEditorStore } from '../../store/useTebEditorStore';
import { CollectionEditor } from './CollectionEditor';
import { useCollectionActions, useCollectionColumns, type TextColumnDefinition } from './useCollectionColumns';

const COLUMNS: TextColumnDefinition<TebPort>[] = [
  { key: 'nameInModel', label: 'Имя в модели', width: '18%' },
  { key: 'header', label: 'Заголовок', width: '18%' },
  { key: 'connectedBlock', label: 'Связанный блок', width: '22%' },
  { key: 'connectionsLimit', label: 'Лимит', width: '12%' },
  { key: 'description', label: 'Описание' },
];

const TITLES = {
  add: 'Добавить строку',
  remove: 'Удалить строку',
  moveUp: 'Переместить выше',
  moveDown: 'Переместить ниже',
};

const NO_ROWS: TebPort[] = [];
const LABEL_PATTERN = /^([A-Za-zА-Яа-яЁё_][\wА-Яа-яЁё]*)\s+[A-Za-z]/;

/** Labels of the TEB model: candidates for the "connected block" of an input or output. */
function modelLabels(text: string): string[] {
  return text
    .split('\n')
    .map((line) => LABEL_PATTERN.exec(line)?.[1])
    .filter((label): label is string => Boolean(label));
}

interface PortsTabProps {
  collection: 'inputs' | 'outputs';
}

export function PortsTab({ collection }: PortsTabProps) {
  const rows = useTebEditorStore((state) => state.teb?.[collection] ?? NO_ROWS);
  const isProjectTeb = useTebEditorStore((state) => state.source === 'project');
  const modelText = useTebEditorStore((state) => state.teb?.gpssModel.text ?? '');
  const updateCollectionField = useTebEditorStore((state) => state.updateCollectionField);
  const commitCollectionField = useTebEditorStore((state) => state.commitCollectionField);
  const textColumns = useCollectionColumns(collection, COLUMNS);
  const actions = useCollectionActions(collection);
  const listId = `connected-blocks-${collection}`;

  // Project TEBs: the connected block is chosen from the special modes or the labels of the model,
  // outputs also carry the transfer mode and the transition model.
  const columns: TableColumn<TebPort>[] = isProjectTeb
    ? textColumns.map((column) =>
        column.key === 'connectedBlock'
          ? {
              ...column,
              render: (row, index) => (
                <input
                  aria-label="Связанный блок"
                  list={listId}
                  value={row.connectedBlock}
                  onChange={(event) => updateCollectionField(collection, index, 'connectedBlock', event.target.value)}
                  onBlur={() => void commitCollectionField(collection, index)}
                />
              ),
            }
          : column,
      )
    : textColumns;

  if (isProjectTeb && collection === 'outputs') {
    columns.push(
      {
        key: 'transferMode',
        label: 'Режим перемещения',
        width: '20%',
        render: (row, index) => (
          <select
            aria-label="Режим перемещения"
            value={row.transferMode ?? 'DirectOrSplit'}
            onChange={(event) => {
              updateCollectionField(collection, index, 'transferMode', event.target.value);
              void commitCollectionField(collection, index);
            }}
          >
            {Object.entries(TRANSFER_MODE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        ),
      },
      {
        key: 'gpssModel',
        label: 'Модель выхода',
        width: '18%',
        render: (row, index) => (
          <input
            aria-label="Модель выхода"
            value={row.gpssModel ?? ''}
            disabled={row.transferMode !== 'CustomModel'}
            placeholder={row.transferMode === 'CustomModel' ? 'GPSS операторы' : ''}
            onChange={(event) => updateCollectionField(collection, index, 'gpssModel', event.target.value)}
            onBlur={() => void commitCollectionField(collection, index)}
          />
        ),
      },
    );
  }

  return (
    <>
      <CollectionEditor key={collection} rows={rows} columns={columns} titles={TITLES} {...actions} />
      {isProjectTeb ? (
        <datalist id={listId}>
          <option value={collection === 'inputs' ? FIRST_BLOCK_LABEL : LAST_BLOCK_LABEL} />
          {modelLabels(modelText).map((label) => (
            <option key={label} value={label} />
          ))}
        </datalist>
      ) : null}
    </>
  );
}
