import { useRef } from 'react';
import { useTebEditorStore } from '../../store/useTebEditorStore';
import { IconButton } from '../../../../shared/ui/IconButton/IconButton';

export function GeneralTab() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const teb = useTebEditorStore((state) => state.teb);
  const updateGeneralField = useTebEditorStore((state) => state.updateGeneralField);
  const commitGeneralField = useTebEditorStore((state) => state.commitGeneralField);
  const attachImage = useTebEditorStore((state) => state.attachImage);
  const removeImage = useTebEditorStore((state) => state.removeImage);

  if (!teb) {
    return null;
  }

  return (
    <div className="general-grid">
      <section className="form-panel">
        <label className="field">
          <span>Имя в модели</span>
          <input value={teb.nameInModel} onChange={(event) => updateGeneralField('nameInModel', event.target.value)} onBlur={() => void commitGeneralField('nameInModel')} />
        </label>
        <label className="field">
          <span>Заголовок</span>
          <input value={teb.header} onChange={(event) => updateGeneralField('header', event.target.value)} onBlur={() => void commitGeneralField('header')} />
        </label>
        <label className="field">
          <span>Тип класса</span>
          <input value={teb.type} readOnly />
        </label>
      </section>

      <section className="form-panel form-panel--wide">
        <label className="field field--stretch">
          <span>Описание</span>
          <textarea value={teb.description} onChange={(event) => updateGeneralField('description', event.target.value)} onBlur={() => void commitGeneralField('description')} />
        </label>
      </section>

      <section className="form-panel image-panel">
        <div className="field-label">Изображение</div>
        <input
          ref={inputRef}
          hidden
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void attachImage(file);
            }
            event.currentTarget.value = '';
          }}
        />
        <div className="image-actions">
          <IconButton label="Выбрать" title="Загрузить изображение" onClick={() => inputRef.current?.click()} />
          <IconButton label="Удалить" title="Удалить изображение" onClick={removeImage} disabled={!teb.imageUrl && !teb.imageName} />
        </div>
        <div className="image-preview">
          {teb.imageUrl ? <img className="image-preview__img" src={teb.imageUrl} alt={teb.imageName || 'Превью'} /> : <span>{teb.imageName || 'Изображение не выбрано'}</span>}
        </div>
      </section>
    </div>
  );
}
