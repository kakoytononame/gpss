export type EditorMode = 'class' | 'instance';
export type TabId = 'general' | 'gpss-model' | 'gpss-objects' | 'inputs' | 'outputs' | 'parameters' | 'states';
export type CollectionKey = 'gpssEntities' | 'inputs' | 'outputs' | 'states';
export type Direction = 'up' | 'down';
export type SourceKind = 'idle' | 'api' | 'sample';
export type SyncStatus = 'idle' | 'syncing' | 'saved' | 'offline';
export type ActiveDocument = 'editor' | 'scheme' | 'start' | 'model-text' | 'std-report' | 'model-log';
export type SimulationState = 'idle' | 'running' | 'stopped';

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
  activeDocument: ActiveDocument;
  openDocuments?: ActiveDocument[];
  explorerVisible: boolean;
  collapsedNodeIds?: string[];
  selectedNodeId?: string;
  modelFontSize: number;
}

export interface TebApi {
  getClass: () => Promise<unknown>;
  getInstance: () => Promise<unknown>;
  addParameter: (parameter: TebParameter) => Promise<unknown>;
  deleteParameter: (index: number) => Promise<unknown>;
  updateClassProperty: (path: string, value: unknown) => Promise<unknown>;
  updateGpssModel: (text: string) => Promise<unknown>;
  updateParameter: (index: number, parameter: TebParameter) => Promise<unknown>;
  moveParameter: (index: number, direction: Direction) => Promise<unknown>;
  setParameterValue: (parameterIndex: number, value: string | number) => Promise<unknown>;
}
