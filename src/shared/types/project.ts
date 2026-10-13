/**
 * Simulation project in the GPSS Studio format, as returned by `/api/alina-gpss/studio/projects`
 * (PascalCase, mirrors `GpssStudio.Projects.Model`).
 */
export type TebKind = 'simple' | 'composite' | 'data' | 'transaction';
export type ConnectedBlockMode = 'FirstBlock' | 'LastBlock' | 'Label' | 'NotSet';
export type TransferMode = 'DirectOrSplit' | 'FirstAvail' | 'Random' | 'CustomModel';

export interface StudioProject {
  Id: string;
  Name: string;
  Description?: string | null;
  CreatedAt?: string | null;
  Models: StudioModel[];
  Libraries: TebLibrary[];
  ImportNotes: string[];
}

export interface StudioModel {
  Name: string;
  Description?: string | null;
  IsCurrent: boolean;
  Scheme?: TebScheme | null;
  ModelText?: string | null;
  Forms: string[];
}

export interface TebScheme {
  Nodes: StudioTebNode[];
  Links: StudioTebLink[];
  Decors: SchemeDecor[];
  Boundary: BoundaryConnector[];
}

export interface StudioTebNode {
  Id: string;
  Kind: TebKind;
  Header: string;
  NameInModel?: string | null;
  Description?: string | null;
  ClassId: string;
  LibraryId?: string | null;
  InstancesCount: number;
  X: number;
  Y: number;
  Width: number;
  Height: number;
  BackgroundColor?: string | null;
  BorderColor?: string | null;
  TextColor?: string | null;
  GpssText?: string | null;
  Entities: DataEntity[];
  Inputs: StudioTebPort[];
  Outputs: StudioTebPort[];
  Parameters: StudioTebParameter[];
  States: StudioTebState[];
  Child?: TebScheme | null;
}

export interface StudioTebPort {
  Id: number;
  Mode: ConnectedBlockMode;
  Label?: string | null;
  ConnectionsLimit: number;
  Description?: string | null;
  TransferMode: TransferMode;
  GpssText?: string | null;
  Side: number;
  Position: number;
}

export interface StudioTebLink {
  Id: string;
  FromNodeId: string;
  FromPortId: number;
  ToNodeId: string;
  ToPortId: number;
  Priority: number;
  Probability: number;
  OrderIndex: number;
  Description?: string | null;
  GpssText?: string | null;
  Points: { X: number; Y: number }[];
}

export interface BoundaryConnector {
  Id: string;
  Direction: 'input' | 'output';
  DefinitionId: number;
}

export interface SchemeDecor {
  Kind: string;
  X: number;
  Y: number;
  Width: number;
  Height: number;
  Text?: string | null;
}

export interface DataEntity {
  Type: string;
  Name: string;
  Value?: string | null;
  Description?: string | null;
  Cells?: string[][] | null;
  FunctionType?: string | null;
  Points?: string[] | null;
}

export interface StudioTebParameter {
  Id: number;
  Type: string;
  NameInModel: string;
  Header?: string | null;
  DefaultValue?: string | null;
  Value?: string | null;
}

export interface StudioTebState {
  Name: string;
  Expression: string;
  Description?: string | null;
}

export interface TebLibrary {
  Id: string;
  Version: string;
  Name: string;
  Description?: string | null;
  IsEditable: boolean;
  Classes: { Category: string; Template: StudioTebNode }[];
}

export interface ProjectSummary {
  Id: string;
  Name: string;
  Description?: string | null;
  ModelCount: number;
  UpdatedAt: string;
}

export type GenerationSeverity = 'error' | 'warning' | 'info';

export interface GenerationMessage {
  Severity: GenerationSeverity;
  Message: string;
  NodeId?: string | null;
  Teb?: string | null;
}

export interface GenerationResult {
  Text: string;
  Messages: GenerationMessage[];
  GeneratedLines: number;
  Success: boolean;
}
