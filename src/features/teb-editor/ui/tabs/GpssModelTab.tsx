import undoIcon from '../../../../shared/assets/icons/undo.png';
import redoIcon from '../../../../shared/assets/icons/redo.png';
import zoomInIcon from '../../../../shared/assets/icons/zoom-in.png';
import zoomOutIcon from '../../../../shared/assets/icons/zoom-out.png';
import zoomResetIcon from '../../../../shared/assets/icons/zoom-reset.png';
import saveIcon from '../../../../shared/assets/icons/save.png';
import { IconButton } from '../../../../shared/ui/IconButton/IconButton';
import { useTebEditorStore } from '../../store/useTebEditorStore';

export function GpssModelTab() {
  const text = useTebEditorStore((state) => state.teb?.gpssModel.text ?? '');
  const modelFontSize = useTebEditorStore((state) => state.modelFontSize);
  const updateGpssModelText = useTebEditorStore((state) => state.updateGpssModelText);
  const commitGpssModelText = useTebEditorStore((state) => state.commitGpssModelText);
  const undo = useTebEditorStore((state) => state.undo);
  const redo = useTebEditorStore((state) => state.redo);
  const zoomInModel = useTebEditorStore((state) => state.zoomInModel);
  const zoomOutModel = useTebEditorStore((state) => state.zoomOutModel);
  const resetModelZoom = useTebEditorStore((state) => state.resetModelZoom);
  const validateModel = useTebEditorStore((state) => state.validateModel);

  return (
    <div className="model-panel">
      <div className="model-toolbar" role="toolbar">
        <div className="toolbar-group">
          <IconButton icon={undoIcon} title="Отменить" compact onClick={undo} />
          <IconButton icon={redoIcon} title="Повторить" compact onClick={redo} />
        </div>
        <div className="toolbar-group">
          <IconButton icon={zoomInIcon} title="Увеличить текст" compact onClick={zoomInModel} />
          <IconButton icon={zoomOutIcon} title="Уменьшить текст" compact onClick={zoomOutModel} />
          <IconButton icon={zoomResetIcon} title="Сбросить масштаб" compact onClick={resetModelZoom} />
        </div>
        <div className="toolbar-group">
          <IconButton label="Проверить" title="Проверить модель" onClick={validateModel} />
          <IconButton icon={saveIcon} label="Сохранить" title="Отправить текст модели на сервер" onClick={() => void commitGpssModelText()} />
        </div>
      </div>
      <textarea
        className="gpss-textarea"
        style={{ fontSize: `${modelFontSize}px` }}
        spellCheck={false}
        value={text}
        onChange={(event) => updateGpssModelText(event.target.value)}
        onBlur={() => void commitGpssModelText()}
      />
    </div>
  );
}
