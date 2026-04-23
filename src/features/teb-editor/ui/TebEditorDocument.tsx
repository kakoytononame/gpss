import { useState } from 'react';
import { visibleTabsForType } from '../model/constants';
import { useTebEditorStore } from '../store/useTebEditorStore';
import { EditorTabs } from './EditorTabs';
import { GeneralTab } from './tabs/GeneralTab';
import { GpssModelTab } from './tabs/GpssModelTab';
import { GpssObjectsTab } from './tabs/GpssObjectsTab';
import { ParametersTab } from './tabs/ParametersTab';
import { PortsTab } from './tabs/PortsTab';
import { StatesTab } from './tabs/StatesTab';

function renderPanel(activeTab: ReturnType<typeof useTebEditorStore.getState>['activeTab']) {
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

function StatusPill() {
  const source = useTebEditorStore((state) => state.source);
  const syncStatus = useTebEditorStore((state) => state.syncStatus);
  const sourceLabel = source === 'api' ? 'API' : source === 'sample' ? 'Демо' : 'Старт';
  const syncLabel = syncStatus === 'syncing' ? 'Синхронизация' : syncStatus === 'saved' ? 'Сохранено' : syncStatus === 'offline' ? 'Локально' : 'Готово';

  return (
    <div className="status-pills">
      <span className={`status-pill status-pill--${source}`}>{sourceLabel}</span>
      <span className={`status-pill status-pill--${syncStatus}`}>{syncLabel}</span>
    </div>
  );
}

export function TebEditorDocument() {
  const teb = useTebEditorStore((state) => state.teb);
  const mode = useTebEditorStore((state) => state.mode);
  const loading = useTebEditorStore((state) => state.loading);
  const activeTab = useTebEditorStore((state) => state.activeTab);
  const setActiveTab = useTebEditorStore((state) => state.setActiveTab);
  const setMode = useTebEditorStore((state) => state.setMode);
  const refresh = useTebEditorStore((state) => state.refresh);
  const syncMessage = useTebEditorStore((state) => state.syncMessage);
  const loadError = useTebEditorStore((state) => state.loadError);
  const closeDocument = useTebEditorStore((state) => state.closeDocument);
  const [windowState, setWindowState] = useState<'normal' | 'minimized' | 'maximized'>('normal');

  const visibleTabs = visibleTabsForType(teb?.type);
  const titlePrefix = mode === 'instance' ? 'Экземпляр тэба' : 'Класс тэба';
  const isMinimized = windowState === 'minimized';

  return (
    <div className={`editor-window editor-window--${windowState}`} aria-busy={loading}>
      <header className="window-header">
        <div>
          <div className="window-title">{teb ? `${titlePrefix}: ${teb.header || teb.nameInModel || teb.type}` : 'Редактор ТЭБа'}</div>
          <div className="window-subtitle">{teb ? `${teb.nameInModel || 'Без имени'} · ${teb.type}` : 'Загрузка данных'}</div>
        </div>
        <div className="window-header__right">
          <StatusPill />
          <div className="window-controls">
            <button
              className="window-controls__button"
              type="button"
              aria-label={isMinimized ? 'Развернуть окно редактора' : 'Свернуть окно редактора'}
              title={isMinimized ? 'Развернуть окно редактора' : 'Свернуть окно редактора'}
              onClick={() => setWindowState((state) => (state === 'minimized' ? 'normal' : 'minimized'))}
            >
              -
            </button>
            <button
              className="window-controls__button"
              type="button"
              aria-label={windowState === 'maximized' ? 'Вернуть размер окна' : 'Развернуть окно'}
              title={windowState === 'maximized' ? 'Вернуть размер окна' : 'Развернуть окно'}
              onClick={() => setWindowState((state) => (state === 'maximized' ? 'normal' : 'maximized'))}
            >
              □
            </button>
            <button
              className="window-controls__button window-controls__button--close"
              type="button"
              aria-label="Закрыть окно редактора"
              title="Закрыть окно редактора"
              onClick={() => closeDocument('editor')}
            >
              x
            </button>
          </div>
        </div>
      </header>

      {!isMinimized ? (
        <>
          <div className="context-bar">
            <div className="segmented-control" aria-label="Режим редактора">
              <button className={mode === 'class' ? 'is-active' : ''} type="button" onClick={() => void setMode('class')}>
                Класс
              </button>
              <button className={mode === 'instance' ? 'is-active' : ''} type="button" onClick={() => void setMode('instance')}>
                Экземпляр
              </button>
            </div>
            <button className="reload-button" type="button" onClick={() => void refresh()}>
              Обновить
            </button>
          </div>

          <EditorTabs visibleTabs={visibleTabs} activeTab={activeTab} onSelect={setActiveTab} />

          <section className="editor-content">{loading && !teb ? <div className="loading-panel">Загрузка...</div> : renderPanel(activeTab)}</section>

          <footer className="status-bar">
            <span>{loadError || syncMessage}</span>
          </footer>
        </>
      ) : null}
    </div>
  );
}
