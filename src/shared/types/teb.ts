export type EditorMode = 'class' | 'instance';
export type TabId = 'general' | 'gpss-model' | 'gpss-objects' | 'inputs' | 'outputs' | 'parameters' | 'states';
export type CollectionKey = 'gpssEntities' | 'inputs' | 'outputs' | 'states';
export type Direction = 'up' | 'down';
export type SourceKind = 'idle' | 'api' | 'sample';
export type SyncStatus = 'idle' | 'syncing' | 'saved' | 'offline';
export type ActiveDocument = 'editor' | 'scheme' | 'start' | 'model-text' | 'std-report' | 'model-log';
export type SimulationState = 'idle' | 'running' | 'stopped';
export type RightPanelTab = 'properties' | 'teb-tests';
export type ExplorerMode = 'project' | 'libraries';
export type SchemeNodeKind = 'teb' | 'data' | 'time';
export type SchemeSelection = { type: 'node'; id: string } | { type: 'link'; id: string } | null;
export type ReportSectionId = 'general' | 'names' | 'blocks' | 'facilities' | 'queues' | 'storages' | 'switches' | 'savevalues' | 'future';
export type IssueType = 'error' | 'warning' | 'info';
export type TebTestStatus = 'passed' | 'failed' | 'not-run' | 'running';
export type SimulationCommand = 'conduct' | 'start' | 'step' | 'halt' | 'continue' | 'clear' | 'reset' | 'show' | 'custom';

export interface EditorQuery {
  apiBaseUrl: string;
  libraryId: string;
  classId: string;
  instanceClassId: string;
  instanceId: string;
  mode: EditorMode;
}

export interface GpssModel {
  text: string;
}

export interface GpssEntity {
  id: string;
  type: string;
  nameInModel: string;
  value: string | number;
  description: string;
}

export interface TebPort {
  id: string;
  nameInModel: string;
  header: string;
  connectedBlock: string;
  connectionsLimit: string | number;
  description: string;
}

export interface TebParameter {
  id: string;
  type: string;
  header: string;
  nameInModel: string;
  defaultValue: string | number;
  allowEmptyValues: boolean;
  currentValue: string | number;
}

export interface TebState {
  id: string;
  name: string;
  expression: string;
  description: string;
}

export interface TebDocument {
  id: string;
  instanceId: string;
  mode: EditorMode;
  type: string;
  nameInModel: string;
  header: string;
  description: string;
  imageName: string;
  imageUrl?: string;
  gpssModel: GpssModel;
  gpssEntities: GpssEntity[];
  inputs: TebPort[];
  outputs: TebPort[];
  parameters: TebParameter[];
  states: TebState[];
  childInstances: unknown[];
}

export interface SchemeNode {
  id: string;
  label: string;
  kind: SchemeNodeKind;
  iconShape?: string;
  nameInModel?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  description?: string;
  className?: string;
  classId?: string;
  isLibraryClass?: boolean;
  instanceCount?: number;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  cornerRadius?: number;
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  fontBold?: boolean;
  fontItalic?: boolean;
  imageMode?: string;
  moveMode?: string;
  shape?: string;
  hidden?: boolean;
}

export interface SchemeLink {
  id: string;
  from: string;
  to: string;
  hidden?: boolean;
}

export interface IssueItem {
  id: string;
  type: IssueType;
  description: string;
  library: string;
  className: string;
  instance: string;
  documentId?: ActiveDocument;
  sourceNodeId?: string;
}

export interface TebTestItem {
  id: string;
  name: string;
  status: TebTestStatus;
  message: string;
  sourceNodeId?: string;
}

export interface TabDefinition {
  id: TabId;
  label: string;
}

export interface OptionDefinition {
  value: string;
  label: string;
}

export interface WorkspaceSnapshot {
  teb: TebDocument | null;
  mode: EditorMode;
  activeTab: TabId;
  activeDocument: ActiveDocument | null;
  openDocuments?: ActiveDocument[];
  explorerVisible: boolean;
  rightPanelVisible?: boolean;
  rightPanelTab?: RightPanelTab;
  issuesPanelVisible?: boolean;
  explorerMode?: ExplorerMode;
  collapsedNodeIds?: string[];
  selectedNodeId?: string;
  modelFontSize: number;
  simulationState?: SimulationState;
  schemeNodes?: SchemeNode[];
  schemeLinks?: SchemeLink[];
  reportCellEdits?: Record<string, string>;
  modelLogText?: string;
  issues?: IssueItem[];
  tebTests?: TebTestItem[];
}

export interface TebApi {
  getClass: () => Promise<unknown>;
  getInstance: () => Promise<unknown>;
  getWorkspaceSnapshot: () => Promise<WorkspaceSnapshot | null>;
  saveWorkspaceSnapshot: (snapshot: WorkspaceSnapshot) => Promise<unknown>;
  addParameter: (parameter: TebParameter) => Promise<unknown>;
  deleteParameter: (index: number) => Promise<unknown>;
  updateClassProperty: (path: string, value: unknown) => Promise<unknown>;
  updateGpssModel: (text: string) => Promise<unknown>;
  updateParameter: (index: number, parameter: TebParameter) => Promise<unknown>;
  moveParameter: (index: number, direction: Direction) => Promise<unknown>;
  setParameterValue: (parameterIndex: number, value: string | number) => Promise<unknown>;
}
