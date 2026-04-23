import { useEffect } from 'react';
import { EDITOR_TABS, visibleTabsForType } from '../model/tebEditorModel.js';
import { useTebEditorStore } from '../store/useTebEditorStore.js';
import { EditorTabs } from './EditorTabs.jsx';
import { GeneralTab } from './GeneralTab.jsx';
import { GpssModelTab } from './GpssModelTab.jsx';
import { GpssObjectsTab } from './GpssObjectsTab.jsx';
import { ParametersTab } from './ParametersTab.jsx';
import { PortsTab } from './PortsTab.jsx';
import { StatesTab } from './StatesTab.jsx';

function StatusPill({ source, syncStatus }) {
  const labels = {
    api: 'API',
    sample: 'Демо',
    idle: 'Старт',
  };

  return (
    <div className="status-pills" aria-live="polite">
      <span className={`status-pill status-pill--${source}`}>{labels[source] || source}</span>
      <span className={`status-pill status-pill--${syncStatus}`}>{syncStatus === 'syncing' ? 'Синхронизация' : syncStatus === 'saved' ? 'Сохранено' : syncStatus === 'offline' ? 'Локально' : 'Готово'}</span>
    </div>
  );
}

function renderPanel(activeTab) {
  switch (activeTab) {
    case 'general':
      return <GeneralTab />;
    case 'gpss-model':
      return <GpssModelTab />;
    case 'gpss-objects':
      return <GpssObjectsTab />;
    case 'inputs':
      return <PortsTab collection="inputs" />;
    case 'outputs':
      return <PortsTab collection="outputs" />;
    case 'parameters':
      return <ParametersTab />;
    case 'states':
      return <StatesTab />;
    default:
      return <GeneralTab />;
  }
}

export function TebEditorPage() {
  const teb = useTebEditorStore((state) => state.teb);
  const mode = useTebEditorStore((state) => state.mode);
  const loading = useTebEditorStore((state) => state.loading);
  const source = useTebEditorStore((state) => state.source);
  const loadError = useTebEditorStore((state) => state.loadError);
  const syncStatus = useTebEditorStore((state) => state.syncStatus);
  const syncMessage = useTebEditorStore((state) => state.syncMessage);
  const activeTab = useTebEditorStore((state) => state.activeTab);
  const load = useTebEditorStore((state) => state.load);
  const setMode = useTebEditorStore((state) => state.setMode);
  const setActiveTab = useTebEditorStore((state) => state.setActiveTab);

  useEffect(() => {
    load();
  }, [load]);

  const visibleTabs = visibleTabsForType(teb?.type);
  const titlePrefix = mode === 'instance' ? 'Экземпляр тэба' : 'Класс тэба';
  const activeTabLabel = EDITOR_TABS.find((tab) => tab.id === activeTab)?.label ?? '';

  return (
    <main className="app-shell">
      <div className="editor-window" aria-busy={loading}>
        <header className="window-header">
          <div>
            <div className="window-title">{teb ? `${titlePrefix}: ${teb.header || teb.nameInModel || teb.type}` : 'Редактор тэба'}</div>
            <div className="window-subtitle">{teb ? `${teb.nameInModel || 'Без имени'} · ${teb.type} · ${activeTabLabel}` : 'Загрузка данных'}</div>
          </div>
          <div className="window-header__right">
            <StatusPill source={source} syncStatus={syncStatus} />
            <div className="window-controls" aria-hidden="true">
              <span>-</span>
              <span>□</span>
              <span>x</span>
            </div>
          </div>
        </header>

        <div className="context-bar">
          <div className="segmented-control" aria-label="Режим редактора">
            <button className={mode === 'class' ? 'is-active' : ''} type="button" onClick={() => setMode('class')}>
              Класс
            </button>
            <button className={mode === 'instance' ? 'is-active' : ''} type="button" onClick={() => setMode('instance')}>
              Экземпляр
            </button>
          </div>
          <button className="reload-button" type="button" onClick={load}>
            Обновить
          </button>
        </div>

        <EditorTabs visibleTabs={visibleTabs} activeTab={activeTab} onSelect={setActiveTab} />

        <section className="editor-content" aria-label={activeTabLabel}>
          {loading && !teb ? <div className="loading-panel">Загрузка...</div> : renderPanel(activeTab)}
        </section>

        <footer className="status-bar">
          <span>{loadError || syncMessage}</span>
        </footer>
      </div>
    </main>
  );
}
