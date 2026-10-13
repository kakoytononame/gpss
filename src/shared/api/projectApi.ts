import type { ApplyFormResult, FormInput, GenerationResult, ProjectSummary, StudioProject, TebScheme } from '../types/project';
import { createHttpClient } from './httpClient';

const PROJECTS_ROOT = '/api/alina-gpss/studio/projects';

export interface ProjectApi {
  list: () => Promise<ProjectSummary[]>;
  create: (name: string, description?: string) => Promise<StudioProject>;
  /** Uploads a ZIP archive of a GPSS Studio project folder or a .gps / .txt model file. */
  importFile: (file: File) => Promise<StudioProject>;
  get: (id: string) => Promise<StudioProject>;
  save: (project: StudioProject) => Promise<StudioProject>;
  remove: (id: string) => Promise<void>;
  generate: (scheme: TebScheme, modelName: string) => Promise<GenerationResult>;
  /** Writes the input data of a form into its model text. */
  applyForm: (modelText: string, inputs: FormInput[]) => Promise<ApplyFormResult>;
}

/** Client of the project storage, GPSS Studio import and model generator. */
export function createProjectApi(apiBaseUrl: string, fetchImpl?: typeof fetch): ProjectApi {
  const request = createHttpClient(apiBaseUrl, fetchImpl);
  const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

  return {
    list: async () => (await request(PROJECTS_ROOT)) as ProjectSummary[],
    create: async (name, description) => (await request(PROJECTS_ROOT, json('POST', { Name: name, Description: description }))) as StudioProject,
    importFile: async (file) => {
      const form = new FormData();
      form.append('file', file, file.name);
      return (await request(`${PROJECTS_ROOT}/import`, { method: 'POST', body: form })) as StudioProject;
    },
    get: async (id) => (await request(`${PROJECTS_ROOT}/${encodeURIComponent(id)}`)) as StudioProject,
    save: async (project) => (await request(`${PROJECTS_ROOT}/${encodeURIComponent(project.Id)}`, json('PUT', project))) as StudioProject,
    remove: async (id) => {
      await request(`${PROJECTS_ROOT}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    generate: async (scheme, modelName) =>
      (await request(`${PROJECTS_ROOT}/generate`, json('POST', { ModelName: modelName, Scheme: scheme }))) as GenerationResult,
    applyForm: async (modelText, inputs) =>
      (await request(`${PROJECTS_ROOT}/forms/apply`, json('POST', { ModelText: modelText, Inputs: inputs }))) as ApplyFormResult,
  };
}
