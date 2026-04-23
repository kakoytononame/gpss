import saveIcon from '../../../shared/assets/icons/save.png';
import { IconButton } from '../../../shared/ui/IconButton';
import { useTebEditorStore } from '../store/useTebEditorStore';

export function ModelTextDocument() {
  const text = useTebEditorStore((state) => state.teb?.gpssModel.text ?? '');
  const modelFontSize = useTebEditorStore((state) => state.modelFontSize);
  const updateGpssModelText = useTebEditorStore((state) => state.updateGpssModelText);
  const commitGpssModelText = useTebEditorStore((state) => state.commitGpssModelText);
  const validateModel = useTebEditorStore((state) => state.validateModel);

  return (
    <section className="placeholder-document">
      <div className="placeholder-document__header">
        <h2>Текст модели</h2>
        <div className="placeholder-document__actions">
          <IconButton icon={saveIcon} label="Сохранить" title="Сохранить текст модели" onClick={() => void commitGpssModelText()} />
          <IconButton label="Проверить" title="Проверить модель" onClick={validateModel} />
        </div>
      </div>
      <textarea className="gpss-textarea gpss-textarea--document" style={{ fontSize: `${modelFontSize}px` }} value={text} onChange={(event) => updateGpssModelText(event.target.value)} onBlur={() => void commitGpssModelText()} />
    </section>
  );
}
