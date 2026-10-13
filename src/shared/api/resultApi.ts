import type { SimulationResultDetail, SimulationResultKind, SimulationResultSummary } from '../types/result';
import { createHttpClient } from './httpClient';

const RESULTS_ROOT = '/api/alina-gpss/studio/results';

export interface CreateResultRequest {
  ProjectId: string | null;
  Kind: SimulationResultKind;
  Name: string;
  Payload: SimulationResultDetail['Payload'];
}

export interface ResultApi {
  /** Results of a project (results saved without a project when the id is null). */
  list: (projectId: string | null) => Promise<SimulationResultSummary[]>;
  get: (id: string) => Promise<SimulationResultDetail>;
  create: (request: CreateResultRequest) => Promise<SimulationResultDetail>;
  rename: (id: string, name: string) => Promise<SimulationResultSummary>;
  remove: (id: string) => Promise<void>;
}

/** Client of the simulation results database (single experiments and series). */
export function createResultApi(apiBaseUrl: string, fetchImpl?: typeof fetch): ResultApi {
  const request = createHttpClient(apiBaseUrl, fetchImpl);
  const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });
  const item = (id: string) => `${RESULTS_ROOT}/${encodeURIComponent(id)}`;

  return {
    list: async (projectId) => {
      const items = await request(projectId ? `${RESULTS_ROOT}?projectId=${encodeURIComponent(projectId)}` : RESULTS_ROOT);
      return Array.isArray(items) ? (items as SimulationResultSummary[]) : [];
    },
    get: async (id) => (await request(item(id))) as SimulationResultDetail,
    create: async (body) => (await request(RESULTS_ROOT, json('POST', body))) as SimulationResultDetail,
    rename: async (id, name) => (await request(item(id), json('PATCH', { Name: name }))) as SimulationResultSummary,
    remove: async (id) => {
      await request(item(id), { method: 'DELETE' });
    },
  };
}
