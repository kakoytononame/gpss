import { useTebEditorStore } from '../../../features/teb-editor/store/useTebEditorStore';
import arrowDownIcon from '../../../shared/assets/icons/gpss-native/arrowdown_16.png';
import closeIcon from '../../../shared/assets/icons/gpss-native/closeblack_13.png';
import type { RightPanelTab } from '../../../shared/types/teb';
import { PropertiesView } from './PropertiesView';
import { TestsView } from './TestsView';
import './RightDockPanel.css';

const PANEL_TABS: Array<{ id: RightPanelTab; title: string }> = [
  { id: 'properties', title: 'Свойства' },
  { id: 'teb-tests', title: 'Тесты ТЭБов' },
];

function PanelCaption({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="right-dock-caption">
      <span className="right-dock-caption__title">{title}</span>
      <span className="right-dock-caption__grip" aria-hidden="true">
        ..................................................
      </span>
      <button className="right-dock-caption__button" type="button" title="Меню панели" aria-label="Меню панели">
        <img src={arrowDownIcon} alt="" aria-hidden="true" />
      </button>
      <button className="right-dock-caption__button" type="button" title="Закрыть панель" aria-label="Закрыть панель" onClick={onClose}>
        <img src={closeIcon} alt="" aria-hidden="true" />
      </button>
    </div>
  );
}

export function RightDockPanel() {
  const rightPanelTab = useTebEditorStore((state) => state.rightPanelTab);
  const setRightPanelTab = useTebEditorStore((state) => state.setRightPanelTab);
  const toggleRightPanel = useTebEditorStore((state) => state.toggleRightPanel);
  const title = PANEL_TABS.find((tab) => tab.id === rightPanelTab)?.title ?? '';

  return (
    <aside className="right-dock-panel" aria-label={title}>
      <PanelCaption title={title} onClose={toggleRightPanel} />
      <div className="right-dock-content">{rightPanelTab === 'properties' ? <PropertiesView /> : <TestsView />}</div>
      <div className="right-dock-tabs" role="tablist" aria-label="Правая панель">
        {PANEL_TABS.map((tab) => (
          <button
            className={rightPanelTab === tab.id ? 'is-active' : ''}
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={rightPanelTab === tab.id}
            onClick={() => setRightPanelTab(tab.id)}
          >
            {tab.title}
          </button>
        ))}
      </div>
    </aside>
  );
}
