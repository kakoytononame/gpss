import type { TebState } from '../../../../shared/types/teb';
import { useTebEditorStore } from '../../store/useTebEditorStore';
import { CollectionEditor } from './CollectionEditor';
import { useCollectionActions, useCollectionColumns, type TextColumnDefinition } from './useCollectionColumns';

const COLUMNS: TextColumnDefinition<TebState>[] = [
  { key: 'name', label: 'Имя', width: '22%' },
  { key: 'expression', label: 'Выражение', width: '34%' },
  { key: 'description', label: 'Описание' },
];

const TITLES = {
  add: 'Добавить состояние',
  remove: 'Удалить состояние',
  moveUp: 'Поднять состояние',
  moveDown: 'Опустить состояние',
};

const NO_ROWS: TebState[] = [];

export function StatesTab() {
  const rows = useTebEditorStore((state) => state.teb?.states ?? NO_ROWS);
  const columns = useCollectionColumns('states', COLUMNS);
  const actions = useCollectionActions('states');

  return <CollectionEditor rows={rows} columns={columns} titles={TITLES} emptyText="Состояния не заданы" {...actions} />;
}
