const DEFAULT_API_BASE_URL = 'https://localhost:7016';
const API_ROOT = '/alina-gpss/studio/tebs';

export const DEFAULT_EDITOR_QUERY = {
  apiBaseUrl: DEFAULT_API_BASE_URL,
  libraryId: '0',
  classId: '3ef71b95-07f7-41c6-b532-03d83d8a3973',
  instanceClassId: '8102ff1b-7c25-4fca-8b8a-b7087520dd45',
  instanceId: '80ba15bc-7a4a-4b36-ba57-df2cab3b89ad',
  mode: 'class',
};

export class TebApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'TebApiError';
    this.status = status;
    this.payload = payload;
  }
}

function trimTrailingSlash(value) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function classPath(libraryId, classId) {
  return `${API_ROOT}/libraries/${encodeURIComponent(libraryId)}/classes/${encodeURIComponent(classId)}`;
}

async function parseResponse(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function readEditorQueryFromUrl(search = window.location.search) {
  const params = new URLSearchParams(search);
  const mode = params.get('mode') === 'instance' ? 'instance' : 'class';

  return {
    apiBaseUrl: params.get('apiBaseUrl') || import.meta.env.VITE_GPSS_API_BASE_URL || DEFAULT_EDITOR_QUERY.apiBaseUrl,
    libraryId: params.get('libraryId') || DEFAULT_EDITOR_QUERY.libraryId,
    classId: params.get('classId') || DEFAULT_EDITOR_QUERY.classId,
    instanceClassId: params.get('instanceClassId') || params.get('classId') || DEFAULT_EDITOR_QUERY.instanceClassId,
    instanceId: params.get('instanceId') || DEFAULT_EDITOR_QUERY.instanceId,
    mode,
  };
}

export function createTebApi({ apiBaseUrl, libraryId, classId, instanceClassId, instanceId }) {
  const baseUrl = trimTrailingSlash(apiBaseUrl || DEFAULT_API_BASE_URL);

  async function request(path, options = {}) {
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

  const effectiveClassId = classId || DEFAULT_EDITOR_QUERY.classId;
  const effectiveInstanceClassId = instanceClassId || effectiveClassId;

  return {
    getClass() {
      return request(classPath(libraryId, effectiveClassId));
    },
    getInstance() {
      return request(`${classPath(libraryId, effectiveInstanceClassId)}/instances/${encodeURIComponent(instanceId)}`);
    },
    addParameter(parameter) {
      return request(`${classPath(libraryId, effectiveClassId)}/parameters`, {
        method: 'POST',
        body: JSON.stringify(parameter),
      });
    },
    deleteParameter(index) {
      return request(`${classPath(libraryId, effectiveClassId)}/parameters/${encodeURIComponent(index)}`, {
        method: 'DELETE',
      });
    },
    updateClassProperty(path, value) {
      return request(`${classPath(libraryId, effectiveClassId)}/properties`, {
        method: 'PATCH',
        body: JSON.stringify({ path, value }),
      });
    },
    updateGpssModel(text) {
      return request(`${classPath(libraryId, effectiveClassId)}/gpss-model`, {
        method: 'PUT',
        body: JSON.stringify({ text }),
      });
    },
    updateParameter(index, parameter) {
      return request(`${classPath(libraryId, effectiveClassId)}/parameters/${encodeURIComponent(index)}`, {
        method: 'PATCH',
        body: JSON.stringify(parameter),
      });
    },
    moveParameter(index, direction) {
      return request(`${classPath(libraryId, effectiveClassId)}/parameters/${encodeURIComponent(index)}/move`, {
        method: 'POST',
        body: JSON.stringify({ direction }),
      });
    },
    setParameterValue(parameterIndex, value) {
      return request(`${classPath(libraryId, effectiveInstanceClassId)}/instances/${encodeURIComponent(instanceId)}/parameters/${encodeURIComponent(parameterIndex)}/value`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      });
    },
  };
}
