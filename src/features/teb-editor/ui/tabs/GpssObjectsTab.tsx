import type { GpssEntity } from '../../../../shared/types/teb';
import { useTebEditorStore } from '../../store/useTebEditorStore';
import { CollectionEditor } from './CollectionEditor';
import { useCollectionActions, useCollectionColumns, type TextColumnDefinition } from './useCollectionColumns';

const COLUMNS: TextColumnDefinition<GpssEntity>[] = [
  { key: 'type', label: 'Тип объекта', width: '22%' },
  { key: 'nameInModel', label: 'Имя в модели', width: '22%' },
  { key: 'value', label: 'Данные', width: '20%' },
  { key: 'description', label: 'Описание' },
];

const TITLES = {
  add: 'Добавить GPSS объект',
  remove: 'Удалить выбранный GPSS объект',
  moveUp: 'Переместить объект выше',
  moveDown: 'Переместить объект ниже',
};

const NO_ROWS: GpssEntity[] = [];

export function GpssObjectsTab() {
  const rows = useTebEditorStore((state) => state.teb?.gpssEntities ?? NO_ROWS);
  const columns = useCollectionColumns('gpssEntities', COLUMNS);
  const actions = useCollectionActions('gpssEntities');

  return <CollectionEditor rows={rows} columns={columns} titles={TITLES} {...actions} />;
}
