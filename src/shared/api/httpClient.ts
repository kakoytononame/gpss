export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export type HttpRequest = (path: string, options?: RequestInit) => Promise<unknown>;

async function parseBody(response: Response): Promise<unknown> {
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

function problemDetail(payload: unknown): string | undefined {
  if (payload && typeof payload === 'object' && 'detail' in payload && typeof payload.detail === 'string') {
    return payload.detail;
  }

  return undefined;
}

/**
 * Minimal JSON-over-fetch client. Non-2xx responses become {@link ApiError}
 * carrying the parsed body (RFC 7807 problem details from the backend).
 */
export function createHttpClient(baseUrl: string, fetchImpl: typeof fetch = (...args) => fetch(...args)): HttpRequest {
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

  return async (path, options = {}) => {
    const headers = new Headers(options.headers);

    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetchImpl(`${normalizedBaseUrl}${path}`, { ...options, headers });
    const payload = await parseBody(response);

    if (!response.ok) {
      throw new ApiError(problemDetail(payload) ?? `HTTP ${response.status}`, response.status, payload);
    }

    return payload;
  };
}
