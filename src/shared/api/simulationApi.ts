import type { ExampleModel, SimulationResult } from '../types/simulation';
import { createHttpClient } from './httpClient';

const SIMULATION_ROOT = '/api/alina-gpss/studio/simulation';

export interface SimulationApi {
  translate: (text: string) => Promise<SimulationResult>;
  createSession: (text: string, modelName: string, breakpointLines?: number[]) => Promise<SimulationResult>;
  execute: (sessionId: string, command: string) => Promise<SimulationResult>;
  getExample: (exampleId: string) => Promise<ExampleModel>;
}

/** Client of the server-side GPSS simulator. */
export function createSimulationApi(apiBaseUrl: string, fetchImpl?: typeof fetch): SimulationApi {
  const request = createHttpClient(apiBaseUrl, fetchImpl);
  const post = (path: string, body: unknown) => request(`${SIMULATION_ROOT}${path}`, { method: 'POST', body: JSON.stringify(body) });

  return {
    translate: async (text) => (await post('/translate', { text })) as SimulationResult,
    createSession: async (text, modelName, breakpointLines = []) =>
      (await post('/sessions', { text, modelName, BreakpointLines: breakpointLines })) as SimulationResult,
    execute: async (sessionId, command) => (await post(`/sessions/${encodeURIComponent(sessionId)}/commands`, { command })) as SimulationResult,
    getExample: async (exampleId) => (await request(`${SIMULATION_ROOT}/examples/${encodeURIComponent(exampleId)}`)) as ExampleModel,
  };
}
