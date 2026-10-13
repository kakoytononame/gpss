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
import type { GenerationResult, ProjectSummary, StudioProject, StudioTebLink } from '../../../shared/types/project';
import type { SimulationReport, TransactionState } from '../../../shared/types/simulation';

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
  /** Lines of the model text with breakpoints (sent as stop conditions to the simulator). */
  breakpointLines: number[];
  /** Debugger "model state" from the last simulator response. */
  modelState: ModelState | null;
}

export interface ModelState {
  clock: number;
  terminationCount: number;
  transactions: TransactionState[];
  /** Source line of every block (index = block number - 1). */
  blockLines: number[];
  stopReason: string | null;
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
  /** Sets or removes a breakpoint on a line of the model text (the line must hold a block). */
  toggleBreakpoint: (line: number) => Promise<void>;
  clearBreakpoints: () => Promise<void>;
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
  /** Downloads the standard report as a CSV file for Excel. */
  exportReport: () => void;
  /** Copies the standard report tables to the clipboard (tab-separated). */
  copyReport: () => Promise<void>;
  setIssueFilter: (filter: IssueFilter) => void;
  setTebTestStatus: (id: string, status: TebTestStatus, message: string) => void;
}

export interface ProjectSliceState {
  projects: ProjectSummary[];
  projectsLoading: boolean;
  /** Simulation project open in the workspace (GPSS Studio format). */
  project: StudioProject | null;
  projectModelIndex: number;
  /** Composite TEBs entered from the root scheme of the model. */
  schemePath: string[];
  /** The project has changes not yet saved on the server. */
  projectDirty: boolean;
  projectBusy: boolean;
  generation: GenerationResult | null;
  /** Project TEB shown in the TEB editor. */
  editingNodeId: string | null;
}

export interface ProjectSliceActions {
  loadProjects: () => Promise<void>;
  createProject: (name: string, description?: string) => Promise<void>;
  /** Imports a GPSS Studio project archive (.zip) or a model file (.gps / .txt). */
  importProject: (file: File) => Promise<void>;
  /** `keepLayout` leaves the open documents unchanged (used when the workspace is restored). */
  openProject: (id: string, options?: { keepLayout?: boolean }) => Promise<void>;
  closeProject: () => void;
  saveProject: () => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  selectProjectModel: (index: number) => void;
  enterComposite: (nodeId: string) => void;
  /** Goes up the composite hierarchy to the given depth (0 = root scheme). */
  leaveToSchemeLevel: (depth: number) => void;
  /** Double click on a scheme node: enters a composite TEB or opens the TEB editor. */
  openSchemeNode: (nodeId: string) => void;
  /** Writes the edits of the structural scheme document into the project document. */
  flushSchemeToProject: () => void;
  openProjectTeb: (nodeId: string) => void;
  /** Writes the TEB editor document into the project (TEB editor in project mode). */
  applyTebToProject: (message: string) => void;
  generateModelText: () => Promise<void>;
  /** Changes a connection of the current scheme level (ports, priority, probability, model). */
  updateProjectLink: (linkId: string, patch: Partial<Omit<StudioTebLink, 'Id' | 'FromNodeId' | 'ToNodeId'>>) => void;
}

export interface PersistenceActions {
  resetWorkspace: () => void;
  saveWorkspaceSnapshot: () => Promise<void>;
  /** `quiet` suppresses the "nothing saved yet" notice used on application start. */
  loadWorkspaceSnapshot: (options?: { quiet?: boolean }) => Promise<void>;
}

export type TebEditorState = SyncState &
  WorkspaceLayoutState &
  TebEditorDataState &
  SimulationSliceState &
  SchemeSliceState &
  DiagnosticsSliceState &
  ProjectSliceState;

export type TebEditorActions = SyncActions &
  WorkspaceLayoutActions &
  TebEditorDataActions &
  SimulationSliceActions &
  SchemeSliceActions &
  DiagnosticsSliceActions &
  ProjectSliceActions &
  PersistenceActions;

export type TebEditorStore = TebEditorState & TebEditorActions;
