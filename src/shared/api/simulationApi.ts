import type { ExampleModel, SimulationResult } from '../types/simulation';
import { createHttpClient } from './httpClient';

const SIMULATION_ROOT = '/api/alina-gpss/studio/simulation';

/** Indicators collected over model time ("динамика показателей") and the sampling interval. */
export interface SimulationMonitoring {
  monitors: Array<{ Expression: string; Label?: string | null }>;
  interval: number;
}

export interface SimulationApi {
  translate: (text: string) => Promise<SimulationResult>;
  createSession: (text: string, modelName: string, breakpointLines?: number[], monitoring?: SimulationMonitoring | null) => Promise<SimulationResult>;
  execute: (sessionId: string, command: string) => Promise<SimulationResult>;
  /** Values of SNA expressions in the current state of a session (null where not computable). */
  evaluate: (sessionId: string, expressions: string[]) => Promise<Array<number | null>>;
  getExample: (exampleId: string) => Promise<ExampleModel>;
}

/** Client of the server-side GPSS simulator. */
export function createSimulationApi(apiBaseUrl: string, fetchImpl?: typeof fetch): SimulationApi {
  const request = createHttpClient(apiBaseUrl, fetchImpl);
  const post = (path: string, body: unknown) => request(`${SIMULATION_ROOT}${path}`, { method: 'POST', body: JSON.stringify(body) });

  return {
    translate: async (text) => (await post('/translate', { text })) as SimulationResult,
    createSession: async (text, modelName, breakpointLines = [], monitoring = null) =>
      (await post('/sessions', {
        text,
        modelName,
        BreakpointLines: breakpointLines,
        ...(monitoring && monitoring.monitors.length > 0 ? { Monitors: monitoring.monitors, MonitorInterval: monitoring.interval } : {}),
      })) as SimulationResult,
    execute: async (sessionId, command) => (await post(`/sessions/${encodeURIComponent(sessionId)}/commands`, { command })) as SimulationResult,
    evaluate: async (sessionId, expressions) =>
      (await post(`/sessions/${encodeURIComponent(sessionId)}/evaluate`, { Expressions: expressions })) as Array<number | null>,
    getExample: async (exampleId) => (await request(`${SIMULATION_ROOT}/examples/${encodeURIComponent(exampleId)}`)) as ExampleModel,
  };
}
