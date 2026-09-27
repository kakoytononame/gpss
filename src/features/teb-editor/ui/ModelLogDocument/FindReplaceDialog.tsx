import { useEffect, useRef, useState, type PointerEvent } from 'react';
import closeIcon from '../../../../shared/assets/icons/gpss-native/closeblack_13.png';
import appLogoIcon from '../../../../shared/assets/icons/gpss-native/elinalogo_20x22.png';

export type SearchDialogMode = 'find' | 'replace';

interface FindReplaceDialogProps {
  mode: SearchDialogMode;
  query: string;
  replacement: string;
  searchUp: boolean;
  onModeChange: (mode: SearchDialogMode) => void;
  onQueryChange: (value: string) => void;
  onReplacementChange: (value: string) => void;
  onSearchUpChange: (value: boolean) => void;
  onFindNext: () => void;
  onReplace: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
}

const VIEWPORT_MARGIN = 8;

/** Non-modal, draggable "Поиск и замена" window. */
export function FindReplaceDialog(props: FindReplaceDialogProps) {
  const {
    mode,
    query,
    replacement,
    searchUp,
    onModeChange,
    onQueryChange,
    onReplacementChange,
    onSearchUpChange,
    onFindNext,
    onReplace,
    onReplaceAll,
    onClose,
  } = props;
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const queryInputRef = useRef<HTMLInputElement | null>(null);
  const [position, setPosition] = useState(() => ({ x: Math.max(80, window.innerWidth / 2 - 230), y: 260 }));

  useEffect(() => {
    queryInputRef.current?.focus();
  }, [mode]);

  function handleTitlePointerDown(event: PointerEvent<HTMLDivElement>) {
    const dialog = dialogRef.current;
    if (!dialog || (event.target as HTMLElement).closest('button')) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    const dialogRect = dialog.getBoundingClientRect();
    const offsetX = event.clientX - dialogRect.left;
    const offsetY = event.clientY - dialogRect.top;

    function handleMove(moveEvent: globalThis.PointerEvent) {
      const maxX = Math.max(VIEWPORT_MARGIN, window.innerWidth - dialogRect.width - VIEWPORT_MARGIN);
      const maxY = Math.max(VIEWPORT_MARGIN, window.innerHeight - dialogRect.height - VIEWPORT_MARGIN);
      setPosition({
        x: Math.min(Math.max(VIEWPORT_MARGIN, moveEvent.clientX - offsetX), maxX),
        y: Math.min(Math.max(VIEWPORT_MARGIN, moveEvent.clientY - offsetY), maxY),
      });
    }

    function handleUp() {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    }

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }

  return (
    <div
      ref={dialogRef}
      className="find-replace-dialog"
      role="dialog"
      aria-modal="false"
      aria-label="Поиск и замена"
      style={{ left: position.x, top: position.y }}
    >
      <div className="find-replace-dialog__titlebar" onPointerDown={handleTitlePointerDown}>
        <img src={appLogoIcon} alt="" aria-hidden="true" />
        <span>Поиск и замена</span>
        <button type="button" aria-label="Закрыть" title="Закрыть" onClick={onClose}>
          <img src={closeIcon} alt="" aria-hidden="true" />
        </button>
      </div>

      <div className="find-replace-dialog__tabs" role="tablist" aria-label="Режим поиска">
        <button className={mode === 'find' ? 'is-active' : ''} type="button" role="tab" aria-selected={mode === 'find'} onClick={() => onModeChange('find')}>
          Поиск
        </button>
        <button
          className={mode === 'replace' ? 'is-active' : ''}
          type="button"
          role="tab"
          aria-selected={mode === 'replace'}
          onClick={() => onModeChange('replace')}
        >
          Замена
        </button>
      </div>

      <div className="find-replace-dialog__body">
        <label>
          <span>Найти:</span>
          <input
            ref={queryInputRef}
            className="find-replace-dialog__field"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onFindNext();
              }
            }}
          />
        </label>

        {mode === 'replace' ? (
          <label>
            <span>Заменить на:</span>
            <input value={replacement} onChange={(event) => onReplacementChange(event.target.value)} />
          </label>
        ) : null}

        <div className="find-replace-dialog__options">
          <span>Опции:</span>
          <label>
            <input type="checkbox" checked={searchUp} onChange={(event) => onSearchUpChange(event.target.checked)} />
            <span>Искать вверх</span>
          </label>
        </div>

        <div className="find-replace-dialog__actions">
          <button type="button" onClick={onFindNext}>
            Искать далее
          </button>
          {mode === 'replace' ? (
            <>
              <button type="button" onClick={onReplace}>
                Заменить
              </button>
              <button type="button" onClick={onReplaceAll}>
                Заменить все
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
