import type { GeneratedQueueingModel, QueueingAnalysis, QueueingModel, QueueingPreset, QueueingRunResult } from '../types/queueing';
import { createHttpClient } from './httpClient';

const BASE = '/api/alina-gpss/studio/queueing';

/** Client of the queueing systems constructor: catalogue, GPSS generation, theory and simulation. */
export function createQueueingApi(apiBaseUrl: string, fetchImpl?: typeof fetch) {
  const request = createHttpClient(apiBaseUrl, fetchImpl);
  const post = async (path: string, model: QueueingModel) => request(`${BASE}/${path}`, { method: 'POST', body: JSON.stringify(model) });
  return {
    presets: async () => (await request(`${BASE}/presets`)) as QueueingPreset[],
    validate: async (model: QueueingModel) => (await post('validate', model)) as string[],
    generate: async (model: QueueingModel) => (await post('generate', model)) as GeneratedQueueingModel,
    analyze: async (model: QueueingModel) => (await post('analyze', model)) as QueueingAnalysis,
    simulate: async (model: QueueingModel) => (await post('simulate', model)) as QueueingRunResult,
  };
}
