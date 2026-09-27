import type {
  ActiveDocument,
  CollectionKey,
  Direction,
  EditorMode,
  EditorQuery,
  ExplorerMode,
  IssueFilter,
  IssueItem,
  ReportCellEdits,
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
  TebTestStatus,
} from '../../../shared/types/teb';
import type { SimulationReport } from '../../../shared/types/simulation';

type Updater<T> = T | ((current: T) => T);

export interface SyncState {
  syncStatus: SyncStatus;
  syncMessage: string;
}

export interface SyncActions {
  setStatusMessage: (message: string, status?: SyncStatus) => void;
}

export interface WorkspaceLayoutState {
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
  /** Incremented to ask the project explorer to focus its search box. */
  projectSearchFocusRequest: number;
}

export interface WorkspaceLayoutActions {
  activateDocument: (documentId: ActiveDocument) => void;
  closeDocument: (documentId: ActiveDocument) => void;
  focusProjectNode: (nodeId: string) => void;
  selectProjectNode: (nodeId: string) => void;
  toggleExplorer: () => void;
  showExplorer: () => void;
  toggleRightPanel: () => void;
  openRightPanel: (tab?: RightPanelTab) => void;
  setRightPanelTab: (tab: RightPanelTab) => void;
  toggleIssuesPanel: () => void;
  openIssuesPanel: () => void;
  setExplorerMode: (mode: ExplorerMode) => void;
  toggleTreeNode: (nodeId: string) => void;
  expandTreeNodes: (nodeIds: string[]) => void;
  setProjectSearchQuery: (query: string) => void;
  requestProjectSearchFocus: () => void;
}

export interface TebEditorDataState extends EditorQuery {
  teb: TebDocument | null;
  loading: boolean;
  loadError: string;
  source: SourceKind;
  activeTab: TabId;
  modelFontSize: number;
  history: TebDocument[];
  historyIndex: number;
}

export interface TebEditorDataActions {
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  setActiveTab: (tabId: TabId) => void;
  setMode: (mode: EditorMode) => Promise<void>;
  undo: () => void;
  redo: () => void;
  zoomInModel: () => void;
  zoomOutModel: () => void;
  resetModelZoom: () => void;
  validateModel: () => void;
  updateGeneralField: (field: GeneralField, value: string) => void;
  commitGeneralField: (field: GeneralField) => Promise<void>;
  updateGpssModelText: (text: string) => void;
  commitGpssModelText: () => Promise<void>;
  attachImage: (file: File) => Promise<void>;
  removeImage: () => Promise<void>;
  addParameter: () => Promise<void>;
  removeParameter: (index: number) => Promise<void>;
  moveParameter: (index: number, direction: Direction) => Promise<void>;
  updateParameter: (index: number, field: keyof TebParameter, value: string | number | boolean) => void;
  commitParameter: (index: number) => Promise<void>;
  commitParameterValue: (index: number) => Promise<void>;
  addCollectionRow: (collection: CollectionKey) => Promise<void>;
  removeCollectionRow: (collection: CollectionKey, index: number) => Promise<void>;
  moveCollectionRow: (collection: CollectionKey, index: number, direction: Direction) => Promise<void>;
  updateCollectionField: (collection: CollectionKey, index: number, field: string, value: string | number | boolean) => void;
  commitCollectionField: (collection: CollectionKey, index: number) => Promise<void>;
}

export type GeneralField = 'nameInModel' | 'header' | 'description';

export interface SimulationSliceState {
  simulationState: SimulationState;
  /** Full GPSS model of the project ("Текст модели"). */
  modelText: string;
  /** Server-side simulation session (lives in API memory, not persisted). */
  simulationSessionId: string | null;
  simulationReport: SimulationReport | null;
  simulationBusy: boolean;
  /** Incremented to ask the journal to focus its command line. */
  commandLineFocusRequest: number;
}

export interface SimulationSliceActions {
  loadExampleModel: () => Promise<void>;
  setModelText: (text: string) => void;
  validateModelText: () => Promise<void>;
  /** Translates the model and runs it to completion (START from the model, otherwise START 1). */
  startSimulation: () => Promise<void>;
  stopSimulation: () => Promise<void>;
  runSimulationCommand: (command: SimulationCommand) => Promise<void>;
  /** Executes any GPSS command, e.g. "START 5" or "SHOW Q$BUF1". */
  executeSimulationCommand: (commandText: string) => Promise<void>;
  requestCommandLineFocus: () => void;
}

export interface SchemeSliceState {
  schemeNodes: SchemeNode[];
  schemeLinks: SchemeLink[];
  schemeSelection: SchemeSelection;
}

export interface SchemeSliceActions {
  setSchemeNodes: (updater: Updater<SchemeNode[]>, message?: string) => void;
  setSchemeLinks: (updater: Updater<SchemeLink[]>, message?: string) => void;
  setSchemeSelection: (selection: SchemeSelection) => void;
  resetScheme: () => void;
}

export interface DiagnosticsSliceState {
  reportCellEdits: ReportCellEdits;
  modelLogText: string;
  issues: IssueItem[];
  issueFilter: IssueFilter;
  tebTests: TebTestItem[];
}

export interface DiagnosticsSliceActions {
  setReportCellEdit: (sectionId: string, rowIndex: number, columnIndex: number, value: string) => void;
  setModelLogText: (text: string, message?: string) => void;
  appendModelLog: (line: string) => void;
  clearModelLog: () => void;
  setIssueFilter: (filter: IssueFilter) => void;
  setTebTestStatus: (id: string, status: TebTestStatus, message: string) => void;
}

export interface PersistenceActions {
  resetWorkspace: () => void;
  saveWorkspaceSnapshot: () => Promise<void>;
  /** `quiet` suppresses the "nothing saved yet" notice used on application start. */
  loadWorkspaceSnapshot: (options?: { quiet?: boolean }) => Promise<void>;
}

export type TebEditorState = SyncState & WorkspaceLayoutState & TebEditorDataState & SimulationSliceState & SchemeSliceState & DiagnosticsSliceState;

export type TebEditorActions = SyncActions &
  WorkspaceLayoutActions &
  TebEditorDataActions &
  SimulationSliceActions &
  SchemeSliceActions &
  DiagnosticsSliceActions &
  PersistenceActions;

export type TebEditorStore = TebEditorState & TebEditorActions;
