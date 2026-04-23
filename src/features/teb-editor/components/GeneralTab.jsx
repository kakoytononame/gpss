import { useTebEditorStore } from '../store/useTebEditorStore.js';
import { IconButton } from './IconButton.jsx';

export function GeneralTab() {
  const teb = useTebEditorStore((state) => state.teb);
  const updateGeneralField = useTebEditorStore((state) => state.updateGeneralField);
  const commitGeneralField = useTebEditorStore((state) => state.commitGeneralField);

  if (!teb) {
    return null;
  }

  return (
    <div className="general-grid">
      <section className="form-panel">
        <label className="field">
          <span>Имя в модели</span>
          <input
            value={teb.nameInModel}
            onBlur={() => commitGeneralField('nameInModel')}
            onChange={(event) => updateGeneralField('nameInModel', event.target.value)}
          />
        </label>
        <label className="field">
          <span>Заголовок</span>
          <input
            value={teb.header}
            onBlur={() => commitGeneralField('header')}
            onChange={(event) => updateGeneralField('header', event.target.value)}
          />
        </label>
        <label className="field">
          <span>Тип класса</span>
          <input value={teb.type} readOnly />
        </label>
      </section>

      <section className="form-panel form-panel--wide">
        <label className="field field--stretch">
          <span>Описание</span>
          <textarea
            value={teb.description}
            onBlur={() => commitGeneralField('description')}
            onChange={(event) => updateGeneralField('description', event.target.value)}
          />
        </label>
      </section>

      <section className="form-panel image-panel">
        <div className="field-label">Изображение</div>
        <div className="image-actions">
          <IconButton icon="..." label="Выбрать" title="Выбрать изображение" disabled />
          <IconButton icon="x" label="Удалить" title="Удалить изображение" disabled />
        </div>
        <div className="image-preview">
          <span>{teb.imageName || 'Изображение не выбрано'}</span>
        </div>
      </section>
    </div>
  );
}
