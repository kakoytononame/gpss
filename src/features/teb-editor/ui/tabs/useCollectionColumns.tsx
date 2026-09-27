import type { CollectionKey, CollectionRow } from '../../../../shared/types/teb';
import type { TableColumn } from '../../../../shared/ui/EditableTable/EditableTable';
import { useTebEditorStore } from '../../store/useTebEditorStore';

export interface TextColumnDefinition<Row> {
  key: keyof Row & string;
  label: string;
  width?: string;
}

/**
 * Builds text-input columns for a TEB collection: edits are applied locally on change
 * and the row is sent to the server when the input loses focus.
 */
export function useCollectionColumns<K extends CollectionKey>(
  collection: K,
  definitions: TextColumnDefinition<CollectionRow<K>>[],
): TableColumn<CollectionRow<K>>[] {
  const updateCollectionField = useTebEditorStore((state) => state.updateCollectionField);
  const commitCollectionField = useTebEditorStore((state) => state.commitCollectionField);

  return definitions.map(({ key, label, width }) => ({
    key,
    label,
    width,
    render: (row, index) => (
      <input
        aria-label={label}
        value={String(row[key] ?? '')}
        onChange={(event) => updateCollectionField(collection, index, key, event.target.value)}
        onBlur={() => void commitCollectionField(collection, index)}
      />
    ),
  }));
}

export function useCollectionActions(collection: CollectionKey) {
  const addCollectionRow = useTebEditorStore((state) => state.addCollectionRow);
  const removeCollectionRow = useTebEditorStore((state) => state.removeCollectionRow);
  const moveCollectionRow = useTebEditorStore((state) => state.moveCollectionRow);

  return {
    onAdd: () => void addCollectionRow(collection),
    onRemove: (index: number) => void removeCollectionRow(collection, index),
    onMove: (index: number, direction: 'up' | 'down') => void moveCollectionRow(collection, index, direction),
  };
}
