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

const ribbonTabs = ['GPSS Studio', 'Главная', 'Моделирование', 'Окна'];

const ribbonGroups = [
  {
    title: 'Проекты',
    commands: [
      ['N', 'Создать проект'],
      ['O', 'Открыть проект / Управление'],
    ],
  },
  {
    title: 'Файлы',
    commands: [
      ['M', 'Создать модель'],
      ['F', 'Открыть файл'],
    ],
  },
  {
    title: 'Открытые документы',
    commands: [
      ['S', 'Сохранить'],
      ['A', 'Сохранить все'],
      ['?', 'Сохранить как...'],
    ],
  },
];

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

function QuickAccessToolbar() {
  return (
    <div className="quick-access" aria-label="Быстрый доступ">
      {['G', 'S', 'O', 'N', 'Run', 'Stop'].map((icon, index) => (
        <button key={`${icon}-${index}`} type="button" title="Команда быстрого доступа">
          {icon}
        </button>
      ))}
      <button className="quick-access__drop" type="button" title="Настройка панели">
        v
      </button>
    </div>
  );
}

function Ribbon() {
  return (
    <header className="desktop-chrome">
      <div className="title-row">
        <QuickAccessToolbar />
        <div className="desktop-title">Элина-Компьютер - GPSS Studio (студенческая версия)</div>
      </div>

      <nav className="ribbon-tabs" aria-label="Разделы ленты">
        {ribbonTabs.map((tab) => (
          <button className={tab === 'GPSS Studio' ? 'is-app-tab' : ''} key={tab} type="button">
            {tab}
          </button>
        ))}
      </nav>

      <div className="ribbon-band">
        {ribbonGroups.map((group) => (
          <section className="ribbon-group" key={group.title}>
            <div className="ribbon-commands">
              {group.commands.map(([icon, label]) => (
                <button className="ribbon-command" key={label} type="button">
                  <span className="ribbon-command__icon">{icon}</span>
                  <span>{label}</span>
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

function TreeItem({ label, level = 0, active = false, open = false, icon = 'folder', children }) {
  return (
    <div>
      <div className={`tree-row ${active ? 'is-active' : ''}`} style={{ '--level': level }}>
        <span className="tree-row__chevron">{children ? (open ? 'v' : '>') : ''}</span>
        <span className={`tree-row__icon tree-row__icon--${icon}`} />
        <span className="tree-row__label">{label}</span>
      </div>
      {open ? children : null}
    </div>
  );
}

function ProjectExplorer() {
  return (
    <aside className="project-explorer">
      <div className="panel-caption">
        <span>Текущий проект</span>
        <span className="panel-caption__tools">v  |  x</span>
      </div>
      <div className="project-search">Поиск в проекте (F3)</div>
      <div className="tree-view">
        <TreeItem label="Столовая" level={0} open icon="project">
          <TreeItem label="Модели" level={1} open icon="model">
            <TreeItem label="Столовая (текущая модель)" level={2} open icon="model">
              <TreeItem label="Структурная схема" level={3} icon="scheme" />
              <TreeItem label="Текст модели" level={3} icon="text" />
              <TreeItem label="Файлы с данными" level={3} icon="folder" />
            </TreeItem>
            <TreeItem label="Моделирование от 10.08.2018 10:59" level={2} open icon="run">
              <TreeItem label="Стандартный отчет" level={3} icon="table" />
              <TreeItem label="Журнал моделирования" level={3} icon="text" />
            </TreeItem>
            <TreeItem label="Формы" level={2} open icon="form">
              <TreeItem label="Столовая" level={3} icon="form" />
            </TreeItem>
          </TreeItem>
          <TreeItem label="Библиотеки ТЭБов проекта" level={1} open icon="library">
            <TreeItem label="Библиотека ТЭБов" level={2} active icon="library" />
          </TreeItem>
          <TreeItem label="Библиотеки C#" level={1} icon="code" />
        </TreeItem>
      </div>
    </aside>
  );
}

function DocumentTabs({ title }) {
  return (
    <div className="document-tabs" role="tablist" aria-label="Открытые документы">
      <button className="document-tab is-active" type="button" role="tab" aria-selected="true">
        {title}
        <span aria-hidden="true">x</span>
      </button>
      <button className="document-tab" type="button" role="tab" aria-selected="false">
        Структурная схема
      </button>
      <button className="document-tab" type="button" role="tab" aria-selected="false">
        Стартовая страница
      </button>
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
  const editorTitle = teb ? `${titlePrefix}: ${teb.header || teb.nameInModel || teb.type}` : 'Редактор тэба';
  const statusText = loadError || syncMessage;

  return (
    <main className="gpss-desktop">
      <Ribbon />

      <div className="workbench">
        <ProjectExplorer />

        <section className="document-host">
          <DocumentTabs title={teb?.header || teb?.nameInModel || 'Экземпляр Т36а'} />

          <div className="document-surface">
            <div className="editor-window" aria-busy={loading}>
              <header className="window-header">
                <div>
                  <div className="window-title">{editorTitle}</div>
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
            </div>
          </div>
        </section>
      </div>

      <footer className="global-status">
        <span>Приложение готово к работе</span>
        <span>{statusText}</span>
      </footer>
    </main>
  );
}
