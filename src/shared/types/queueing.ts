/** Queueing systems constructor (mirrors GpssStudio.Simulation.Queueing; PascalCase as in the API). */

export type DistributionKind =
  | 'Exponential'
  | 'Deterministic'
  | 'Erlang'
  | 'HyperExponential'
  | 'Uniform'
  | 'Normal'
  | 'LogNormal'
  | 'Triangular'
  | 'Gamma'
  | 'Weibull';

export interface Distribution {
  Kind: DistributionKind;
  Mean?: number;
  /** Coefficient of variation (H2, Normal, LogNormal, Gamma). */
  Cv?: number;
  /** Erlang phases or Weibull shape. */
  Shape?: number;
  Min?: number;
  Max?: number;
  Mode?: number;
}

export type BatchKind = 'Fixed' | 'Uniform' | 'Geometric';

export interface BatchSize {
  Kind: BatchKind;
  Size?: number;
  Min?: number;
  Max?: number;
}

export type CustomerClassKind = 'Open' | 'Closed';

export interface ServiceOverride {
  Node: string;
  Service: Distribution;
}

export interface CustomerClass {
  Id: string;
  Name: string;
  Kind: CustomerClassKind;
  Arrival?: Distribution | null;
  Batch?: BatchSize | null;
  Population?: number;
  Think?: Distribution | null;
  Priority: number;
  Entry: string;
  Services?: ServiceOverride[];
}

export type QueueDiscipline = 'Fifo' | 'Lifo' | 'Random' | 'ShortestJob' | 'Priority' | 'PreemptivePriority' | 'RoundRobin';
export type BalkingKind = 'None' | 'Linear' | 'Discouraged';
export type FullPolicy = 'Lose' | 'Retry';

export interface QueueingRoute {
  Target: string | null;
  Probability: number;
}

export interface QueueingNode {
  Id: string;
  Name: string;
  /** 0 — unlimited servers. */
  Servers: number;
  /** Places at the node (waiting and in service); null — unlimited. */
  Capacity?: number | null;
  Discipline: QueueDiscipline;
  Quantum?: number;
  Service: Distribution;
  WhenFull?: FullPolicy;
  Retrial?: Distribution | null;
  Patience?: Distribution | null;
  Balking?: BalkingKind;
  BalkingThreshold?: number;
  TimeToFailure?: Distribution | null;
  Repair?: Distribution | null;
  Vacation?: Distribution | null;
  Routes: QueueingRoute[];
}

export interface QueueingModel {
  Name: string;
  TimeUnit: string;
  Duration: number;
  WarmUp: number;
  Replications: number;
  Seed: number;
  Classes: CustomerClass[];
  Nodes: QueueingNode[];
}

export interface QueueingPreset {
  Id: string;
  Group: string;
  Title: string;
  Description: string;
  Model: QueueingModel;
}

export type AnalysisQuality = 'Exact' | 'Approximate' | 'Unavailable';

export type NodeMetricKey =
  | 'ArrivalRate'
  | 'Throughput'
  | 'Utilization'
  | 'BusyServers'
  | 'L'
  | 'Lq'
  | 'W'
  | 'Wq'
  | 'LossProbability'
  | 'BalkProbability'
  | 'RenegeProbability'
  | 'OrbitSize'
  | 'OrbitTime'
  | 'DownFraction'
  | 'VacationFraction';

export type QueueingMetrics = Partial<Record<NodeMetricKey, number | null>>;

export interface NodeAnalysis {
  NodeId: string;
  Name: string;
  Kendall: string;
  Discipline: string;
  Quality: AnalysisQuality;
  Method: string;
  Notes: string[];
  Metrics: QueueingMetrics;
}

export interface ClassAnalysis {
  ClassId: string;
  Name: string;
  Quality: AnalysisQuality;
  Throughput?: number | null;
  ResponseTime?: number | null;
  InSystem?: number | null;
  LossProbability?: number | null;
}

export interface QueueingAnalysis {
  Nodes: NodeAnalysis[];
  Classes: ClassAnalysis[];
  Network: string;
  Messages: string[];
}

export interface MetricComparison {
  Key: string;
  Label: string;
  Analytic?: number | null;
  Mean?: number | null;
  HalfWidth?: number | null;
  Deviation?: number | null;
  Agrees?: boolean | null;
}

export interface NodeRunResult {
  NodeId: string;
  Name: string;
  GpssName: string;
  Analysis: NodeAnalysis;
  Metrics: MetricComparison[];
}

export interface ClassRunResult {
  ClassId: string;
  Name: string;
  Quality: AnalysisQuality;
  Metrics: MetricComparison[];
}

export interface QueueingRunResult {
  ModelText: string;
  Analysis: QueueingAnalysis;
  Nodes: NodeRunResult[];
  Classes: ClassRunResult[];
  Replications: number;
  ElapsedSeconds: number;
  Messages: string[];
}

export interface GeneratedQueueingModel {
  Text: string;
  Warnings: string[];
}

export type InsightSeverity = 'Info' | 'Warning' | 'Critical';

export interface QueueingInsight {
  Severity: InsightSeverity;
  NodeId: string | null;
  Title: string;
  Text: string;
}

export interface QueueingInsightsResponse {
  Findings: QueueingInsight[];
  /** Explanation written by the configured language model, if any. */
  Explanation: string | null;
  Provider: string | null;
  ModelName: string | null;
  Error: string | null;
}
