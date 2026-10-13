/** Contracts of `/api/alina-gpss/studio/experiments` (backend/GpssStudio.Simulation/Experiments). */
export type FactorKind = 'Savevalue' | 'Storage' | 'Equ';

export interface ExperimentFactor {
  Name: string;
  Kind: FactorKind;
  Levels: number[];
}

export interface ExperimentIndicator {
  Expression: string;
  Label?: string | null;
}

export interface ExperimentRequest {
  ModelText: string;
  Factors: ExperimentFactor[];
  Indicators: ExperimentIndicator[];
  Replications: number;
  StartCount: number;
  ObjectiveIndicator?: number | null;
  Maximize: boolean;
}

export interface IndicatorSummary {
  Mean: number;
  StandardDeviation: number;
  ConfidenceHalfWidth: number;
  Min: number;
  Max: number;
  Count: number;
}

export interface ExperimentPoint {
  Index: number;
  Factors: number[];
  Indicators: Array<IndicatorSummary | null>;
  Failed: number;
}

export interface ExperimentRun {
  Point: number;
  Replication: number;
  Factors: number[];
  Indicators: Array<number | null>;
  Clock: number;
  Error: string | null;
}

export interface ExperimentResult {
  FactorNames: string[];
  IndicatorNames: string[];
  Points: ExperimentPoint[];
  Runs: ExperimentRun[];
  BestPoint: number | null;
  ElapsedSeconds: number;
  Messages: string[];
}
