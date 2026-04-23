import type { EditorMode, EditorQuery, TebApi, TebParameter } from '../types/teb';

const DEFAULT_API_BASE_URL = '';
const API_ROOT = '/api/alina-gpss/studio/tebs';

export const DEFAULT_EDITOR_QUERY: EditorQuery = {
  apiBaseUrl: DEFAULT_API_BASE_URL,
  libraryId: '0',
  classId: '3ef71b95-07f7-41c6-b532-03d83d8a3973',
  instanceClassId: '8102ff1b-7c25-4fca-8b8a-b7087520dd45',
  instanceId: '80ba15bc-7a4a-4b36-ba57-df2cab3b89ad',
  mode: 'class',
};

export class TebApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'TebApiError';
    this.status = status;
    this.payload = payload;
  }
}

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function classPath(libraryId: string, classId: string): string {
  return `${API_ROOT}/libraries/${encodeURIComponent(libraryId)}/classes/${encodeURIComponent(classId)}`;
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function readEditorQueryFromUrl(search: string = window.location.search): EditorQuery {
  const params = new URLSearchParams(search);
  const mode: EditorMode = params.get('mode') === 'instance' ? 'instance' : 'class';

  return {
    apiBaseUrl: params.get('apiBaseUrl') || import.meta.env.VITE_GPSS_API_BASE_URL || DEFAULT_EDITOR_QUERY.apiBaseUrl,
    libraryId: params.get('libraryId') || DEFAULT_EDITOR_QUERY.libraryId,
    classId: params.get('classId') || DEFAULT_EDITOR_QUERY.classId,
    instanceClassId: params.get('instanceClassId') || params.get('classId') || DEFAULT_EDITOR_QUERY.instanceClassId,
    instanceId: params.get('instanceId') || DEFAULT_EDITOR_QUERY.instanceId,
    mode,
  };
}

/**
 * Creates a typed frontend API client for the TEB editor.
 */
export function createTebApi(query: EditorQuery): TebApi {
  const baseUrl = trimTrailingSlash(query.apiBaseUrl || DEFAULT_API_BASE_URL);
  const effectiveClassId = query.classId || DEFAULT_EDITOR_QUERY.classId;
  const effectiveInstanceClassId = query.instanceClassId || effectiveClassId;

  async function request(path: string, options: RequestInit = {}): Promise<unknown> {
    const headers = new Headers(options.headers);

    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });

    const payload = await parseResponse(response);

    if (!response.ok) {
      throw new TebApiError(`HTTP ${response.status}`, response.status, payload);
    }

    return payload;
  }

  return {
    getClass: () => request(classPath(query.libraryId, effectiveClassId)),
    getInstance: () => request(`${classPath(query.libraryId, effectiveInstanceClassId)}/instances/${encodeURIComponent(query.instanceId)}`),
    addParameter: (parameter: TebParameter) =>
      request(`${classPath(query.libraryId, effectiveClassId)}/parameters`, {
        method: 'POST',
        body: JSON.stringify(parameter),
      }),
    deleteParameter: (index: number) =>
      request(`${classPath(query.libraryId, effectiveClassId)}/parameters/${encodeURIComponent(index)}`, {
        method: 'DELETE',
      }),
    updateClassProperty: (path: string, value: unknown) =>
      request(`${classPath(query.libraryId, effectiveClassId)}/properties`, {
        method: 'PATCH',
        body: JSON.stringify({ path, value }),
      }),
    updateGpssModel: (text: string) =>
      request(`${classPath(query.libraryId, effectiveClassId)}/gpss-model`, {
        method: 'PUT',
        body: JSON.stringify({ text }),
      }),
    updateParameter: (index: number, parameter: TebParameter) =>
      request(`${classPath(query.libraryId, effectiveClassId)}/parameters/${encodeURIComponent(index)}`, {
        method: 'PATCH',
        body: JSON.stringify(parameter),
      }),
    moveParameter: (index: number, direction) =>
      request(`${classPath(query.libraryId, effectiveClassId)}/parameters/${encodeURIComponent(index)}/move`, {
        method: 'POST',
        body: JSON.stringify({ direction }),
      }),
    setParameterValue: (parameterIndex: number, value: string | number) =>
      request(
        `${classPath(query.libraryId, effectiveInstanceClassId)}/instances/${encodeURIComponent(query.instanceId)}/parameters/${encodeURIComponent(parameterIndex)}/value`,
        {
          method: 'PUT',
          body: JSON.stringify({ value }),
        },
      ),
  };
}
