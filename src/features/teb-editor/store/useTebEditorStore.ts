import { create } from 'zustand';
import { createTebApi, readEditorQueryFromUrl, TebApiError } from '../../../shared/api/tebApi';
import { readWorkspaceSnapshot, writeWorkspaceSnapshot } from '../../../shared/lib/storage';
import { clamp, deepClone, readFileAsDataUrl, reorderItems } from '../../../shared/lib/utils';
import type {
  ActiveDocument,
  CollectionKey,
  Direction,
  EditorMode,
  EditorQuery,
  ExplorerMode,
  IssueItem,
  ReportSectionId,
  RightPanelTab,
  SchemeLink,
  SchemeNode,
  SchemeSelection,
  SimulationCommand,
  SimulationState,
  SourceKind,
  SyncStatus,
  TabId,
  TebDocument,
  TebParameter,
  TebTestItem,
  WorkspaceSnapshot,
} from '../../../shared/types/teb';
import { EDITOR_TABS, visibleTabsForType } from '../model/constants';
import { createBlankGpssEntity, createBlankParameter, createBlankPort, createBlankState } from '../model/factories';
import { normalizeTebPayload } from '../model/normalizeTeb';
import { SAMPLE_TEB_CLASS, SAMPLE_TEB_INSTANCE } from '../model/sampleData';
import { INITIAL_ISSUES, INITIAL_SCHEME_LINKS, INITIAL_SCHEME_NODES, INITIAL_TEB_TESTS } from '../model/workspaceData';

interface TebEditorState extends EditorQuery {
  teb: TebDocument | null;
  loading: boolean;
  loadError: string;
  source: SourceKind;
  syncStatus: SyncStatus;
  syncMessage: string;
  activeTab: TabId;
  activeDocument: ActiveDocument | null;
  openDocuments: ActiveDocument[];
  explorerVisible: boolean;
  rightPanelVisible: boolean;
  rightPanelTab: RightPanelTab;
  issuesPanelVisible: boolean;
  explorerMode: ExplorerMode;
  selectedNodeId: string;
  collapsedNodeIds: string[];
  projectSearchQuery: string;
  modelFontSize: number;
  simulationState: SimulationState;
  schemeNodes: SchemeNode[];
  schemeLinks: SchemeLink[];
  schemeSelection: SchemeSelection;
  reportCellEdits: Record<string, string>;
  modelLogText: string;
  issues: IssueItem[];
  issueFilter: 'all' | 'error' | 'warning' | 'info';
  tebTests: TebTestItem[];
  history: TebDocument[];
  historyIndex: number;
}

interface TebEditorActions {
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  setActiveTab: (tabId: TabId) => void;
  setMode: (mode: EditorMode) => Promise<void>;
  activateDocument: (documentId: ActiveDocument) => void;
  closeDocument: (documentId: ActiveDocument) => void;
  focusProjectNode: (nodeId: string) => void;
  selectProjectNode: (nodeId: string) => void;
  toggleExplorer: () => void;
  toggleRightPanel: () => void;
  openRightPanel: (tab?: RightPanelTab) => void;
  setRightPanelTab: (tab: RightPanelTab) => void;
  toggleIssuesPanel: () => void;
  openIssuesPanel: () => void;
  setExplorerMode: (mode: ExplorerMode) => void;
  toggleTreeNode: (nodeId: string) => void;
  setProjectSearchQuery: (query: string) => void;
  setStatusMessage: (message: string, status?: SyncStatus) => void;
  resetWorkspace: () => void;
  saveWorkspaceSnapshot: () => void;
  loadWorkspaceSnapshot: () => void;
  startSimulation: () => void;
  stopSimulation: () => void;
  runSimulationCommand: (command: SimulationCommand) => void;
  setSchemeNodes: (updater: SchemeNode[] | ((nodes: SchemeNode[]) => SchemeNode[]), message?: string) => void;
  setSchemeLinks: (updater: SchemeLink[] | ((links: SchemeLink[]) => SchemeLink[]), message?: string) => void;
  setSchemeSelection: (selection: SchemeSelection) => void;
  resetScheme: () => void;
  setReportCellEdit: (sectionId: ReportSectionId, rowIndex: number, columnIndex: number, value: string) => void;
  setModelLogText: (text: string, message?: string) => void;
  appendModelLog: (line: string) => void;
  clearModelLog: () => void;
  setIssueFilter: (filter: TebEditorState['issueFilter']) => void;
  setTebTestStatus: (id: string, status: TebTestItem['status'], message: string) => void;
  undo: () => void;
  redo: () => void;
  zoomInModel: () => void;
  zoomOutModel: () => void;
  resetModelZoom: () => void;
  validateModel: () => void;
  updateGeneralField: (field: 'nameInModel' | 'header' | 'description', value: string) => void;
  commitGeneralField: (field: 'nameInModel' | 'header' | 'description') => Promise<void>;
  updateGpssModelText: (text: string) => void;
  commitGpssModelText: () => Promise<void>;
  attachImage: (file: File) => Promise<void>;
  removeImage: () => void;
  addParameter: () => Promise<void>;
  removeParameter: (index: number) => Promise<void>;
  moveParameter: (index: number, direction: Direction) => Promise<void>;
  updateParameter: (index: number, field: keyof TebParameter, value: string | number | boolean) => void;
  commitParameter: (index: number) => Promise<void>;
  commitParameterValue: (index: number) => Promise<void>;
  addCollectionRow: (collection: CollectionKey) => void;
  removeCollectionRow: (collection: CollectionKey, index: number) => void;
  moveCollectionRow: (collection: CollectionKey, index: number, direction: Direction) => void;
  updateCollectionField: (collection: CollectionKey, index: number, field: string, value: string | number | boolean) => void;
  commitCollectionField: (collection: CollectionKey, index: number) => Promise<void>;
}

export type TebEditorStore = TebEditorState & TebEditorActions;

const initialQuery = readEditorQueryFromUrl();

function createHistory(teb: TebDocument | null): Pick<TebEditorState, 'history' | 'historyIndex'> {
  return teb ? { history: [deepClone(teb)], historyIndex: 0 } : { history: [], historyIndex: -1 };
}

function snapshotFromState(state: TebEditorState): WorkspaceSnapshot {
  return {
    teb: state.teb ? deepClone(state.teb) : null,
    mode: state.mode,
    activeTab: state.activeTab,
    activeDocument: state.activeDocument,
    openDocuments: state.openDocuments,
    explorerVisible: state.explorerVisible,
    rightPanelVisible: state.rightPanelVisible,
    rightPanelTab: state.rightPanelTab,
    issuesPanelVisible: state.issuesPanelVisible,
    explorerMode: state.explorerMode,
    collapsedNodeIds: state.collapsedNodeIds,
    selectedNodeId: state.selectedNodeId,
    modelFontSize: state.modelFontSize,
    simulationState: state.simulationState,
    schemeNodes: deepClone(state.schemeNodes),
    schemeLinks: deepClone(state.schemeLinks),
    reportCellEdits: { ...state.reportCellEdits },
    modelLogText: state.modelLogText,
    issues: deepClone(state.issues),
    tebTests: deepClone(state.tebTests),
  };
}

function historyAwareState(state: TebEditorState, nextTeb: TebDocument): Pick<TebEditorState, 'teb' | 'history' | 'historyIndex'> {
  const nextSnapshot = deepClone(nextTeb);
  const trimmedHistory = state.history.slice(0, state.historyIndex + 1);
  const previous = trimmedHistory.at(-1);

  if (previous && JSON.stringify(previous) === JSON.stringify(nextSnapshot)) {
    return { teb: nextTeb, history: trimmedHistory, historyIndex: state.historyIndex };
  }

  const nextHistory = [...trimmedHistory, nextSnapshot].slice(-80);
  return {
    teb: nextTeb,
    history: nextHistory,
    historyIndex: nextHistory.length - 1,
  };
}

function getApi(state: TebEditorState) {
  return createTebApi({
    apiBaseUrl: state.apiBaseUrl,
    libraryId: state.libraryId,
    classId: state.mode === 'instance' ? state.instanceClassId : state.classId,
    instanceClassId: state.instanceClassId,
    instanceId: state.instanceId,
    mode: state.mode,
  });
}

function syncFailureMessage(error: unknown): string {
  if (error instanceof TebApiError && error.status === 404) {
    return 'Эндпоинт команды пока не найден на сервере. Изменение сохранено локально.';
  }

  if (error instanceof TebApiError) {
    return `Сервер вернул HTTP ${error.status}. Изменение сохранено локально.`;
  }

  return 'Сервер недоступен. Изменение сохранено локально.';
}

async function runRemoteMutation(
  set: (partial: Partial<TebEditorState>) => void,
  mutation: () => Promise<unknown>,
  successMessage = 'Изменение отправлено на сервер.',
) {
  set({ syncStatus: 'syncing', syncMessage: 'Отправка изменения...' });

  try {
    await mutation();
    set({ syncStatus: 'saved', syncMessage: successMessage });
  } catch (error) {
    set({ syncStatus: 'offline', syncMessage: syncFailureMessage(error) });
  }
}

function safeTabForDocument(tabId: TabId, type?: string): TabId {
  const tabs = visibleTabsForType(type);
  return tabs.includes(tabId) ? tabId : tabs[0];
}

function nodeToDocument(nodeId: string): ActiveDocument {
  if (nodeId === 'scheme') {
    return 'scheme';
  }

  if (nodeId === 'model-text') {
    return 'model-text';
  }

  if (nodeId === 'std-report') {
    return 'std-report';
  }

  if (nodeId === 'model-log') {
    return 'model-log';
  }

  if (nodeId === 'project-home') {
    return 'start';
  }

  return 'editor';
}

function nodeForDocument(documentId: ActiveDocument): string {
  switch (documentId) {
    case 'scheme':
      return 'scheme';
    case 'model-text':
      return 'model-text';
    case 'std-report':
      return 'std-report';
    case 'model-log':
      return 'model-log';
    case 'start':
      return 'project-home';
    default:
      return 'library';
  }
}

function documentLabel(documentId: ActiveDocument): string {
  switch (documentId) {
    case 'scheme':
      return 'структурная схема';
    case 'model-text':
      return 'текст модели';
    case 'start':
      return 'стартовая страница';
    case 'std-report':
      return 'стандартный отчёт';
    case 'model-log':
      return 'журнал моделирования';
    default:
      return 'редактор ТЭБа';
  }
}

function buildInitialModelLog(teb: TebDocument | null, simulationState: SimulationState): string {
  const commands =
    teb?.gpssModel.text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 10) ?? [];

  return [
    `[08:59:12] Проект "${teb?.header || teb?.nameInModel || 'Столовая'}" открыт.`,
    `[08:59:14] Загружено параметров: ${teb?.parameters.length ?? 0}.`,
    `[08:59:18] Загружено GPSS-объектов: ${teb?.gpssEntities.length ?? 0}.`,
    `[08:59:21] Состояние моделирования: ${simulationState}.`,
    ...commands.map((command, index) => `[08:59:${String(24 + index).padStart(2, '0')}] GPSS: ${command}`),
  ].join('\n');
}

function appendLogLine(text: string, line: string): string {
  return text ? `${text}\n${line}` : line;
}

function stateFromWorkspaceSnapshot(snapshot: WorkspaceSnapshot, state: TebEditorState, syncMessage: string): Partial<TebEditorState> {
  return {
    teb: snapshot.teb ?? state.teb,
    mode: snapshot.mode,
    activeTab: snapshot.activeTab,
    activeDocument: snapshot.activeDocument,
    openDocuments: snapshot.openDocuments ?? state.openDocuments,
    explorerVisible: snapshot.explorerVisible,
    rightPanelVisible: snapshot.rightPanelVisible ?? state.rightPanelVisible,
    rightPanelTab: snapshot.rightPanelTab ?? state.rightPanelTab,
    issuesPanelVisible: snapshot.issuesPanelVisible ?? state.issuesPanelVisible,
    explorerMode: snapshot.explorerMode ?? state.explorerMode,
    selectedNodeId: snapshot.selectedNodeId ?? (snapshot.activeDocument ? nodeForDocument(snapshot.activeDocument) : state.selectedNodeId),
    collapsedNodeIds: snapshot.collapsedNodeIds ?? state.collapsedNodeIds,
    modelFontSize: snapshot.modelFontSize,
    simulationState: snapshot.simulationState ?? state.simulationState,
    schemeNodes: snapshot.schemeNodes ? deepClone(snapshot.schemeNodes) : state.schemeNodes,
    schemeLinks: snapshot.schemeLinks ? deepClone(snapshot.schemeLinks) : state.schemeLinks,
    reportCellEdits: snapshot.reportCellEdits ?? state.reportCellEdits,
    modelLogText: snapshot.modelLogText ?? state.modelLogText,
    issues: snapshot.issues ? deepClone(snapshot.issues) : state.issues,
    tebTests: snapshot.tebTests ? deepClone(snapshot.tebTests) : state.tebTests,
    syncStatus: 'saved',
    syncMessage,
    ...createHistory(snapshot.teb ?? state.teb),
  };
}

export const useTebEditorStore = create<TebEditorStore>((set, get) => ({
  ...initialQuery,
  teb: null,
  loading: false,
  loadError: '',
  source: 'idle',
  syncStatus: 'idle',
  syncMessage: 'Ожидание изменений.',
  activeTab: 'general',
  activeDocument: 'editor',
  openDocuments: ['editor', 'scheme', 'start', 'model-text'],
  explorerVisible: true,
  rightPanelVisible: true,
  rightPanelTab: 'properties',
  issuesPanelVisible: true,
  explorerMode: 'project',
  selectedNodeId: 'library',
  collapsedNodeIds: [],
  projectSearchQuery: '',
  modelFontSize: 14,
  simulationState: 'idle',
  schemeNodes: deepClone(INITIAL_SCHEME_NODES),
  schemeLinks: deepClone(INITIAL_SCHEME_LINKS),
  schemeSelection: { type: 'node', id: 'kitchen-choice' },
  reportCellEdits: {},
  modelLogText: '',
  issues: deepClone(INITIAL_ISSUES),
  issueFilter: 'all',
  tebTests: deepClone(INITIAL_TEB_TESTS),
  history: [],
  historyIndex: -1,

  async load() {
    const state = get();
    const api = getApi(state);

    set({
      loading: true,
      loadError: '',
      source: 'api',
      syncStatus: 'idle',
      syncMessage: 'Загрузка данных...',
    });

    try {
      const payload = state.mode === 'instance' ? await api.getInstance() : await api.getClass();
      const teb = normalizeTebPayload(payload, state.mode);
      set({
        teb,
        loading: false,
        source: 'api',
        mode: teb.mode,
        activeTab: safeTabForDocument(get().activeTab, teb.type),
        modelLogText: get().modelLogText || buildInitialModelLog(teb, get().simulationState),
        ...createHistory(teb),
        syncMessage: 'Данные загружены с локального API.',
      });
    } catch {
      const fallback = state.mode === 'instance' ? deepClone(SAMPLE_TEB_INSTANCE) : deepClone(SAMPLE_TEB_CLASS);
      set({
        teb: fallback,
        loading: false,
        source: 'sample',
        loadError: 'Не удалось получить данные с локального API. Открыты демонстрационные данные.',
        syncStatus: 'offline',
        syncMessage: 'Работа в локальном режиме до восстановления API.',
        modelLogText: get().modelLogText || buildInitialModelLog(fallback, get().simulationState),
        ...createHistory(fallback),
      });
    }
  },

  async refresh() {
    await get().load();
  },

  setActiveTab(tabId) {
    const teb = get().teb;
    set({ activeTab: safeTabForDocument(tabId, teb?.type) });
  },

  async setMode(mode) {
    set({ mode, activeTab: 'general' });
    await get().load();
  },

  activateDocument(documentId) {
    set((state) => ({
      activeDocument: documentId,
      openDocuments: state.openDocuments.includes(documentId) ? state.openDocuments : [...state.openDocuments, documentId],
      selectedNodeId: nodeForDocument(documentId),
      syncMessage: `Открыт документ: ${documentLabel(documentId)}.`,
    }));
  },

  closeDocument(documentId) {
    set((state) => {
      const openDocuments = state.openDocuments.filter((item) => item !== documentId);
      const activeDocument = state.activeDocument === documentId ? openDocuments.at(-1) ?? null : state.activeDocument;

      return {
        openDocuments,
        activeDocument,
        selectedNodeId: activeDocument ? nodeForDocument(activeDocument) : state.selectedNodeId,
        syncStatus: 'saved',
        syncMessage: `Окно закрыто: ${documentLabel(documentId)}.`,
      };
    });
  },

  focusProjectNode(nodeId) {
    set({
      selectedNodeId: nodeId,
      syncStatus: 'saved',
      syncMessage: `Выбран раздел: ${nodeId}.`,
    });
  },

  selectProjectNode(nodeId) {
    set((state) => {
      const nextDocument = nodeToDocument(nodeId);
      return {
        selectedNodeId: nodeId,
        activeDocument: nextDocument,
        openDocuments: state.openDocuments.includes(nextDocument) ? state.openDocuments : [...state.openDocuments, nextDocument],
        syncMessage: `Выбран раздел: ${nodeId}.`,
      };
    });
  },

  toggleExplorer() {
    set((state) => ({
      explorerVisible: !state.explorerVisible,
      syncMessage: state.explorerVisible ? 'Панель проекта скрыта.' : 'Панель проекта открыта.',
    }));
  },

  toggleRightPanel() {
    set((state) => ({
      rightPanelVisible: !state.rightPanelVisible,
      syncMessage: state.rightPanelVisible ? 'Правая панель скрыта.' : 'Правая панель открыта.',
    }));
  },

  openRightPanel(tab = 'properties') {
    set({
      rightPanelVisible: true,
      rightPanelTab: tab,
      syncStatus: 'saved',
      syncMessage: tab === 'properties' ? 'Открыта панель свойств.' : 'Открыта панель тестов ТЭБов.',
    });
  },

  setRightPanelTab(tab) {
    set({
      rightPanelTab: tab,
      rightPanelVisible: true,
      syncStatus: 'saved',
      syncMessage: tab === 'properties' ? 'Активна вкладка свойств.' : 'Активна вкладка тестов ТЭБов.',
    });
  },

  toggleIssuesPanel() {
    set((state) => ({
      issuesPanelVisible: !state.issuesPanelVisible,
      syncStatus: 'saved',
      syncMessage: state.issuesPanelVisible ? 'Панель замечаний и ошибок скрыта.' : 'Панель замечаний и ошибок открыта.',
    }));
  },

  openIssuesPanel() {
    set({
      issuesPanelVisible: true,
      syncStatus: 'saved',
      syncMessage: 'Открыта панель замечаний и ошибок.',
    });
  },

  setExplorerMode(mode) {
    set({
      explorerMode: mode,
      projectSearchQuery: '',
      syncStatus: 'saved',
      syncMessage: mode === 'libraries' ? 'Открыта панель библиотек ТЭБов.' : 'Открыта панель текущего проекта.',
    });
  },

  toggleTreeNode(nodeId) {
    set((state) => {
      const collapsedNodeIds = state.collapsedNodeIds.includes(nodeId)
        ? state.collapsedNodeIds.filter((item) => item !== nodeId)
        : [...state.collapsedNodeIds, nodeId];

      return {
        collapsedNodeIds,
        syncStatus: 'saved',
        syncMessage: collapsedNodeIds.includes(nodeId) ? `Узел свернут: ${nodeId}.` : `Узел развернут: ${nodeId}.`,
      };
    });
  },

  setProjectSearchQuery(query) {
    set({
      projectSearchQuery: query,
      syncMessage: query ? `Поиск по проекту: "${query}".` : 'Поиск по проекту очищен.',
    });
  },

  setStatusMessage(message, status = 'idle') {
    set({ syncMessage: message, syncStatus: status });
  },

  resetWorkspace() {
    const fallback = get().mode === 'instance' ? deepClone(SAMPLE_TEB_INSTANCE) : deepClone(SAMPLE_TEB_CLASS);
    set({
      teb: fallback,
      activeTab: safeTabForDocument('general', fallback.type),
      activeDocument: 'editor',
      openDocuments: ['editor', 'scheme', 'start', 'model-text'],
      rightPanelVisible: true,
      rightPanelTab: 'properties',
      issuesPanelVisible: true,
      explorerMode: 'project',
      selectedNodeId: 'library',
      collapsedNodeIds: [],
      projectSearchQuery: '',
      simulationState: 'idle',
      schemeNodes: deepClone(INITIAL_SCHEME_NODES),
      schemeLinks: deepClone(INITIAL_SCHEME_LINKS),
      schemeSelection: { type: 'node', id: 'kitchen-choice' },
      reportCellEdits: {},
      modelLogText: '',
      issues: deepClone(INITIAL_ISSUES),
      issueFilter: 'all',
      tebTests: deepClone(INITIAL_TEB_TESTS),
      syncStatus: 'idle',
      syncMessage: 'Рабочая область сброшена к демонстрационному состоянию.',
      ...createHistory(fallback),
    });
  },

  saveWorkspaceSnapshot() {
    const state = get();
    const snapshot = snapshotFromState(state);
    writeWorkspaceSnapshot(snapshot);
    set({ syncStatus: 'syncing', syncMessage: 'Снимок рабочей области сохраняется в базе данных...' });

    void getApi(state)
      .saveWorkspaceSnapshot(snapshot)
      .then(() => {
        set({ syncStatus: 'saved', syncMessage: 'Снимок рабочей области сохранен в базе данных.' });
      })
      .catch((error) => {
        set({ syncStatus: 'offline', syncMessage: syncFailureMessage(error) });
      });
  },

  loadWorkspaceSnapshot() {
    const localSnapshot = readWorkspaceSnapshot();

    if (localSnapshot) {
      set((state) => stateFromWorkspaceSnapshot(localSnapshot, state, 'Рабочая область восстановлена из локального снимка. Проверяется версия в базе данных...'));
    } else {
      set({ syncStatus: 'syncing', syncMessage: 'Загрузка снимка рабочей области из базы данных...' });
    }

    void getApi(get())
      .getWorkspaceSnapshot()
      .then((remoteSnapshot) => {
        if (!remoteSnapshot) {
          if (!localSnapshot) {
            set({ syncStatus: 'offline', syncMessage: 'Сохраненный снимок рабочей области не найден.' });
          }
          return;
        }

        writeWorkspaceSnapshot(remoteSnapshot);
        set((state) => stateFromWorkspaceSnapshot(remoteSnapshot, state, 'Рабочая область восстановлена из базы данных.'));
      })
      .catch((error) => {
        if (!localSnapshot) {
          set({ syncStatus: 'offline', syncMessage: syncFailureMessage(error) });
        }
      });
  },

  startSimulation() {
    set((state) => ({
      simulationState: 'running',
      activeDocument: 'scheme',
      openDocuments: state.openDocuments.includes('scheme') ? state.openDocuments : [...state.openDocuments, 'scheme'],
      selectedNodeId: 'scheme',
      modelLogText: appendLogLine(state.modelLogText || buildInitialModelLog(state.teb, 'idle'), '[10:59:11] Model Translation Begun.'),
      tebTests: state.tebTests.map((test) =>
        test.id === 'test-gpss-model' ? { ...test, status: 'passed', message: 'Модель успешно подготовлена к запуску' } : test,
      ),
      issues: [
        ...state.issues.filter((issue) => issue.id !== 'issue-simulation-running'),
        {
          id: 'issue-simulation-running',
          type: 'info',
          description: 'Моделирование запущено, журнал и отчет обновлены.',
          library: 'Столовая',
          className: 'Simulation',
          instance: 'Моделирование от 10.08.2018 10:59',
          documentId: 'model-log',
        },
      ],
      syncStatus: 'saved',
      syncMessage: 'Имитационное моделирование запущено.',
    }));
  },

  stopSimulation() {
    set((state) => ({
      simulationState: 'stopped',
      modelLogText: appendLogLine(state.modelLogText || buildInitialModelLog(state.teb, 'running'), '[10:59:12] Simulation has ended. Clock is 1440.000000.'),
      syncStatus: 'saved',
      syncMessage: 'Имитационное моделирование остановлено.',
    }));
  },

  runSimulationCommand(command) {
    const commandNames: Record<SimulationCommand, string> = {
      conduct: 'CONDUCT',
      start: 'START',
      step: 'STEP',
      halt: 'HALT',
      continue: 'CONTINUE',
      clear: 'CLEAR',
      reset: 'RESET',
      show: 'SHOW',
      custom: 'CUSTOM',
    };

    if (command === 'start' || command === 'continue') {
      get().startSimulation();
    }

    if (command === 'halt') {
      get().stopSimulation();
    }

    if (command === 'conduct' || command === 'step') {
      set({
        simulationState: 'running',
        activeDocument: 'scheme',
        syncStatus: 'saved',
        syncMessage: command === 'conduct' ? 'Команда CONDUCT подготовила модель к выполнению.' : 'Выполнен один шаг моделирования.',
      });
    }

    if (command === 'clear') {
      set({ modelLogText: '', syncStatus: 'saved', syncMessage: 'Журнал моделирования очищен командой CLEAR.' });
    }

    if (command === 'reset') {
      set({
        simulationState: 'idle',
        schemeSelection: { type: 'node', id: 'kitchen-choice' },
        syncStatus: 'saved',
        syncMessage: 'Состояние моделирования сброшено командой RESET.',
      });
    }

    if (command === 'show') {
      get().activateDocument('std-report');
    }

    if (command === 'custom') {
      get().activateDocument('model-log');
    }

    set((state) => ({
      modelLogText: appendLogLine(state.modelLogText || buildInitialModelLog(state.teb, state.simulationState), `[10:59:12] Command ${commandNames[command]} executed.`),
      syncStatus: 'saved',
      syncMessage: `Команда ${commandNames[command]} выполнена и записана в журнал.`,
    }));
  },

  setSchemeNodes(updater, message = 'Структурная схема обновлена.') {
    set((state) => ({
      schemeNodes: typeof updater === 'function' ? updater(state.schemeNodes) : updater,
      syncStatus: 'saved',
      syncMessage: message,
    }));
  },

  setSchemeLinks(updater, message = 'Связи структурной схемы обновлены.') {
    set((state) => ({
      schemeLinks: typeof updater === 'function' ? updater(state.schemeLinks) : updater,
      syncStatus: 'saved',
      syncMessage: message,
    }));
  },

  setSchemeSelection(selection) {
    set({ schemeSelection: selection });
  },

  resetScheme() {
    set({
      schemeNodes: deepClone(INITIAL_SCHEME_NODES),
      schemeLinks: deepClone(INITIAL_SCHEME_LINKS),
      schemeSelection: { type: 'node', id: 'kitchen-choice' },
      syncStatus: 'saved',
      syncMessage: 'Структурная схема восстановлена.',
    });
  },

  setReportCellEdit(sectionId, rowIndex, columnIndex, value) {
    const key = `${sectionId}:${rowIndex}:${columnIndex}`;
    set((state) => ({
      reportCellEdits: { ...state.reportCellEdits, [key]: value },
      syncStatus: 'saved',
      syncMessage: 'Ячейка стандартного отчета изменена.',
    }));
  },

  setModelLogText(text, message = 'Журнал моделирования изменен.') {
    set({ modelLogText: text, syncStatus: 'saved', syncMessage: message });
  },

  appendModelLog(line) {
    set((state) => ({
      modelLogText: appendLogLine(state.modelLogText || buildInitialModelLog(state.teb, state.simulationState), line),
      syncStatus: 'saved',
      syncMessage: 'В журнал добавлена запись.',
    }));
  },

  clearModelLog() {
    set({ modelLogText: '', syncStatus: 'saved', syncMessage: 'Журнал моделирования очищен.' });
  },

  setIssueFilter(filter) {
    set({ issueFilter: filter, syncStatus: 'saved', syncMessage: 'Фильтр замечаний и ошибок изменен.' });
  },

  setTebTestStatus(id, status, message) {
    set((state) => ({
      tebTests: state.tebTests.map((test) => (test.id === id ? { ...test, status, message } : test)),
      syncStatus: status === 'failed' ? 'offline' : 'saved',
      syncMessage: message,
    }));
  },

  undo() {
    set((state) => {
      if (state.historyIndex <= 0) {
        return { syncMessage: 'Больше нечего отменять.' } as Partial<TebEditorState>;
      }

      const historyIndex = state.historyIndex - 1;
      return {
        teb: deepClone(state.history[historyIndex]),
        historyIndex,
        syncMessage: 'Последнее изменение отменено.',
      };
    });
  },

  redo() {
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) {
        return { syncMessage: 'Больше нечего повторять.' } as Partial<TebEditorState>;
      }

      const historyIndex = state.historyIndex + 1;
      return {
        teb: deepClone(state.history[historyIndex]),
        historyIndex,
        syncMessage: 'Изменение повторено.',
      };
    });
  },

  zoomInModel() {
    set((state) => ({
      modelFontSize: clamp(state.modelFontSize + 1, 11, 24),
      syncMessage: `Масштаб текста модели: ${clamp(state.modelFontSize + 1, 11, 24)} pt.`,
    }));
  },

  zoomOutModel() {
    set((state) => ({
      modelFontSize: clamp(state.modelFontSize - 1, 11, 24),
      syncMessage: `Масштаб текста модели: ${clamp(state.modelFontSize - 1, 11, 24)} pt.`,
    }));
  },

  resetModelZoom() {
    set({ modelFontSize: 14, syncMessage: 'Масштаб текста модели сброшен.' });
  },

  validateModel() {
    const text = get().teb?.gpssModel.text.trim() ?? '';
    const commands = text.split('\n').map((line) => line.trim()).filter(Boolean);

    if (!text) {
      set({ syncStatus: 'offline', syncMessage: 'Текст GPSS модели пуст.' });
      return;
    }

    const hasBlock = commands.some((line) => /QUEUE|SEIZE|ADVANCE|TRANSFER|RELEASE/.test(line));
    set({
      syncStatus: hasBlock ? 'saved' : 'offline',
      syncMessage: hasBlock
        ? `Проверка модели прошла: ${commands.length} строк, базовые GPSS-команды найдены.`
        : 'Проверка модели завершена: не найдено типовых GPSS-команд.',
    });
  },

  updateGeneralField(field, value) {
    set((state) => {
      if (!state.teb) {
        return state;
      }

      const teb = deepClone(state.teb);
      teb[field] = value;
      return {
        ...historyAwareState(state, teb),
        syncMessage: 'Локальные изменения обновлены.',
      };
    });
  },

  async commitGeneralField(field) {
    const state = get();
    const value = state.teb?.[field] ?? '';
    await runRemoteMutation(set, () => getApi(get()).updateClassProperty(field, value), 'Свойство отправлено на сервер.');
  },

  updateGpssModelText(text) {
    set((state) => {
      if (!state.teb) {
        return state;
      }

      const teb = deepClone(state.teb);
      teb.gpssModel.text = text;
      return {
        ...historyAwareState(state, teb),
        syncMessage: 'Текст модели изменен локально.',
      };
    });
  },

  async commitGpssModelText() {
    const text = get().teb?.gpssModel.text ?? '';
    await runRemoteMutation(set, () => getApi(get()).updateGpssModel(text), 'Текст GPSS модели отправлен на сервер.');
  },

  async attachImage(file) {
    const imageUrl = await readFileAsDataUrl(file);
    const imageName = file.name;

    set((state) => {
      if (!state.teb) {
        return state;
      }

      const teb = deepClone(state.teb);
      teb.imageName = imageName;
      teb.imageUrl = imageUrl;
      return {
        ...historyAwareState(state, teb),
        syncMessage: `Изображение "${file.name}" загружено.`,
      };
    });

    await runRemoteMutation(set, () => getApi(get()).updateClassProperty('image', { imageName, imageUrl }), 'Изображение отправлено на сервер.');
  },

  removeImage() {
    set((state) => {
      if (!state.teb) {
        return state;
      }

      const teb = deepClone(state.teb);
      teb.imageName = '';
      delete teb.imageUrl;
      return {
        ...historyAwareState(state, teb),
        syncMessage: 'Изображение удалено.',
      };
    });

    void runRemoteMutation(set, () => getApi(get()).updateClassProperty('image', { imageName: '', imageUrl: '' }), 'Изображение удалено на сервере.');
  },

  async addParameter() {
    const parameter = createBlankParameter();

    set((state) => {
      if (!state.teb) {
        return state;
      }

      const teb = deepClone(state.teb);
      teb.parameters.push(parameter);
      return {
        ...historyAwareState(state, teb),
        syncMessage: 'Параметр добавлен локально.',
      };
    });

    await runRemoteMutation(set, () => getApi(get()).addParameter(parameter), 'Параметр добавлен на сервере.');
  },

  async removeParameter(index) {
    set((state) => {
      if (!state.teb) {
        return state;
      }

      const teb = deepClone(state.teb);
      teb.parameters.splice(index, 1);
      return {
        ...historyAwareState(state, teb),
        syncMessage: 'Параметр удален локально.',
      };
    });

    await runRemoteMutation(set, () => getApi(get()).deleteParameter(index), 'Параметр удален на сервере.');
  },

  async moveParameter(index, direction) {
    set((state) => {
      if (!state.teb) {
        return state;
      }

      const teb = deepClone(state.teb);
      teb.parameters = reorderItems(teb.parameters, index, direction);
      return {
        ...historyAwareState(state, teb),
        syncMessage: 'Параметры переупорядочены.',
      };
    });

    await runRemoteMutation(set, () => getApi(get()).moveParameter(index, direction), 'Порядок параметров отправлен на сервер.');
  },

  updateParameter(index, field, value) {
    set((state) => {
      if (!state.teb) {
        return state;
      }

      const teb = deepClone(state.teb);
      (teb.parameters[index][field] as string | number | boolean) = value;
      return {
        ...historyAwareState(state, teb),
        syncMessage: 'Параметр изменен локально.',
      };
    });
  },

  async commitParameter(index) {
    const parameter = get().teb?.parameters[index];

    if (!parameter) {
      return;
    }

    await runRemoteMutation(set, () => getApi(get()).updateParameter(index, parameter), 'Параметр отправлен на сервер.');
  },

  async commitParameterValue(index) {
    const value = get().teb?.parameters[index]?.currentValue ?? '';
    await runRemoteMutation(set, () => getApi(get()).setParameterValue(index, value), 'Текущее значение параметра отправлено на сервер.');
  },

  addCollectionRow(collection) {
    set((state) => {
      if (!state.teb) {
        return state;
      }

      const teb = deepClone(state.teb);
      if (collection === 'gpssEntities') {
        teb.gpssEntities.push(createBlankGpssEntity());
      }
      if (collection === 'inputs') {
        teb.inputs.push(createBlankPort());
      }
      if (collection === 'outputs') {
        teb.outputs.push(createBlankPort());
      }
      if (collection === 'states') {
        teb.states.push(createBlankState());
      }
      return {
        ...historyAwareState(state, teb),
        syncMessage: 'Строка добавлена.',
      };
    });

    void runRemoteMutation(set, () => getApi(get()).updateClassProperty(collection, get().teb?.[collection] ?? []), 'Коллекция обновлена на сервере.');
  },

  removeCollectionRow(collection, index) {
    set((state) => {
      if (!state.teb) {
        return state;
      }

      const teb = deepClone(state.teb);
      teb[collection].splice(index, 1);
      return {
        ...historyAwareState(state, teb),
        syncMessage: 'Строка удалена.',
      };
    });

    void runRemoteMutation(set, () => getApi(get()).updateClassProperty(collection, get().teb?.[collection] ?? []), 'Коллекция обновлена на сервере.');
  },

  moveCollectionRow(collection, index, direction) {
    set((state) => {
      if (!state.teb) {
        return state;
      }

      const teb = deepClone(state.teb);
      teb[collection] = reorderItems(teb[collection], index, direction) as TebDocument[CollectionKey];
      return {
        ...historyAwareState(state, teb),
        syncMessage: 'Строка перемещена.',
      };
    });

    void runRemoteMutation(set, () => getApi(get()).updateClassProperty(collection, get().teb?.[collection] ?? []), 'Порядок элементов обновлен на сервере.');
  },

  updateCollectionField(collection, index, field, value) {
    set((state) => {
      if (!state.teb) {
        return state;
      }

      const teb = deepClone(state.teb);
      const row = teb[collection][index] as Record<string, string | number | boolean>;
      row[field] = value;
      return {
        ...historyAwareState(state, teb),
        syncMessage: 'Табличные данные обновлены.',
      };
    });
  },

  async commitCollectionField(collection, index) {
    const row = get().teb?.[collection][index];

    if (!row) {
      return;
    }

    await runRemoteMutation(set, () => getApi(get()).updateClassProperty(`${collection}[${index}]`, row), 'Изменение строки отправлено на сервер.');
  },
}));

export const editorTabLabels = EDITOR_TABS;
