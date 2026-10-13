import { useState, type ReactNode } from 'react';
import type { SourceKind, SyncStatus, TabId } from '../../../../shared/types/teb';
import { visibleTabsForType } from '../../model/constants';
import { useTebEditorStore } from '../../store/useTebEditorStore';
import { EditorTabs } from '../EditorTabs/EditorTabs';
import { GeneralTab } from '../tabs/GeneralTab';
import { GpssModelTab } from '../tabs/GpssModelTab';
import { GpssObjectsTab } from '../tabs/GpssObjectsTab';
import { ParametersTab } from '../tabs/ParametersTab';
import { PortsTab } from '../tabs/PortsTab';
import { StatesTab } from '../tabs/StatesTab';
import './TebEditorDocument.css';

type WindowState = 'normal' | 'minimized' | 'maximized';

const TAB_PANELS: Record<TabId, () => ReactNode> = {
  general: () => <GeneralTab />,
  'gpss-model': () => <GpssModelTab />,
  'gpss-objects': () => <GpssObjectsTab />,
  inputs: () => <PortsTab collection="inputs" />,
  outputs: () => <PortsTab collection="outputs" />,
  parameters: () => <ParametersTab />,
  states: () => <StatesTab />,
};

const SOURCE_LABELS: Record<SourceKind, string> = {
  api: 'API',
  sample: 'Демо',
  idle: 'Старт',
  project: 'Проект',
};

const SYNC_LABELS: Record<SyncStatus, string> = {
  idle: 'Готово',
  syncing: 'Синхронизация',
  saved: 'Сохранено',
  warning: 'Внимание',
  offline: 'Локально',
};

function StatusPills() {
  const source = useTebEditorStore((state) => state.source);
  const syncStatus = useTebEditorStore((state) => state.syncStatus);

  return (
    <div className="status-pills">
      <span className={`status-pill status-pill--${source}`}>{SOURCE_LABELS[source]}</span>
      <span className={`status-pill status-pill--${syncStatus}`}>{SYNC_LABELS[syncStatus]}</span>
    </div>
  );
}

interface WindowControlsProps {
  windowState: WindowState;
  onToggleMinimized: () => void;
  onToggleMaximized: () => void;
  onClose: () => void;
}

function WindowControls({ windowState, onToggleMinimized, onToggleMaximized, onClose }: WindowControlsProps) {
  const minimizeLabel = windowState === 'minimized' ? 'Развернуть окно редактора' : 'Свернуть окно редактора';
  const maximizeLabel = windowState === 'maximized' ? 'Вернуть размер окна' : 'Развернуть окно';

  return (
    <div className="window-controls">
      <button className="window-controls__button" type="button" aria-label={minimizeLabel} title={minimizeLabel} onClick={onToggleMinimized}>
        -
      </button>
      <button className="window-controls__button" type="button" aria-label={maximizeLabel} title={maximizeLabel} onClick={onToggleMaximized}>
        □
      </button>
      <button
        className="window-controls__button window-controls__button--close"
        type="button"
        aria-label="Закрыть окно редактора"
        title="Закрыть окно редактора"
        onClick={onClose}
      >
        x
      </button>
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
  const [windowState, setWindowState] = useState<WindowState>('normal');

  const titlePrefix = mode === 'instance' ? 'Экземпляр тэба' : 'Класс тэба';
  const isMinimized = windowState === 'minimized';
  const toggleWindowState = (target: Exclude<WindowState, 'normal'>) => setWindowState((state) => (state === target ? 'normal' : target));

  return (
    <div className={`editor-window editor-window--${windowState}`} aria-busy={loading}>
      <header className="window-header">
        <div>
          <div className="window-title">{teb ? `${titlePrefix}: ${teb.header || teb.nameInModel || teb.type}` : 'Редактор ТЭБа'}</div>
          <div className="window-subtitle">{teb ? `${teb.nameInModel || 'Без имени'} · ${teb.type}` : 'Загрузка данных'}</div>
        </div>
        <div className="window-header__right">
          <StatusPills />
          <WindowControls
            windowState={windowState}
            onToggleMinimized={() => toggleWindowState('minimized')}
            onToggleMaximized={() => toggleWindowState('maximized')}
            onClose={() => closeDocument('editor')}
          />
        </div>
      </header>

      {isMinimized ? null : (
        <>
          <div className="context-bar">
            <div className="segmented-control" aria-label="Режим редактора">
              <button className={mode === 'class' ? 'is-active' : ''} type="button" aria-pressed={mode === 'class'} onClick={() => void setMode('class')}>
                Класс
              </button>
              <button
                className={mode === 'instance' ? 'is-active' : ''}
                type="button"
                aria-pressed={mode === 'instance'}
                onClick={() => void setMode('instance')}
              >
                Экземпляр
              </button>
            </div>
            <button className="reload-button" type="button" onClick={() => void refresh()}>
              Обновить
            </button>
          </div>

          <EditorTabs visibleTabs={visibleTabsForType(teb?.type)} activeTab={activeTab} onSelect={setActiveTab} />

          <section className="editor-content" role="tabpanel">
            {loading && !teb ? <div className="loading-panel">Загрузка...</div> : TAB_PANELS[activeTab]()}
          </section>

          <footer className="status-bar">
            <span>{loadError || syncMessage}</span>
          </footer>
        </>
      )}
    </div>
  );
}
