import type { TebPort } from '../../../../shared/types/teb';
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

interface PortsTabProps {
  collection: 'inputs' | 'outputs';
}

export function PortsTab({ collection }: PortsTabProps) {
  const rows = useTebEditorStore((state) => state.teb?.[collection] ?? NO_ROWS);
  const columns = useCollectionColumns(collection, COLUMNS);
  const actions = useCollectionActions(collection);

  return <CollectionEditor key={collection} rows={rows} columns={columns} titles={TITLES} {...actions} />;
}
