import { useCallback, useState } from 'react';
import { useTebEditorStore } from '../../../features/teb-editor/store/useTebEditorStore';
import { classNames } from '../../../shared/lib/utils';
import type { ActiveDocument } from '../../../shared/types/teb';
import { AppMenu } from './AppMenu';
import { QuickAccessToolbar } from './QuickAccessToolbar';
import { RIBBON_COMMANDS } from './ribbonCommands';
import { BASE_RIBBON_TABS, JOURNAL_TAB, REPORT_TAB, type RibbonTabId } from './ribbonTypes';
import './Ribbon.css';

/** Contextual tab shown (and selected) while the matching document is active. */
function contextualTabFor(activeDocument: ActiveDocument | null): RibbonTabId | null {
  if (activeDocument === 'std-report') {
    return REPORT_TAB;
  }

  if (activeDocument === 'model-log') {
    return JOURNAL_TAB;
  }

  return null;
}

export function Ribbon() {
  const activeDocument = useTebEditorStore((state) => state.activeDocument);
  const setStatusMessage = useTebEditorStore((state) => state.setStatusMessage);
  const [isAppMenuOpen, setIsAppMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<RibbonTabId>('Главная');
  const [tabDocument, setTabDocument] = useState(activeDocument);
  const contextualTab = contextualTabFor(activeDocument);

  // Switching documents selects the contextual tab, or leaves a contextual tab that is no longer available.
  if (tabDocument !== activeDocument) {
    setTabDocument(activeDocument);
    setActiveTab((current) => contextualTab ?? (BASE_RIBBON_TABS.includes(current) ? current : 'Главная'));
  }

  const visibleTabs = contextualTab ? [...BASE_RIBBON_TABS, contextualTab] : BASE_RIBBON_TABS;
  const closeAppMenu = useCallback(() => setIsAppMenuOpen(false), []);

  function handleTabClick(tab: RibbonTabId) {
    setActiveTab(tab);
    setIsAppMenuOpen(false);
    setStatusMessage(`Открыта вкладка ленты: ${tab}.`, 'saved');
  }

  function handleAppMenuToggle() {
    setIsAppMenuOpen((current) => !current);
    setStatusMessage('Открыто меню GPSS Studio.', 'saved');
  }

  return (
    <header
      className={classNames(
        'desktop-chrome',
        contextualTab === JOURNAL_TAB && 'desktop-chrome--journal',
        contextualTab === REPORT_TAB && 'desktop-chrome--report',
      )}
    >
      <div className="title-row">
        <QuickAccessToolbar commands={RIBBON_COMMANDS.quickAccess} onMenuOpen={closeAppMenu} />
        <div className="desktop-title">Элина-Компьютер - GPSS Studio (студенческая версия)</div>
        {contextualTab === REPORT_TAB ? <div className="title-context-label title-context-label--report">Редактор отчётов</div> : null}
        {contextualTab === JOURNAL_TAB ? <div className="title-context-label title-context-label--journal">Редактор журнала</div> : null}
      </div>

      <nav className="ribbon-tabs" aria-label="Разделы ленты">
        <AppMenu entries={RIBBON_COMMANDS.appMenu} isOpen={isAppMenuOpen} onToggle={handleAppMenuToggle} onClose={closeAppMenu} />

        {visibleTabs.map((tab) => (
          <button
            className={classNames(
              'ribbon-tab',
              tab === REPORT_TAB && 'ribbon-tab--report',
              tab === JOURNAL_TAB && 'ribbon-tab--journal',
              activeTab === tab && 'is-active',
            )}
            key={tab}
            type="button"
            aria-pressed={activeTab === tab}
            onClick={() => handleTabClick(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      <div className="ribbon-band">
        {RIBBON_COMMANDS.groupsByTab[activeTab].map((group) => (
          <section className={classNames('ribbon-group', group.className)} key={group.title} aria-label={group.title}>
            <div className="ribbon-commands">
              {group.commands.map((command) => (
                <button className="ribbon-command" key={command.id} type="button" data-testid={`ribbon-command-${command.id}`} onClick={command.onClick}>
                  <img className="ribbon-command__icon-image" src={command.icon} alt="" aria-hidden="true" />
                  <span>{command.label}</span>
                </button>
              ))}
            </div>
            <div className="ribbon-group__title">{group.title}</div>
          </section>
        ))}
      </div>
    </header>
  );
}
