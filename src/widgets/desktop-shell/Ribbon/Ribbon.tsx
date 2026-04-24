import { useEffect, useMemo, useRef, useState } from 'react';
import { useTebEditorStore } from '../../../features/teb-editor/store/useTebEditorStore';
import appLogoIcon from '../../../shared/assets/icons/app-logo.png';
import arrowDownIcon from '../../../shared/assets/icons/arrow-down.png';
import cmdClearIcon from '../../../shared/assets/icons/cmd-clear.png';
import cmdContinueIcon from '../../../shared/assets/icons/cmd-continue.png';
import cmdCustomIcon from '../../../shared/assets/icons/cmd-custom.png';
import cmdHaltIcon from '../../../shared/assets/icons/cmd-halt.png';
import cmdResetIcon from '../../../shared/assets/icons/cmd-reset.png';
import cmdShowIcon from '../../../shared/assets/icons/cmd-show.png';
import cmdStartIcon from '../../../shared/assets/icons/cmd-start.png';
import cmdStepIcon from '../../../shared/assets/icons/cmd-step.png';
import conductIcon from '../../../shared/assets/icons/conduct.png';
import debugExtIcon from '../../../shared/assets/icons/debug-ext.png';
import debugSimIcon from '../../../shared/assets/icons/debug-sim.png';
import modelSettingsIcon from '../../../shared/assets/icons/model-settings.png';
import newModelIcon from '../../../shared/assets/icons/new-model.png';
import newProjectIcon from '../../../shared/assets/icons/new-project.png';
import openFileIcon from '../../../shared/assets/icons/open-file.png';
import openGpssCoreIcon from '../../../shared/assets/icons/open-gpss-core.png';
import openProjectIcon from '../../../shared/assets/icons/open-project.png';
import reportChartIcon from '../../../shared/assets/icons/report-chart.png';
import reportCopyIcon from '../../../shared/assets/icons/report-copy.png';
import reportExcelIcon from '../../../shared/assets/icons/report-excel.png';
import reportFindIcon from '../../../shared/assets/icons/report-find.png';
import reportRedoIcon from '../../../shared/assets/icons/report-redo.png';
import reportUndoIcon from '../../../shared/assets/icons/report-undo.png';
import runSimIcon from '../../../shared/assets/icons/run-sim.png';
import saveAllIcon from '../../../shared/assets/icons/save-all.png';
import saveAllQuickIcon from '../../../shared/assets/icons/save-all-quick.png';
import saveAsIcon from '../../../shared/assets/icons/save-as.png';
import saveIcon from '../../../shared/assets/icons/save.png';
import saveQuickIcon from '../../../shared/assets/icons/save-quick.png';
import settingsIcon from '../../../shared/assets/icons/settings.png';
import stopSimIcon from '../../../shared/assets/icons/stop-sim.png';
import windowFindIcon from '../../../shared/assets/icons/window-find.png';
import windowIssuesIcon from '../../../shared/assets/icons/window-issues.png';
import windowProjectIcon from '../../../shared/assets/icons/window-project.png';
import windowPropertiesIcon from '../../../shared/assets/icons/window-properties.png';
import windowStartPageIcon from '../../../shared/assets/icons/window-start-page.png';
import windowTebLibsIcon from '../../../shared/assets/icons/window-teb-libs.png';
import windowTebPropertiesIcon from '../../../shared/assets/icons/window-teb-properties.png';
import './Ribbon.css';

interface RibbonCommand {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
}

interface RibbonGroup {
  title: string;
  commands: RibbonCommand[];
  className?: string;
}

interface AppMenuItem {
  id: string;
  label: string;
  icon?: string;
  tone?: 'default' | 'danger';
  glyph?: 'question' | 'info' | 'exit';
  onClick: () => void;
}

type RibbonTabId = 'Главная' | 'Моделирование' | 'Окна' | 'Стандартный отчёт';

function AppMenuGlyph({ glyph }: { glyph: NonNullable<AppMenuItem['glyph']> }) {
  return (
    <span className={`app-menu__glyph app-menu__glyph--${glyph}`} aria-hidden="true">
      {glyph === 'question' ? '?' : glyph === 'info' ? 'i' : '×'}
    </span>
  );
}

export function Ribbon() {
  const resetWorkspace = useTebEditorStore((state) => state.resetWorkspace);
  const loadWorkspaceSnapshot = useTebEditorStore((state) => state.loadWorkspaceSnapshot);
  const saveWorkspaceSnapshot = useTebEditorStore((state) => state.saveWorkspaceSnapshot);
  const activateDocument = useTebEditorStore((state) => state.activateDocument);
  const activeDocument = useTebEditorStore((state) => state.activeDocument);
  const explorerVisible = useTebEditorStore((state) => state.explorerVisible);
  const focusProjectNode = useTebEditorStore((state) => state.focusProjectNode);
  const setActiveTab = useTebEditorStore((state) => state.setActiveTab);
  const startSimulation = useTebEditorStore((state) => state.startSimulation);
  const stopSimulation = useTebEditorStore((state) => state.stopSimulation);
  const setProjectSearchQuery = useTebEditorStore((state) => state.setProjectSearchQuery);
  const toggleExplorer = useTebEditorStore((state) => state.toggleExplorer);
  const setStatusMessage = useTebEditorStore((state) => state.setStatusMessage);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const appMenuRef = useRef<HTMLDivElement | null>(null);
  const [isQuickAccessMenuOpen, setIsQuickAccessMenuOpen] = useState(false);
  const [isAppMenuOpen, setIsAppMenuOpen] = useState(false);
  const [visibleQuickAccessIds, setVisibleQuickAccessIds] = useState<string[]>([
    'home',
    'save',
    'save-all',
    'save-as',
    'run-sim',
    'debug-ext',
    'debug-sim',
    'stop-sim',
  ]);
  const [activeRibbonTab, setActiveRibbonTab] = useState<RibbonTabId>('Главная');

  const quickAccess = useMemo<RibbonCommand[]>(
    () => [
      { id: 'home', label: 'Стартовая страница', icon: appLogoIcon, onClick: () => activateDocument('start') },
      {
        id: 'save',
        label: 'Сохранить',
        icon: saveQuickIcon,
        onClick: () => {
          saveWorkspaceSnapshot();
          setStatusMessage('Текущий документ сохранён как локальный снимок рабочей области.', 'saved');
        },
      },
      {
        id: 'save-all',
        label: 'Сохранить все',
        icon: saveAllQuickIcon,
        onClick: () => {
          saveWorkspaceSnapshot();
          setStatusMessage('Все открытые документы сохранены в локальном снимке рабочей области.', 'saved');
        },
      },
      {
        id: 'save-as',
        label: 'Сохранить как...',
        icon: saveAsIcon,
        onClick: () => {
          saveWorkspaceSnapshot();
          setStatusMessage('Команда "Сохранить как..." выполнена как локальное сохранение рабочей области.', 'saved');
        },
      },
      {
        id: 'run-sim',
        label: 'Запустить моделирование',
        icon: runSimIcon,
        onClick: startSimulation,
      },
      {
        id: 'debug-ext',
        label: 'Запустить отладку внешних процедур',
        icon: debugExtIcon,
        onClick: () => {
          activateDocument('model-text');
          setStatusMessage('Открыт режим отладки внешних процедур.', 'saved');
        },
      },
      {
        id: 'debug-sim',
        label: 'Запустить отладку',
        icon: debugSimIcon,
        onClick: () => {
          startSimulation();
          setStatusMessage('Запущен режим отладки моделирования.', 'saved');
        },
      },
      {
        id: 'stop-sim',
        label: 'Остановить моделирование',
        icon: stopSimIcon,
        onClick: stopSimulation,
      },
    ],
    [activateDocument, saveWorkspaceSnapshot, setStatusMessage, startSimulation, stopSimulation],
  );

  const appMenuItems = useMemo<(AppMenuItem | 'divider')[]>(
    () => [
      {
        id: 'settings',
        label: 'Настройки',
        icon: settingsIcon,
        onClick: () => setStatusMessage('Окно настроек будет добавлено в следующем проходе.', 'saved'),
      },
      {
        id: 'manual',
        label: 'Руководство пользователя',
        glyph: 'question',
        onClick: () => setStatusMessage('Переход к руководству пользователя пока подготовлен как команда меню.', 'saved'),
      },
      {
        id: 'world-core',
        label: 'Руководство по GPSS World Core',
        onClick: () => setStatusMessage('Команда открытия руководства GPSS World Core подготовлена.', 'saved'),
      },
      {
        id: 'examples',
        label: 'Описание примеров проектов',
        onClick: () => {
          activateDocument('start');
          setStatusMessage('Открыта стартовая страница с примерами проектов.', 'saved');
        },
      },
      'divider',
      {
        id: 'about',
        label: 'О программе',
        glyph: 'info',
        onClick: () => setStatusMessage('GPSS Studio Web replica. Информация о программе будет расширена.', 'saved'),
      },
      'divider',
      {
        id: 'exit',
        label: 'Выход',
        glyph: 'exit',
        tone: 'danger',
        onClick: () => setStatusMessage('В веб-версии команда "Выход" не завершает приложение.', 'offline'),
      },
    ],
    [activateDocument, setStatusMessage],
  );

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (!menuRef.current?.contains(target)) {
        setIsQuickAccessMenuOpen(false);
      }

      if (!appMenuRef.current?.contains(target)) {
        setIsAppMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (activeDocument === 'std-report' && activeRibbonTab !== 'Стандартный отчёт') {
      setActiveRibbonTab('Стандартный отчёт');
    }
  }, [activeDocument, activeRibbonTab]);

  const ribbonGroupsByTab: Record<RibbonTabId, RibbonGroup[]> = {
    'Главная': [
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
          { id: 'save-all-main', label: 'Сохранить все', icon: saveAllIcon, onClick: saveWorkspaceSnapshot },
          {
            id: 'save-as-main',
            label: 'Сохранить как...',
            icon: saveAsIcon,
            onClick: () => {
              saveWorkspaceSnapshot();
              setStatusMessage('Команда "Сохранить как..." сохранена как локальный снимок рабочей области.', 'saved');
            },
          },
        ],
      },
    ],
    'Моделирование': [
      {
        title: 'Модель',
        className: 'ribbon-group--model',
        commands: [
          {
            id: 'model-parameters',
            label: 'Параметры',
            icon: modelSettingsIcon,
            onClick: () => {
              activateDocument('editor');
              setActiveTab('parameters');
              setStatusMessage('Открыты параметры модели.', 'saved');
            },
          },
        ],
      },
      {
        title: 'Управление',
        className: 'ribbon-group--management',
        commands: [
          { id: 'run-sim-tab', label: 'Запустить моделирование', icon: runSimIcon, onClick: startSimulation },
          {
            id: 'debug-ext-tab',
            label: 'Запустить отладку внешних процедур',
            icon: debugExtIcon,
            onClick: () => {
              activateDocument('model-text');
              setStatusMessage('Открыт режим отладки внешних процедур.', 'saved');
            },
          },
          {
            id: 'debug-sim-tab',
            label: 'Запустить отладку',
            icon: debugSimIcon,
            onClick: () => {
              startSimulation();
              setStatusMessage('Запущен режим отладки моделирования.', 'saved');
            },
          },
          { id: 'stop-sim-tab', label: 'Остановить моделирование', icon: stopSimIcon, onClick: stopSimulation },
        ],
      },
      {
        title: 'Команды',
        className: 'ribbon-group--commands',
        commands: [
          { id: 'cmd-conduct', label: 'CONDUCT', icon: conductIcon, onClick: () => setStatusMessage('Команда CONDUCT подготовлена для текущей модели.', 'saved') },
          { id: 'cmd-start', label: 'START', icon: cmdStartIcon, onClick: () => setStatusMessage('Команда START отправлена в демо-режиме.', 'saved') },
          { id: 'cmd-step', label: 'STEP', icon: cmdStepIcon, onClick: () => setStatusMessage('Команда STEP выполнена в демо-режиме.', 'saved') },
          {
            id: 'cmd-halt',
            label: 'HALT',
            icon: cmdHaltIcon,
            onClick: () => {
              stopSimulation();
              setStatusMessage('Команда HALT выполнена.', 'saved');
            },
          },
          {
            id: 'cmd-continue',
            label: 'CONTINUE',
            icon: cmdContinueIcon,
            onClick: () => {
              startSimulation();
              setStatusMessage('Команда CONTINUE выполнена.', 'saved');
            },
          },
          { id: 'cmd-clear', label: 'CLEAR', icon: cmdClearIcon, onClick: () => setStatusMessage('Команда CLEAR выполнена в демо-режиме.', 'saved') },
          { id: 'cmd-reset', label: 'RESET', icon: cmdResetIcon, onClick: () => setStatusMessage('Команда RESET выполнена в демо-режиме.', 'saved') },
          {
            id: 'cmd-show',
            label: 'SHOW',
            icon: cmdShowIcon,
            onClick: () => {
              activateDocument('std-report');
              setStatusMessage('Открыт стандартный отчёт по команде SHOW.', 'saved');
            },
          },
          {
            id: 'cmd-custom',
            label: 'Произвольная команда',
            icon: cmdCustomIcon,
            onClick: () => {
              activateDocument('model-log');
              setStatusMessage('Открыт журнал моделирования для произвольной команды.', 'saved');
            },
          },
        ],
      },
      {
        title: 'GPSS World Core',
        className: 'ribbon-group--world-core',
        commands: [
          {
            id: 'open-gpss-core',
            label: 'Открыть окно GPSS World Core',
            icon: openGpssCoreIcon,
            onClick: () => setStatusMessage('Открытие окна GPSS World Core подготовлено для desktop-интеграции.', 'saved'),
          },
        ],
      },
    ],
    'Окна': [
      {
        title: 'Документы',
        className: 'ribbon-group--documents',
        commands: [
          {
            id: 'window-start',
            label: 'Стартовая страница',
            icon: windowStartPageIcon,
            onClick: () => activateDocument('start'),
          },
          {
            id: 'window-teb-libraries',
            label: 'Библиотеки ТЭБов',
            icon: windowTebLibsIcon,
            onClick: () => {
              activateDocument('start');
              setStatusMessage('Открыт обозреватель библиотек ТЭБов.', 'saved');
            },
          },
        ],
      },
      {
        title: 'Инструменты',
        className: 'ribbon-group--tools',
        commands: [
          {
            id: 'window-issues',
            label: 'Замечания и ошибки',
            icon: windowIssuesIcon,
            onClick: () => {
              activateDocument('model-log');
              setStatusMessage('Открыта панель замечаний и ошибок.', 'saved');
            },
          },
          {
            id: 'window-find',
            label: 'Поиск и замена',
            icon: windowFindIcon,
            onClick: () => {
              if (!explorerVisible) {
                toggleExplorer();
              }
              setProjectSearchQuery('');
              setStatusMessage('Панель поиска и замены активирована.', 'saved');
            },
          },
          {
            id: 'window-properties',
            label: 'Свойства',
            icon: windowPropertiesIcon,
            onClick: () => {
              activateDocument('editor');
              setActiveTab('general');
              setStatusMessage('Открыты свойства текущего документа.', 'saved');
            },
          },
          {
            id: 'window-teb-properties',
            label: 'Свойства ТЭБа',
            icon: windowTebPropertiesIcon,
            onClick: () => {
              activateDocument('editor');
              setActiveTab('general');
              setStatusMessage('Открыты свойства ТЭБа.', 'saved');
            },
          },
          {
            id: 'window-project',
            label: 'Текущий проект',
            icon: windowProjectIcon,
            onClick: () => {
              if (!explorerVisible) {
                toggleExplorer();
              }
              focusProjectNode('project-home');
              setStatusMessage('Открыта панель текущего проекта.', 'saved');
            },
          },
          {
            id: 'window-teb-tests',
            label: 'Тесты ТЭБов',
            icon: windowPropertiesIcon,
            onClick: () => {
              activateDocument('model-log');
              setStatusMessage('Открыта панель тестов ТЭБов.', 'saved');
            },
          },
        ],
      },
    ],
    'Стандартный отчёт': [
      {
        title: 'История изменений',
        className: 'ribbon-group--report-history',
        commands: [
          {
            id: 'report-undo',
            label: 'Отменить',
            icon: reportUndoIcon,
            onClick: () => setStatusMessage('Отмена изменения отчёта выполнена в демо-режиме.', 'saved'),
          },
          {
            id: 'report-redo',
            label: 'Вернуть',
            icon: reportRedoIcon,
            onClick: () => setStatusMessage('Повтор изменения отчёта выполнен в демо-режиме.', 'saved'),
          },
        ],
      },
      {
        title: 'Операции',
        className: 'ribbon-group--report-operations',
        commands: [
          {
            id: 'report-copy-rows',
            label: 'Копировать ряды',
            icon: reportCopyIcon,
            onClick: () => setStatusMessage('Ряды отчёта скопированы в буфер демо-режима.', 'saved'),
          },
          {
            id: 'report-find',
            label: 'Найти',
            icon: reportFindIcon,
            onClick: () => setStatusMessage('Поиск по отчёту подготовлен.', 'saved'),
          },
          {
            id: 'report-show-chart',
            label: 'Показать графики таблиц',
            icon: reportChartIcon,
            onClick: () => setStatusMessage('Графики таблиц подготовлены для отображения.', 'saved'),
          },
          {
            id: 'report-export-excel',
            label: 'Экспортировать в Excel',
            icon: reportExcelIcon,
            onClick: () => setStatusMessage('Экспорт стандартного отчёта в Excel подготовлен.', 'saved'),
          },
        ],
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

  function handleRibbonTabClick(tab: RibbonTabId) {
    setActiveRibbonTab(tab);
    setIsAppMenuOpen(false);
    setStatusMessage(`Открыта вкладка ленты: ${tab}.`, 'saved');
  }

  function handleAppMenuToggle() {
    setIsQuickAccessMenuOpen(false);
    setIsAppMenuOpen((current) => !current);
    setStatusMessage('Открыто меню GPSS Studio.', 'saved');
  }

  function handleAppMenuItemClick(item: AppMenuItem) {
    setIsAppMenuOpen(false);
    item.onClick();
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
            onClick={() => {
              setIsAppMenuOpen(false);
              setIsQuickAccessMenuOpen((value) => !value);
            }}
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

      <div className="contextual-strip is-visible">
        <div className="contextual-strip__group contextual-strip__group--report">Редактор отчётов</div>
      </div>

      <nav className="ribbon-tabs" aria-label="Разделы ленты">
        <div className="ribbon-app-slot" ref={appMenuRef}>
          <button
            className={`ribbon-app-button ${isAppMenuOpen ? 'is-open' : ''}`}
            type="button"
            aria-haspopup="menu"
            aria-expanded={isAppMenuOpen}
            onClick={handleAppMenuToggle}
          >
            GPSS Studio
          </button>

          {isAppMenuOpen ? (
            <div className="app-menu" role="menu" aria-label="Меню GPSS Studio">
              {appMenuItems.map((item, index) =>
                item === 'divider' ? (
                  <div className="app-menu__divider" key={`divider-${index}`} />
                ) : (
                  <button
                    className={`app-menu__item ${item.tone === 'danger' ? 'is-danger' : ''}`}
                    key={item.id}
                    role="menuitem"
                    type="button"
                    onClick={() => handleAppMenuItemClick(item)}
                  >
                    <span className="app-menu__item-icon" aria-hidden="true">
                      {item.icon ? <img src={item.icon} alt="" /> : item.glyph ? <AppMenuGlyph glyph={item.glyph} /> : null}
                    </span>
                    <span className="app-menu__item-label">{item.label}</span>
                  </button>
                ),
              )}
            </div>
          ) : null}
        </div>

        {(['Главная', 'Моделирование', 'Окна', 'Стандартный отчёт'] as RibbonTabId[]).map((tab) => (
          <button
            className={`ribbon-tab ${tab === 'Стандартный отчёт' ? 'ribbon-tab--report' : ''} ${activeRibbonTab === tab ? 'is-active' : ''}`.trim()}
            key={tab}
            type="button"
            onClick={() => handleRibbonTabClick(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      <div className="ribbon-band">
        {ribbonGroupsByTab[activeRibbonTab].map((group) => (
          <section className={`ribbon-group ${group.className ?? ''}`.trim()} key={group.title}>
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
