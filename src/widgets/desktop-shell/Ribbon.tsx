import { useEffect, useMemo, useRef, useState } from 'react';
import { useTebEditorStore } from '../../features/teb-editor/store/useTebEditorStore';
import appLogoIcon from '../../shared/assets/icons/app-logo.png';
import arrowDownIcon from '../../shared/assets/icons/arrow-down.png';
import newModelIcon from '../../shared/assets/icons/new-model.png';
import newProjectIcon from '../../shared/assets/icons/new-project.png';
import openFileIcon from '../../shared/assets/icons/open-file.png';
import openProjectIcon from '../../shared/assets/icons/open-project.png';
import runIcon from '../../shared/assets/icons/run.png';
import saveAllIcon from '../../shared/assets/icons/save-all.png';
import saveIcon from '../../shared/assets/icons/save.png';
import stopIcon from '../../shared/assets/icons/stop.png';

interface RibbonCommand {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
}

type RibbonTabId = 'GPSS Studio' | 'Главная' | 'Моделирование' | 'Окна';

export function Ribbon() {
  const resetWorkspace = useTebEditorStore((state) => state.resetWorkspace);
  const loadWorkspaceSnapshot = useTebEditorStore((state) => state.loadWorkspaceSnapshot);
  const saveWorkspaceSnapshot = useTebEditorStore((state) => state.saveWorkspaceSnapshot);
  const activateDocument = useTebEditorStore((state) => state.activateDocument);
  const refresh = useTebEditorStore((state) => state.refresh);
  const startSimulation = useTebEditorStore((state) => state.startSimulation);
  const stopSimulation = useTebEditorStore((state) => state.stopSimulation);
  const toggleExplorer = useTebEditorStore((state) => state.toggleExplorer);
  const setStatusMessage = useTebEditorStore((state) => state.setStatusMessage);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isQuickAccessMenuOpen, setIsQuickAccessMenuOpen] = useState(false);
  const [visibleQuickAccessIds, setVisibleQuickAccessIds] = useState<string[]>(['home', 'save', 'open', 'new', 'run', 'stop']);
  const [activeRibbonTab, setActiveRibbonTab] = useState<RibbonTabId>('Главная');

  const quickAccess = useMemo<RibbonCommand[]>(
    () => [
      { id: 'home', label: 'Стартовая страница', icon: appLogoIcon, onClick: () => activateDocument('start') },
      { id: 'save', label: 'Сохранить снимок', icon: saveIcon, onClick: saveWorkspaceSnapshot },
      { id: 'open', label: 'Открыть снимок', icon: openProjectIcon, onClick: loadWorkspaceSnapshot },
      { id: 'new', label: 'Новый проект', icon: newProjectIcon, onClick: resetWorkspace },
      { id: 'run', label: 'Запустить моделирование', icon: runIcon, onClick: startSimulation },
      { id: 'stop', label: 'Остановить моделирование', icon: stopIcon, onClick: stopSimulation },
    ],
    [activateDocument, loadWorkspaceSnapshot, resetWorkspace, saveWorkspaceSnapshot, startSimulation, stopSimulation],
  );

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsQuickAccessMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const ribbonGroupsByTab: Record<RibbonTabId, Array<{ title: string; commands: RibbonCommand[] }>> = {
    'GPSS Studio': [
      {
        title: 'Проекты',
        commands: [
          { id: 'new-project', label: 'Создать проект', icon: newProjectIcon, onClick: resetWorkspace },
          { id: 'open-project', label: 'Открыть проект / Управление', icon: openProjectIcon, onClick: loadWorkspaceSnapshot },
        ],
      },
      {
        title: 'Файлы',
        commands: [
          { id: 'new-model', label: 'Создать модель', icon: newModelIcon, onClick: () => activateDocument('scheme') },
          { id: 'open-file', label: 'Открыть файл', icon: openFileIcon, onClick: () => activateDocument('model-text') },
        ],
      },
      {
        title: 'Открытые документы',
        commands: [
          { id: 'save-current', label: 'Сохранить', icon: saveIcon, onClick: saveWorkspaceSnapshot },
          { id: 'save-all', label: 'Сохранить все', icon: saveAllIcon, onClick: saveWorkspaceSnapshot },
        ],
      },
    ],
    Главная: [
      {
        title: 'Документы',
        commands: [
          { id: 'show-start', label: 'Стартовая страница', icon: appLogoIcon, onClick: () => activateDocument('start') },
          { id: 'show-editor', label: 'Редактор ТЭБа', icon: newModelIcon, onClick: () => activateDocument('editor') },
          { id: 'show-text', label: 'Текст модели', icon: openFileIcon, onClick: () => activateDocument('model-text') },
        ],
      },
      {
        title: 'Сохранение',
        commands: [
          { id: 'save-current-main', label: 'Сохранить', icon: saveIcon, onClick: saveWorkspaceSnapshot },
          { id: 'save-all-main', label: 'Сохранить все', icon: saveAllIcon, onClick: saveWorkspaceSnapshot },
          { id: 'refresh-main', label: 'Обновить данные', icon: openFileIcon, onClick: refresh },
        ],
      },
    ],
    Моделирование: [
      {
        title: 'Запуск',
        commands: [
          { id: 'run-sim', label: 'Запустить', icon: runIcon, onClick: startSimulation },
          { id: 'stop-sim', label: 'Остановить', icon: stopIcon, onClick: stopSimulation },
          { id: 'refresh-sim', label: 'Обновить', icon: openFileIcon, onClick: refresh },
        ],
      },
      {
        title: 'Представления',
        commands: [
          { id: 'open-scheme', label: 'Структурная схема', icon: newModelIcon, onClick: () => activateDocument('scheme') },
          { id: 'open-model-text', label: 'Текст модели', icon: openFileIcon, onClick: () => activateDocument('model-text') },
        ],
      },
    ],
    Окна: [
      {
        title: 'Окна',
        commands: [
          { id: 'window-editor', label: 'Редактор ТЭБа', icon: newModelIcon, onClick: () => activateDocument('editor') },
          { id: 'window-start', label: 'Стартовая страница', icon: appLogoIcon, onClick: () => activateDocument('start') },
          { id: 'window-scheme', label: 'Структурная схема', icon: openProjectIcon, onClick: () => activateDocument('scheme') },
        ],
      },
      {
        title: 'Панели',
        commands: [{ id: 'toggle-tree', label: 'Панель проекта', icon: openProjectIcon, onClick: toggleExplorer }],
      },
    ],
  };

  const visibleQuickAccess = quickAccess.filter((command) => visibleQuickAccessIds.includes(command.id));

  function toggleQuickAccessCommand(commandId: string) {
    setVisibleQuickAccessIds((current) => {
      if (current.includes(commandId)) {
        return current.length === 1 ? current : current.filter((item) => item !== commandId);
      }

      return [...current, commandId];
    });
  }

  return (
    <header className="desktop-chrome">
      <div className="title-row">
        <div className="quick-access" aria-label="Быстрый доступ">
          {visibleQuickAccess.map((command) => (
            <button key={command.id} type="button" title={command.label} onClick={command.onClick}>
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
            onClick={() => setIsQuickAccessMenuOpen((value) => !value)}
          >
            <img src={arrowDownIcon} alt="" aria-hidden="true" />
          </button>

          {isQuickAccessMenuOpen ? (
            <div className="quick-access-popover">
              <div className="quick-access-popover__title">Панель быстрого доступа</div>
              <div className="quick-access-popover__items">
                {quickAccess.map((command) => (
                  <label className="quick-access-popover__item" key={command.id}>
                    <input checked={visibleQuickAccessIds.includes(command.id)} type="checkbox" onChange={() => toggleQuickAccessCommand(command.id)} />
                    <img src={command.icon} alt="" aria-hidden="true" />
                    <span>{command.label}</span>
                  </label>
                ))}
              </div>
              <button className="quick-access-popover__reset" type="button" onClick={() => setVisibleQuickAccessIds(quickAccess.map((command) => command.id))}>
                Показать все команды
              </button>
            </div>
          ) : null}
        </div>

        <div className="desktop-title">Элина-Компьютер - GPSS Studio (студенческая версия)</div>
      </div>

      <nav className="ribbon-tabs" aria-label="Разделы ленты">
        {(['GPSS Studio', 'Главная', 'Моделирование', 'Окна'] as RibbonTabId[]).map((tab) => (
          <button
            className={tab === 'GPSS Studio' ? 'is-app-tab' : activeRibbonTab === tab ? 'is-active' : ''}
            key={tab}
            type="button"
            onClick={() => {
              setActiveRibbonTab(tab);
              setStatusMessage(`Открыта вкладка ленты: ${tab}.`, 'saved');
            }}
          >
            {tab}
          </button>
        ))}
      </nav>

      <div className="ribbon-band">
        {ribbonGroupsByTab[activeRibbonTab].map((group) => (
          <section className="ribbon-group" key={group.title}>
            <div className="ribbon-commands">
              {group.commands.map((command) => (
                <button className="ribbon-command" key={command.id} type="button" onClick={command.onClick}>
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
