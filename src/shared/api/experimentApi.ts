import type { ExperimentRequest, ExperimentResult } from '../types/experiment';
import { createHttpClient } from './httpClient';

/** Client of the experiment runner (series of runs over a factor plan). */
export function createExperimentApi(apiBaseUrl: string, fetchImpl?: typeof fetch) {
  const request = createHttpClient(apiBaseUrl, fetchImpl);
  return {
    run: async (plan: ExperimentRequest) =>
      (await request('/api/alina-gpss/studio/experiments', { method: 'POST', body: JSON.stringify(plan) })) as ExperimentResult,
  };
}
