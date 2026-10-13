import { useTebEditorStore } from '../../../features/teb-editor/store/useTebEditorStore';
import { dispatchJournalCommand } from '../../../features/teb-editor/model/journalCommands';
import appLogoIcon from '../../../shared/assets/icons/app-logo.png';
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
import nativeCopyIcon from '../../../shared/assets/icons/gpss-native/copy_32.png';
import nativeCutIcon from '../../../shared/assets/icons/gpss-native/cut_32.png';
import nativeFindIcon from '../../../shared/assets/icons/gpss-native/find_32.png';
import nativeGoToErrorIcon from '../../../shared/assets/icons/gpss-native/gotoerror_32.png';
import nativeGroupIcon from '../../../shared/assets/icons/gpss-native/group16.png';
import nativeUngroupIcon from '../../../shared/assets/icons/gpss-native/groupremove16.png';
import nativePasteIcon from '../../../shared/assets/icons/gpss-native/paste_32.png';
import nativeRedoIcon from '../../../shared/assets/icons/gpss-native/redo_32.png';
import nativeReplaceIcon from '../../../shared/assets/icons/gpss-native/replace_32.png';
import nativeUndoIcon from '../../../shared/assets/icons/gpss-native/undo_32.png';
import nativeZoomInIcon from '../../../shared/assets/icons/gpss-native/zoomin16.png';
import nativeZoomOutIcon from '../../../shared/assets/icons/gpss-native/zoomout16.png';
import nativeZoomResetIcon from '../../../shared/assets/icons/gpss-native/zoomreset16.png';
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
import saveAllQuickIcon from '../../../shared/assets/icons/save-all-quick.png';
import saveAllIcon from '../../../shared/assets/icons/save-all.png';
import saveAsIcon from '../../../shared/assets/icons/save-as.png';
import saveQuickIcon from '../../../shared/assets/icons/save-quick.png';
import saveIcon from '../../../shared/assets/icons/save.png';
import settingsIcon from '../../../shared/assets/icons/settings.png';
import stopSimIcon from '../../../shared/assets/icons/stop-sim.png';
import windowFindIcon from '../../../shared/assets/icons/window-find.png';
import windowIssuesIcon from '../../../shared/assets/icons/window-issues.png';
import windowProjectIcon from '../../../shared/assets/icons/window-project.png';
import windowPropertiesIcon from '../../../shared/assets/icons/window-properties.png';
import windowStartPageIcon from '../../../shared/assets/icons/window-start-page.png';
import windowTebLibsIcon from '../../../shared/assets/icons/window-teb-libs.png';
import windowTebPropertiesIcon from '../../../shared/assets/icons/window-teb-properties.png';
import type { JournalCommand } from '../../../features/teb-editor/model/journalCommands';
import type { ActiveDocument } from '../../../shared/types/teb';
import type { AppMenuEntry, RibbonCommand, RibbonGroup, RibbonTabId } from './ribbonTypes';

export interface RibbonCommands {
  quickAccess: RibbonCommand[];
  appMenu: AppMenuEntry[];
  groupsByTab: Record<RibbonTabId, RibbonGroup[]>;
}

function journalCommand(id: JournalCommand, label: string, icon: string): RibbonCommand {
  return { id: `journal-${id}`, label, icon, onClick: () => dispatchJournalCommand(id) };
}

/**
 * All ribbon, quick-access and application-menu commands. Handlers read the store
 * when invoked, so the configuration is static and built once.
 */
function createRibbonCommands(): RibbonCommands {
  const store = useTebEditorStore.getState;
  const notify = (message: string) => store().setStatusMessage(message, 'saved');
  /** Saves the open project (if any) and the workspace layout. */
  const save = () => {
    if (store().project) {
      void store().saveProject();
    }

    void store().saveWorkspaceSnapshot();
  };
  const activate = (documentId: ActiveDocument) => store().activateDocument(documentId);

  const openExternalProcedureDebugging = () => {
    activate('model-text');
    notify('Открыт режим отладки внешних процедур.');
  };
  const startDebugging = () => {
    // Debugging = step-by-step execution with a trace in the journal.
    activate('model-log');
    void store().runSimulationCommand('step');
  };
  const startSimulation = () => void store().startSimulation();
  const stopSimulation = () => void store().stopSimulation();

  const quickAccess: RibbonCommand[] = [
    { id: 'home', label: 'Стартовая страница', icon: appLogoIcon, onClick: () => activate('start') },
    { id: 'save', label: 'Сохранить', icon: saveQuickIcon, onClick: save },
    { id: 'save-all', label: 'Сохранить все', icon: saveAllQuickIcon, onClick: save },
    { id: 'save-as', label: 'Сохранить как...', icon: saveAsIcon, onClick: save },
    { id: 'run-sim', label: 'Запустить моделирование', icon: runSimIcon, onClick: startSimulation },
    { id: 'debug-ext', label: 'Запустить отладку внешних процедур', icon: debugExtIcon, onClick: openExternalProcedureDebugging },
    { id: 'debug-sim', label: 'Запустить отладку', icon: debugSimIcon, onClick: startDebugging },
    { id: 'stop-sim', label: 'Остановить моделирование', icon: stopSimIcon, onClick: stopSimulation },
  ];

  const appMenu: AppMenuEntry[] = [
    { id: 'settings', label: 'Настройки', icon: settingsIcon, onClick: () => notify('Окно настроек будет добавлено в следующем проходе.') },
    {
      id: 'manual',
      label: 'Руководство пользователя',
      glyph: 'question',
      onClick: () => notify('Переход к руководству пользователя пока подготовлен как команда меню.'),
    },
    { id: 'world-core', label: 'Руководство по GPSS World Core', onClick: () => notify('Команда открытия руководства GPSS World Core подготовлена.') },
    {
      id: 'examples',
      label: 'Описание примеров проектов',
      onClick: () => {
        activate('start');
        notify('Открыта стартовая страница с примерами проектов.');
      },
    },
    'divider',
    { id: 'about', label: 'О программе', glyph: 'info', onClick: () => notify('GPSS Studio Web replica. Информация о программе будет расширена.') },
    'divider',
    {
      id: 'exit',
      label: 'Выход',
      glyph: 'exit',
      tone: 'danger',
      onClick: () => store().setStatusMessage('В веб-версии команда "Выход" не завершает приложение.', 'warning'),
    },
  ];

  const groupsByTab: Record<RibbonTabId, RibbonGroup[]> = {
    Главная: [
      {
        title: 'Проекты',
        commands: [
          {
            id: 'new-project',
            label: 'Создать проект',
            icon: newProjectIcon,
            onClick: () => {
              activate('projects');
              notify('Введите имя нового проекта или импортируйте проект GPSS Studio.');
            },
          },
          { id: 'open-project', label: 'Открыть проект / Управление', icon: openProjectIcon, onClick: () => activate('projects') },
        ],
      },
      {
        title: 'Файлы',
        commands: [
          { id: 'new-model', label: 'Создать модель', icon: newModelIcon, onClick: () => activate('scheme') },
          { id: 'open-file', label: 'Открыть файл', icon: openFileIcon, onClick: () => activate('model-text') },
        ],
      },
      {
        title: 'Открытые документы',
        commands: [
          { id: 'save-current', label: 'Сохранить', icon: saveIcon, onClick: save },
          { id: 'save-all-main', label: 'Сохранить все', icon: saveAllIcon, onClick: save },
          { id: 'save-as-main', label: 'Сохранить как...', icon: saveAsIcon, onClick: save },
        ],
      },
    ],
    Моделирование: [
      {
        title: 'Модель',
        className: 'ribbon-group--model',
        commands: [
          {
            id: 'model-parameters',
            label: 'Параметры',
            icon: modelSettingsIcon,
            onClick: () => {
              activate('editor');
              store().setActiveTab('parameters');
              notify('Открыты параметры модели.');
            },
          },
        ],
      },
      {
        title: 'Схема',
        className: 'ribbon-group--scheme',
        commands: [
          { id: 'generate-model', label: 'Сгенерировать текст модели', icon: newModelIcon, onClick: () => void store().generateModelText() },
          { id: 'save-project', label: 'Сохранить проект', icon: saveIcon, onClick: () => void store().saveProject() },
        ],
      },
      {
        title: 'Управление',
        className: 'ribbon-group--management',
        commands: [
          { id: 'run-sim-tab', label: 'Запустить моделирование', icon: runSimIcon, onClick: startSimulation },
          { id: 'debug-ext-tab', label: 'Запустить отладку внешних процедур', icon: debugExtIcon, onClick: openExternalProcedureDebugging },
          { id: 'debug-sim-tab', label: 'Запустить отладку', icon: debugSimIcon, onClick: startDebugging },
          { id: 'stop-sim-tab', label: 'Остановить моделирование', icon: stopSimIcon, onClick: stopSimulation },
        ],
      },
      {
        title: 'Команды',
        className: 'ribbon-group--commands',
        commands: (
          [
            ['conduct', 'CONDUCT', conductIcon],
            ['start', 'START', cmdStartIcon],
            ['step', 'STEP', cmdStepIcon],
            ['halt', 'HALT', cmdHaltIcon],
            ['continue', 'CONTINUE', cmdContinueIcon],
            ['clear', 'CLEAR', cmdClearIcon],
            ['reset', 'RESET', cmdResetIcon],
            ['show', 'SHOW', cmdShowIcon],
            ['custom', 'Произвольная команда', cmdCustomIcon],
          ] as const
        ).map(([command, label, icon]) => ({ id: `cmd-${command}`, label, icon, onClick: () => void store().runSimulationCommand(command) })),
      },
      {
        title: 'GPSS World Core',
        className: 'ribbon-group--world-core',
        commands: [
          {
            id: 'open-gpss-core',
            label: 'Открыть окно GPSS World Core',
            icon: openGpssCoreIcon,
            onClick: () => notify('Открытие окна GPSS World Core подготовлено для desktop-интеграции.'),
          },
        ],
      },
    ],
    Окна: [
      {
        title: 'Документы',
        className: 'ribbon-group--documents',
        commands: [
          { id: 'window-start', label: 'Стартовая страница', icon: windowStartPageIcon, onClick: () => activate('start') },
          {
            id: 'window-teb-libraries',
            label: 'Библиотеки ТЭБов',
            icon: windowTebLibsIcon,
            onClick: () => {
              store().showExplorer();
              store().setExplorerMode('libraries');
              store().focusProjectNode('project-tebs-library');
              notify('Открыт обозреватель библиотек ТЭБов.');
            },
          },
        ],
      },
      {
        title: 'Инструменты',
        className: 'ribbon-group--tools',
        commands: [
          { id: 'window-issues', label: 'Замечания и ошибки', icon: windowIssuesIcon, onClick: () => store().openIssuesPanel() },
          {
            id: 'window-find',
            label: 'Поиск и замена',
            icon: windowFindIcon,
            onClick: () => {
              store().setProjectSearchQuery('');
              store().requestProjectSearchFocus();
              notify('Панель поиска и замены активирована.');
            },
          },
          { id: 'window-properties', label: 'Свойства', icon: windowPropertiesIcon, onClick: () => store().openRightPanel('properties') },
          { id: 'window-teb-properties', label: 'Свойства ТЭБа', icon: windowTebPropertiesIcon, onClick: () => store().openRightPanel('properties') },
          {
            id: 'window-project',
            label: 'Текущий проект',
            icon: windowProjectIcon,
            onClick: () => {
              store().showExplorer();
              store().setExplorerMode('project');
              store().focusProjectNode('project-home');
              notify('Открыта панель текущего проекта.');
            },
          },
          { id: 'window-teb-tests', label: 'Тесты ТЭБов', icon: windowPropertiesIcon, onClick: () => store().openRightPanel('teb-tests') },
        ],
      },
    ],
    'Стандартный отчёт': [
      {
        title: 'История изменений',
        className: 'ribbon-group--report-history',
        commands: [
          { id: 'report-undo', label: 'Отменить', icon: reportUndoIcon, onClick: () => notify('Отмена изменения отчёта выполнена в демо-режиме.') },
          { id: 'report-redo', label: 'Вернуть', icon: reportRedoIcon, onClick: () => notify('Повтор изменения отчёта выполнен в демо-режиме.') },
        ],
      },
      {
        title: 'Операции',
        className: 'ribbon-group--report-operations',
        commands: [
          { id: 'report-copy-rows', label: 'Копировать ряды', icon: reportCopyIcon, onClick: () => notify('Ряды отчёта скопированы в буфер демо-режима.') },
          { id: 'report-find', label: 'Найти', icon: reportFindIcon, onClick: () => notify('Поиск по отчёту подготовлен.') },
          {
            id: 'report-show-chart',
            label: 'Показать графики таблиц',
            icon: reportChartIcon,
            onClick: () => notify('Графики таблиц подготовлены для отображения.'),
          },
          {
            id: 'report-export-excel',
            label: 'Экспортировать в Excel',
            icon: reportExcelIcon,
            onClick: () => notify('Экспорт стандартного отчёта в Excel подготовлен.'),
          },
        ],
      },
    ],
    'Журнал моделирования': [
      {
        title: 'Буфер обмена',
        className: 'ribbon-group--journal-clipboard',
        commands: [
          journalCommand('cut', 'Вырезать', nativeCutIcon),
          journalCommand('copy', 'Копировать', nativeCopyIcon),
          journalCommand('paste', 'Вставить', nativePasteIcon),
        ],
      },
      {
        title: 'История изменений',
        className: 'ribbon-group--journal-history',
        commands: [journalCommand('undo', 'Отменить', nativeUndoIcon), journalCommand('redo', 'Вернуть', nativeRedoIcon)],
      },
      {
        title: 'Поиск и замена',
        className: 'ribbon-group--journal-search',
        commands: [journalCommand('find', 'Найти', nativeFindIcon), journalCommand('replace', 'Заменить', nativeReplaceIcon)],
      },
      {
        title: 'Группы',
        className: 'ribbon-group--journal-groups',
        commands: [journalCommand('group', 'Группировать', nativeGroupIcon), journalCommand('ungroup', 'Разгруппировать', nativeUngroupIcon)],
      },
      {
        title: 'Операции',
        className: 'ribbon-group--journal-operations',
        commands: [journalCommand('go-error', 'Перейти к ошибке', nativeGoToErrorIcon)],
      },
      {
        title: 'Масштаб',
        className: 'ribbon-group--journal-scale',
        commands: [
          journalCommand('zoom-in', 'Приблизить', nativeZoomInIcon),
          journalCommand('zoom-reset', 'Исходный размер', nativeZoomResetIcon),
          journalCommand('zoom-out', 'Отдалить', nativeZoomOutIcon),
        ],
      },
    ],
  };

  return { quickAccess, appMenu, groupsByTab };
}

export const RIBBON_COMMANDS = createRibbonCommands();
