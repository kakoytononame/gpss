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
  /** Final report of the project (missing in documents of older servers). */
  Report?: ProjectReport;
}

export type ReportFragmentKind = 'heading' | 'text' | 'code' | 'table' | 'image';

/** Fragment of the final report: text, preformatted text, table or picture (PNG data URI). */
export interface ReportFragment {
  Id: string;
  Kind: ReportFragmentKind;
  Title: string;
  Text?: string | null;
  Columns?: string[];
  Rows?: string[][];
  Image?: string | null;
  /** Where the fragment was taken from (result and tab). */
  Source?: string | null;
}

export interface ProjectReport {
  Title: string;
  Fragments: ReportFragment[];
}

export interface StudioModel {
  Name: string;
  Description?: string | null;
  IsCurrent: boolean;
  Scheme?: TebScheme | null;
  ModelText?: string | null;
  Forms: string[];
  /** Contents of the forms (Form.fog) found when the project was imported. */
  UserForms?: StudioForm[];
}

/** User form of a model: input data bound to operands, entry / dynamic layouts, indicators and plan. */
export interface StudioForm {
  Name: string;
  ModelText?: string | null;
  Inputs: FormInput[];
  EntryForm?: FormControl | null;
  DynamicForm?: FormControl | null;
  HasAnimation: boolean;
  Indicators: FormIndicator[];
  Run: FormRunSettings;
  Plan?: FormPlan | null;
  /** Resource path (e.g. "/Resources/Image1.png") → data URI. */
  Images: Record<string, string>;
}

export interface FormInput {
  Number: number;
  Name: string;
  Kind: string;
  Operator: string;
  /** 1-based line of the form's model text. */
  Line: number;
  Operands: FormOperand[];
}

export interface FormOperand {
  Name: string;
  Operand: string;
  ValueType: string;
  Value: string;
  DefaultValue?: string | null;
}

export interface FormIndicator {
  Id: number;
  Title: string;
  Object: string;
  ObjectType: string;
  Sna: string;
  Expression?: string | null;
  Monitored: boolean;
}

export interface FormRunSettings {
  StartCount: number;
  CollectDynamics: boolean;
  MonitorInterval: number;
  ModelTimeUnit?: string | null;
  Period?: number | null;
  PeriodUnit?: string | null;
}

export interface FormPlan {
  Method: string;
  Factors: FormFactor[];
  Targets: Array<{ Name: string; Expression: string }>;
  Points: number[][];
}

export interface FormFactor {
  Id: number;
  Name: string;
  Line: number;
  Operand: string;
  Object?: string | null;
  Default?: number | null;
  Min?: number | null;
  Max?: number | null;
  Step?: number | null;
}

export type FormControlType = 'panel' | 'label' | 'group' | 'tabs' | 'tab' | 'input' | 'combo' | 'check' | 'sna' | 'picture' | 'chart' | 'clock';

export interface FormControl {
  Type: FormControlType;
  Name: string;
  X: number;
  Y: number;
  Width: number;
  Height: number;
  Text?: string | null;
  ForeColor?: string | null;
  BackColor?: string | null;
  FontName?: string | null;
  FontSize: number;
  FontStyle?: string | null;
  TextAlign?: string | null;
  Input?: number | null;
  Operand?: string | null;
  Value?: string | null;
  Choices: Array<{ Label: string; Value: string }>;
  Indicator?: number | null;
  Intervals: Array<{ Low: number; High: number; TextColor?: string | null; BackColor?: string | null }>;
  Image?: string | null;
  SizeMode?: string | null;
  Series: Array<{ Name: string; ViewType: string; Points: Array<{ Argument: string; Indicator: number }> }>;
  Children: FormControl[];
}

export interface ApplyFormResult {
  Text: string;
  Messages: string[];
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
