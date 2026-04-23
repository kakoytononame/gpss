import { useTebEditorStore } from '../store/useTebEditorStore.js';
import { IconButton } from './IconButton.jsx';

export function GpssModelTab() {
  const text = useTebEditorStore((state) => state.teb?.gpssModel?.text ?? '');
  const updateGpssModelText = useTebEditorStore((state) => state.updateGpssModelText);
  const commitGpssModelText = useTebEditorStore((state) => state.commitGpssModelText);

  return (
    <div className="model-panel">
      <div className="model-toolbar" role="toolbar">
        <div className="toolbar-group">
          <IconButton icon="↺" title="Отменить" disabled />
          <IconButton icon="↻" title="Повторить" disabled />
        </div>
        <div className="toolbar-group">
          <IconButton icon="⌕+" title="Увеличить" disabled />
          <IconButton icon="⌕-" title="Уменьшить" disabled />
        </div>
        <div className="toolbar-group">
          <IconButton icon="⎙" title="Проверить модель" disabled />
          <IconButton icon="✓" title="Отправить текст модели" onClick={commitGpssModelText} />
        </div>
      </div>
      <textarea
        className="gpss-textarea"
        spellCheck="false"
        value={text}
        onBlur={commitGpssModelText}
        onChange={(event) => updateGpssModelText(event.target.value)}
      />
    </div>
  );
}
