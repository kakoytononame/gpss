import type { EditorMode, EditorQuery, TebApi, WorkspaceSnapshot } from '../types/teb';
import { ApiError, createHttpClient } from './httpClient';

export { ApiError as TebApiError } from './httpClient';

const API_ROOT = '/api/alina-gpss/studio/tebs';
const DEFAULT_CLASS_ID = '3ef71b95-07f7-41c6-b532-03d83d8a3973';

export const DEFAULT_EDITOR_QUERY: EditorQuery = {
  apiBaseUrl: '',
  libraryId: '0',
  classId: DEFAULT_CLASS_ID,
  // The demo instance belongs to the demo class.
  instanceClassId: DEFAULT_CLASS_ID,
  instanceId: '80ba15bc-7a4a-4b36-ba57-df2cab3b89ad',
  mode: 'class',
};

function classPath(libraryId: string, classId: string): string {
  return `${API_ROOT}/libraries/${encodeURIComponent(libraryId)}/classes/${encodeURIComponent(classId)}`;
}

function jsonBody(method: string, body: unknown): RequestInit {
  return { method, body: JSON.stringify(body) };
}

function unwrapSnapshot(payload: unknown): WorkspaceSnapshot | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  return ((record.Snapshot ?? record.snapshot) as WorkspaceSnapshot | undefined) ?? null;
}

export function readEditorQueryFromUrl(search: string = window.location.search): EditorQuery {
  const params = new URLSearchParams(search);
  const mode: EditorMode = params.get('mode') === 'instance' ? 'instance' : 'class';
  const classId = params.get('classId') || DEFAULT_EDITOR_QUERY.classId;

  return {
    apiBaseUrl: params.get('apiBaseUrl') || import.meta.env.VITE_GPSS_API_BASE_URL || DEFAULT_EDITOR_QUERY.apiBaseUrl,
    libraryId: params.get('libraryId') || DEFAULT_EDITOR_QUERY.libraryId,
    classId,
    instanceClassId: params.get('instanceClassId') || classId,
    instanceId: params.get('instanceId') || DEFAULT_EDITOR_QUERY.instanceId,
    mode,
  };
}

/**
 * Typed client for the TEB editor backend (see backend/GpssStudio.WebApi/Controllers).
 * Parameters are addressed by their zero-based position, which the backend accepts as an id.
 */
export function createTebApi(query: EditorQuery, fetchImpl?: typeof fetch): TebApi {
  const request = createHttpClient(query.apiBaseUrl, fetchImpl);
  const classUrl = classPath(query.libraryId, query.classId || DEFAULT_EDITOR_QUERY.classId);
  const instanceClassUrl = classPath(query.libraryId, query.instanceClassId || query.classId || DEFAULT_EDITOR_QUERY.classId);
  const instanceUrl = `${instanceClassUrl}/instances/${encodeURIComponent(query.instanceId)}`;
  const parameterUrl = (index: number) => `${classUrl}/parameters/${encodeURIComponent(index)}`;

  return {
    getClass: () => request(classUrl),
    getInstance: () => request(instanceUrl),
    getWorkspaceSnapshot: async () => {
      try {
        return unwrapSnapshot(await request(`${API_ROOT}/workspace`));
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return null;
        }

        throw error;
      }
    },
    saveWorkspaceSnapshot: (snapshot) => request(`${API_ROOT}/workspace`, jsonBody('PUT', { snapshot })),
    addParameter: (parameter) => request(`${classUrl}/parameters`, jsonBody('POST', parameter)),
    deleteParameter: (index) => request(parameterUrl(index), { method: 'DELETE' }),
    updateClassProperty: (path, value) => request(`${classUrl}/properties`, jsonBody('PATCH', { path, value })),
    updateGpssModel: (text) => request(`${classUrl}/gpss-model`, jsonBody('PUT', { text })),
    updateParameter: (index, parameter) => request(parameterUrl(index), jsonBody('PATCH', parameter)),
    moveParameter: (index, direction) => request(`${parameterUrl(index)}/move`, jsonBody('POST', { direction })),
    setParameterValue: (parameterIndex, value) => request(`${instanceUrl}/parameters/${encodeURIComponent(parameterIndex)}/value`, jsonBody('PUT', { value })),
  };
}
