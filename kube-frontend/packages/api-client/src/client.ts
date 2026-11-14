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
  /**
   * Override the request content type.
   *
   * `PATCH` is the reason this exists: kube-apiserver rejects a patch sent as
   * `application/json` with 415 and needs the patch strategy in the media type
   * (`application/merge-patch+json`, `application/strategic-merge-patch+json`).
   * Every other verb is fine with the default.
   */
  contentType?: string;
}

/**
 * Options for a streaming GET.
 *
 * A stream is a GET whose body is consumed as it arrives rather than parsed:
 * container-log `follow` holds the response open for as long as the reader
 * keeps it, so there is no whole body to parse.
 */
export interface StreamOptions {
  /** Query parameters; `undefined` values are dropped. */
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
}

/** The request surface every data-access module needs. */
export interface HttpApi {
  request<T>(path: string, init?: RequestOptions): Promise<T>;
}

/**
 * The streaming surface.
 *
 * Kept apart from `HttpApi` because test doubles for the JSON endpoints are
 * "an object with `request`" on purpose: adding a required `stream` to their
 * type would make every one of them construct a method no test exercises.
 * `openPodLogStream` asks for this shape, and the app's real client has both.
 */
export interface StreamApi {
  stream(path: string, init?: StreamOptions): Promise<Response>;
}

/** What `createClient` returns: JSON requests plus raw streams. */
export type ApiClient = HttpApi & StreamApi;

/**
 * The single HTTP entry point.
 *
 * Everything the app does over the network goes through here so that auth
 * headers, error normalisation and JSON parsing exist once. A page calling
 * `fetch` directly is what lets an error surface as `[object Object]`.
 */
export function createClient(options: ClientOptions = {}): ApiClient {
  const baseUrl = options.baseUrl ?? '';

  /** Resolve a request URL against the BFF. */
  function resolveUrl(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): URL {
    const url = new URL(`${baseUrl}${path}`, globalThis.location?.origin ?? 'http://localhost');
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    return url;
  }

  /** The bearer header, resolved per call so a re-login takes effect immediately. */
  function authHeaders(): Record<string, string> {
    const token = options.getToken?.();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
    // Resolved per call, not captured at construction: a stub installed after the
    // module loads (tests, or a polyfill in an older browser) must take effect,
    // and `globalThis.fetch` is the live reference anyway.
    const doFetch = options.fetchImpl ?? globalThis.fetch;

    const url = resolveUrl(path, init.query);

    const headers: Record<string, string> = { Accept: 'application/json', ...authHeaders() };
    if (init.body !== undefined) headers['Content-Type'] = init.contentType ?? 'application/json';

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

  /**
   * A GET whose body is handed back unparsed, for incremental consumption.
   *
   * Returned as the `Response` rather than an iterator so the caller decides
   * how to decode it — the container-log stream is line-delimited text, while a
   * future event stream would be SSE. Two rules are kept from `request`:
   * the bearer header comes from the same place, and a non-2xx answer is turned
   * into the same `ApiError` instead of being handed to a decoder that would
   * read an HTML error page as log lines.
   *
   * `EventSource` is deliberately not used for this: it cannot carry the
   * `Authorization` header, and the BFF has no cookie session to fall back on.
   */
  async function stream(path: string, init: StreamOptions = {}): Promise<Response> {
    const doFetch = options.fetchImpl ?? globalThis.fetch;
    const url = resolveUrl(path, init.query);

    let response: Response;
    try {
      response = await doFetch(url.toString(), {
        method: 'GET',
        // `*/*` rather than `application/json`: the kube log subresource
        // negotiates its own media type and answers 406 to `text/plain`, while
        // `*/*` is served as-is. The body is read as text either way.
        headers: { Accept: '*/*', ...authHeaders() },
        ...(init.signal ? { signal: init.signal } : {}),
      });
    } catch (cause) {
      throw new ApiError({ code: 'network_error', message: 'network request failed' }, 0);
    }

    if (!response.ok) {
      throw await toApiError(response);
    }
    return response;
  }

  return { request, stream };
}

async function toApiError(response: Response): Promise<ApiError> {
  const fallback: ApiErrorBody = {
    code: codeForStatus(response.status),
    message: response.statusText || 'request failed',
  };
  /*
   * Read the body as text first.
   *
   * Some upstream errors are plain text with the only actionable sentence in them: the
   * kubeconfig validator answers `400 invalid configuration: [context was not found…]`,
   * and kapis proxy errors arrive the same way. `response.json()` throws on those, and
   * falling back to `statusText` turned every one of them into "Bad Request" — a message
   * that says nothing about what to fix.
   */
  const raw = await response.text().catch(() => '');
  const trimmed = raw.trim();
  if (!trimmed || !(trimmed.startsWith('{') || trimmed.startsWith('['))) {
    const isHtml = trimmed.startsWith('<');
    return new ApiError(
      { ...fallback, message: trimmed && !isHtml ? trimmed.slice(0, 300) : fallback.message },
      response.status,
    );
  }
  try {
    const body = JSON.parse(trimmed) as Partial<ApiErrorBody> & {
      /** kube-apiserver's `Status` object uses `reason` and a numeric `code`. */
      reason?: string;
      code?: string | number;
    };
    /*
     * A string `code` is the BFF's own vocabulary (`upstream_unreachable`,
     * `invalid_credentials`) and is more specific than anything derivable from
     * the status — `kube Status` uses a numeric one, which is not a code at all.
     * It is kept in `details.serverCode` so a caller that needs the distinction
     * can read it; `code` stays the coarse status class the rest of the app
     * branches on.
     */
    const serverCode = typeof body.code === 'string' ? body.code : undefined;
    // A kube `Status` carries `reason`; that is the one upstream the app reads.
    const code = body.reason ? codeForReason(body.reason) : (serverCode ?? fallback.code);
    const details =
      serverCode === undefined || serverCode === code
        ? body.details
        : { ...(typeof body.details === 'object' && body.details !== null ? body.details : {}), serverCode };
    return new ApiError(
      {
        code,
        message: body.message ?? fallback.message,
        ...(details === undefined ? {} : { details }),
      },
      response.status,
    );
  } catch {
    // Malformed JSON: keep the status-derived code rather than guessing at a message.
    return new ApiError(fallback, response.status);
  }
}

/** Map an HTTP status to the error vocabulary the UI branches on. */
function codeForStatus(status: number): string {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 422) return 'invalid';
  if (status >= 500) return 'upstream_error';
  return 'http_error';
}

/** Map kube `Status.reason` to the same vocabulary. */
function codeForReason(reason: string): string {
  switch (reason) {
    case 'Unauthorized':
      return 'unauthorized';
    case 'Forbidden':
      return 'forbidden';
    case 'NotFound':
      return 'not_found';
    case 'AlreadyExists':
    case 'Conflict':
      return 'conflict';
    case 'Invalid':
      return 'invalid';
    case 'Timeout':
      return 'timeout';
    default:
      return 'http_error';
  }
}

/** Read-only view of the client: what a data-access module may call. */
export type Client = HttpApi;
