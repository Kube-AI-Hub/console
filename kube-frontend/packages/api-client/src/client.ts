import { ApiError, type ApiErrorBody } from './errors';

/** Where the BFF lives. Same origin in production; a dev proxy in development. */
export interface ClientOptions {
  baseUrl?: string;
  /** Supplies the bearer token; the BFF forwards it to ks-apiserver. */
  getToken?: () => string | null | undefined;
  fetchImpl?: typeof fetch;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Query parameters; `undefined` values are dropped. */
  query?: Record<string, string | number | boolean | undefined>;
}

/**
 * The single HTTP entry point.
 *
 * Everything the app does over the network goes through here so that auth
 * headers, error normalisation and JSON parsing exist once. A page calling
 * `fetch` directly is what lets an error surface as `[object Object]`.
 */
export function createClient(options: ClientOptions = {}) {
  const baseUrl = options.baseUrl ?? '/api';

  async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
    // Resolved per call, not captured at construction: a stub installed after the
    // module loads (tests, or a polyfill in an older browser) must take effect,
    // and `globalThis.fetch` is the live reference anyway.
    const doFetch = options.fetchImpl ?? globalThis.fetch;

    const url = new URL(`${baseUrl}${path}`, globalThis.location?.origin ?? 'http://localhost');
    for (const [key, value] of Object.entries(init.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';
    const token = options.getToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;

    let response: Response;
    try {
      response = await doFetch(url.toString(), {
        method: init.method ?? 'GET',
        headers,
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
        ...(init.signal ? { signal: init.signal } : {}),
      });
    } catch (cause) {
      // A thrown fetch is a transport failure, not an HTTP status. Wrap it in the
      // same shape so callers only branch on one type.
      throw new ApiError({ code: 'network_error', message: 'network request failed' }, 0);
    }

    if (!response.ok) {
      throw await toApiError(response);
    }

    // 204 and other empty successful responses must not hit `response.json()`.
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  return { request };
}

async function toApiError(response: Response): Promise<ApiError> {
  const fallback: ApiErrorBody = {
    code: response.status === 403 ? 'forbidden' : response.status === 404 ? 'not_found' : 'http_error',
    message: response.statusText || 'request failed',
  };
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>;
    return new ApiError(
      {
        code: body.code ?? fallback.code,
        message: body.message ?? fallback.message,
        ...(body.details === undefined ? {} : { details: body.details }),
      },
      response.status,
    );
  } catch {
    // Upstream returned HTML (a proxy error page) — keep the status-derived code.
    return new ApiError(fallback, response.status);
  }
}

export type Client = ReturnType<typeof createClient>;
