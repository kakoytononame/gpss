/** Contracts of `/api/alina-gpss/studio/results` (backend/GpssStudio.WebApi/Controllers/ResultsController.cs). */
import type { ExperimentFactor, ExperimentIndicator, ExperimentResult } from './experiment';
import type { SimulationReport } from './simulation';

export type SimulationResultKind = 'single' | 'series';

/** Entry of the result tree (without the payload). */
export interface SimulationResultSummary {
  Id: string;
  ProjectId: string | null;
  Kind: SimulationResultKind;
  Name: string;
  CreatedAt: string;
}

/** Value of one operand of the form's input data at the time of the run. */
export interface ResultInputValue {
  Input: string;
  Name: string;
  Operand: string;
  Value: string;
}

/** Payload of a single experiment: the model, its input data and the standard report (with dynamics). */
export interface SingleResultPayload {
  ModelName: string;
  ModelText: string;
  FormName: string | null;
  Inputs: ResultInputValue[];
  /** Termination count of the form's run settings (null when the run did not use a form). */
  StartCount: number | null;
  Report: SimulationReport;
}

/** Payload of a series of experiments: the model, the plan and the table of points. */
export interface SeriesResultPayload {
  ModelName: string;
  ModelText: string;
  Factors: ExperimentFactor[];
  Indicators: ExperimentIndicator[];
  Replications: number;
  StartCount: number;
  Maximize: boolean;
  Result: ExperimentResult;
}

export type SimulationResultDetail =
  (SimulationResultSummary & { Kind: 'single'; Payload: SingleResultPayload }) | (SimulationResultSummary & { Kind: 'series'; Payload: SeriesResultPayload });
