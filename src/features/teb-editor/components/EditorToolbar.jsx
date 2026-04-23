import { IconButton } from './IconButton.jsx';

export function EditorToolbar({ onAdd, onRemove, onMoveUp, onMoveDown, selectedIndex, disableReorder = false }) {
  const hasSelection = selectedIndex >= 0;

  return (
    <div className="editor-toolbar" role="toolbar">
      {onAdd ? <IconButton icon="+" label="Добавить" title="Добавить строку" onClick={onAdd} /> : null}
      {onRemove ? (
        <IconButton icon="x" label="Удалить" title="Удалить выбранную строку" disabled={!hasSelection} onClick={onRemove} />
      ) : null}
      {onMoveUp ? (
        <IconButton icon="↑" title="Переместить выше" disabled={!hasSelection || disableReorder} onClick={onMoveUp} />
      ) : null}
      {onMoveDown ? (
        <IconButton icon="↓" title="Переместить ниже" disabled={!hasSelection || disableReorder} onClick={onMoveDown} />
      ) : null}
    </div>
  );
}
