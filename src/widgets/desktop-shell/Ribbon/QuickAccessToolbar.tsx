import { useCallback, useRef, useState } from 'react';
import arrowDownIcon from '../../../shared/assets/icons/arrow-down.png';
import { useDismissOnOutsideClick } from '../../../shared/lib/hooks/useDismissOnOutsideClick';
import type { RibbonCommand } from './ribbonTypes';

interface QuickAccessToolbarProps {
  commands: RibbonCommand[];
  onMenuOpen: () => void;
}

export function QuickAccessToolbar({ commands, onMenuOpen }: QuickAccessToolbarProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [visibleIds, setVisibleIds] = useState(() => commands.map((command) => command.id));
  const closeMenu = useCallback(() => setIsMenuOpen(false), []);
  useDismissOnOutsideClick(menuRef, isMenuOpen, closeMenu);

  function toggleCommand(commandId: string) {
    setVisibleIds((current) => {
      if (!current.includes(commandId)) {
        return [...current, commandId];
      }

      // At least one command stays on the toolbar.
      return current.length === 1 ? current : current.filter((item) => item !== commandId);
    });
  }

  return (
    <>
      <div className="quick-access" aria-label="Быстрый доступ">
        {commands
          .filter((command) => visibleIds.includes(command.id))
          .map((command) => (
            <button
              key={command.id}
              type="button"
              title={command.label}
              aria-label={command.label}
              data-testid={`quick-command-${command.id}`}
              onClick={command.onClick}
            >
              <img src={command.icon} alt="" aria-hidden="true" />
            </button>
          ))}
      </div>

      <div className="quick-access-menu" ref={menuRef}>
        <button
          className="quick-access__drop"
          type="button"
          title="Настройка панели быстрого доступа"
          aria-label="Настройка панели быстрого доступа"
          aria-expanded={isMenuOpen}
          onClick={() => {
            onMenuOpen();
            setIsMenuOpen((value) => !value);
          }}
        >
          <img src={arrowDownIcon} alt="" aria-hidden="true" />
        </button>

        {isMenuOpen ? (
          <div className="quick-access-popover">
            <div className="quick-access-popover__title">Панель быстрого доступа</div>
            <div className="quick-access-popover__items">
              {commands.map((command) => (
                <label className="quick-access-popover__item" key={command.id}>
                  <input checked={visibleIds.includes(command.id)} type="checkbox" onChange={() => toggleCommand(command.id)} />
                  <img src={command.icon} alt="" aria-hidden="true" />
                  <span>{command.label}</span>
                </label>
              ))}
            </div>
            <button className="quick-access-popover__reset" type="button" onClick={() => setVisibleIds(commands.map((command) => command.id))}>
              Показать все команды
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
