import { EDITOR_TABS } from '../model/tebEditorModel.js';

export function EditorTabs({ visibleTabs, activeTab, onSelect }) {
  return (
    <div className="editor-tabs" role="tablist" aria-label="Разделы редактора тэба">
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
