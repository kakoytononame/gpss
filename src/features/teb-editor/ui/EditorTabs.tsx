import type { TabId } from '../../../shared/types/teb';
import { EDITOR_TABS } from '../model/constants';

interface EditorTabsProps {
  visibleTabs: TabId[];
  activeTab: TabId;
  onSelect: (tabId: TabId) => void;
}

export function EditorTabs({ visibleTabs, activeTab, onSelect }: EditorTabsProps) {
  return (
    <div className="editor-tabs" role="tablist" aria-label="Разделы редактора">
      {EDITOR_TABS.filter((tab) => visibleTabs.includes(tab.id)).map((tab) => (
        <button
          className={`editor-tab ${activeTab === tab.id ? 'is-active' : ''}`}
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
