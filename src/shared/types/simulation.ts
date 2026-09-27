/** Contracts of the GPSS simulation API (backend/GpssStudio.WebApi/Controllers/SimulationController.cs). */

export type SimulationRunState = 'idle' | 'paused' | 'completed' | 'error';

export interface TranslationError {
  Line: number;
  Message: string;
}

export interface SimulationReportSection {
  Id: string;
  Label: string;
  Columns: string[];
  Rows: string[][];
}

export interface ChartBar {
  Name: string;
  Value: number;
}

export interface ChartSeries {
  Kind: 'queue' | 'storage';
  Name: string;
  /** [time, value] pairs of a step function. */
  Points: Array<[number, number]>;
}

export interface TableHistogram {
  Name: string;
  Mean: number;
  StandardDeviation: number;
  Count: number;
  Bins: Array<{ Label: string; Frequency: number }>;
}

export interface SimulationCharts {
  TimeSeries: ChartSeries[];
  FacilityUtilization: ChartBar[];
  QueueAverageContent: ChartBar[];
  QueueAverageTime: ChartBar[];
  StorageUtilization: ChartBar[];
  BlockEntries: ChartBar[];
  Tables: TableHistogram[];
}

export interface SimulationReport {
  ModelName: string;
  CreatedAt: string;
  StartTime: number;
  EndTime: number;
  Sections: SimulationReportSection[];
  Charts: SimulationCharts;
}

export interface SimulationResult {
  SessionId: string | null;
  Success: boolean;
  State: SimulationRunState;
  Clock: number;
  TerminationCount: number;
  Errors: TranslationError[];
  RuntimeError: string | null;
  Journal: string[];
  Report: SimulationReport | null;
}

export interface ExampleModel {
  Id: string;
  Name: string;
  Text: string;
}
