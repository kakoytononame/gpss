import { useState } from 'react';
import deleteIcon from '../../../shared/assets/icons/gpss-native/delete_16.png';
import folderIcon from '../../../shared/assets/icons/gpss-native/folder_16.png';
import pasteIcon from '../../../shared/assets/icons/gpss-native/paste16.png';
import { parseBoundedNumber, type EditableSchemeField, type PropertyFieldRow } from './propertyRows';

type PropertyValueChange = (field: EditableSchemeField, value: string | number | boolean) => void;

interface PropertyValueProps {
  row: PropertyFieldRow;
  disabled: boolean;
  onChange: PropertyValueChange;
  onCommit: () => void;
  onOpenShapeGallery: () => void;
}

interface NumberPropertyInputProps {
  row: PropertyFieldRow & { field: EditableSchemeField };
  disabled: boolean;
  onChange: PropertyValueChange;
  onCommit: () => void;
}

/**
 * Keeps the typed text while editing and applies the clamped number on blur / Enter,
 * so intermediate values such as "1" on the way to "120" are not rejected by the minimum.
 */
function NumberPropertyInput({ row, disabled, onChange, onCommit }: NumberPropertyInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    if (draft !== null) {
      onChange(row.field, parseBoundedNumber(draft, Number(row.value ?? 0), row.min, row.max));
      setDraft(null);
    }

    onCommit();
  }

  return (
    <input
      className="property-input"
      disabled={disabled}
      type="number"
      min={row.min}
      max={row.max}
      value={draft ?? String(row.value ?? '')}
      aria-label={row.name}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          commit();
        } else if (event.key === 'Escape') {
          setDraft(null);
        }
      }}
    />
  );
}

function PropertyActions({ row, disabled, onOpenShapeGallery }: Pick<PropertyValueProps, 'row' | 'disabled' | 'onOpenShapeGallery'>) {
  const isShapeAction = row.actionKind !== 'image';

  return (
    <div className="property-actions">
      <button
        type="button"
        title={isShapeAction ? 'Выбрать форму тэба' : 'Выбрать файл'}
        disabled={disabled}
        onClick={isShapeAction ? onOpenShapeGallery : undefined}
      >
        {isShapeAction ? '▦' : <img src={folderIcon} alt="" aria-hidden="true" />}
      </button>
      <button type="button" title={isShapeAction ? 'Сбросить форму' : 'Вставить изображение'} disabled={disabled}>
        <img src={pasteIcon} alt="" aria-hidden="true" />
      </button>
      <button type="button" title={isShapeAction ? 'Удалить форму' : 'Удалить изображение'} disabled={disabled}>
        <img src={deleteIcon} alt="" aria-hidden="true" />
      </button>
    </div>
  );
}

export function PropertyValue({ row, disabled, onChange, onCommit, onOpenShapeGallery }: PropertyValueProps) {
  if (row.type === 'actions') {
    return <PropertyActions row={row} disabled={disabled} onOpenShapeGallery={onOpenShapeGallery} />;
  }

  const { field } = row;
  if (!field || row.type === 'readonly') {
    return <span className="property-value-text">{String(row.value ?? '')}</span>;
  }

  switch (row.type) {
    case 'checkbox':
      return (
        <input
          checked={Boolean(row.value)}
          className="property-check"
          disabled={disabled}
          type="checkbox"
          aria-label={row.name}
          onChange={(event) => {
            onChange(field, event.target.checked);
            onCommit();
          }}
        />
      );
    case 'color':
      return (
        <input
          className="property-color-input"
          disabled={disabled}
          type="color"
          value={String(row.value || '#000000')}
          aria-label={row.name}
          onBlur={onCommit}
          onChange={(event) => onChange(field, event.target.value)}
        />
      );
    case 'select':
      return (
        <select
          className="property-select"
          disabled={disabled}
          value={String(row.value ?? '')}
          aria-label={row.name}
          title={String(row.value ?? '')}
          onChange={(event) => {
            onChange(field, event.target.value);
            onCommit();
          }}
        >
          {(row.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    case 'number':
      return <NumberPropertyInput row={{ ...row, field }} disabled={disabled} onChange={onChange} onCommit={onCommit} />;
    default:
      return (
        <input
          className="property-input"
          disabled={disabled}
          type="text"
          value={String(row.value ?? '')}
          aria-label={row.name}
          onBlur={onCommit}
          onChange={(event) => onChange(field, event.target.value)}
        />
      );
  }
}
