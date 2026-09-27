import { useCallback, useRef } from 'react';
import { useDismissOnOutsideClick } from '../../../shared/lib/hooks/useDismissOnOutsideClick';
import type { AppMenuEntry, AppMenuItem } from './ribbonTypes';

const GLYPHS: Record<NonNullable<AppMenuItem['glyph']>, string> = {
  question: '?',
  info: 'i',
  exit: '×',
};

interface AppMenuProps {
  entries: AppMenuEntry[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

/** "GPSS Studio" application button with its backstage-like drop-down menu. */
export function AppMenu({ entries, isOpen, onToggle, onClose }: AppMenuProps) {
  const slotRef = useRef<HTMLDivElement | null>(null);
  const close = useCallback(() => onClose(), [onClose]);
  useDismissOnOutsideClick(slotRef, isOpen, close);

  return (
    <div className="ribbon-app-slot" ref={slotRef}>
      <button className={`ribbon-app-button ${isOpen ? 'is-open' : ''}`} type="button" aria-haspopup="menu" aria-expanded={isOpen} onClick={onToggle}>
        GPSS Studio
      </button>

      {isOpen ? (
        <div className="app-menu" role="menu" aria-label="Меню GPSS Studio">
          {entries.map((item, index) =>
            item === 'divider' ? (
              <div className="app-menu__divider" key={`divider-${index}`} />
            ) : (
              <button
                className={`app-menu__item ${item.tone === 'danger' ? 'is-danger' : ''}`}
                key={item.id}
                role="menuitem"
                type="button"
                onClick={() => {
                  onClose();
                  item.onClick();
                }}
              >
                <span className="app-menu__item-icon" aria-hidden="true">
                  {item.icon ? (
                    <img src={item.icon} alt="" />
                  ) : item.glyph ? (
                    <span className={`app-menu__glyph app-menu__glyph--${item.glyph}`} aria-hidden="true">
                      {GLYPHS[item.glyph]}
                    </span>
                  ) : null}
                </span>
                <span className="app-menu__item-label">{item.label}</span>
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
