/**
 * Error shape the BFF promises for every non-2xx response.
 *
 * One shape for the whole app: a page catches one type and reads `code` to
 * decide between "show an empty state", "show a permission notice" and "offer
 * retry". Without it every call site re-parses whatever upstream returned.
 */
export interface ApiErrorBody {
  code: string;
  message: string;
  /** Upstream status, kept for diagnosis; the app keys behaviour off `code`. */
  status?: number;
  details?: unknown;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(body: ApiErrorBody, status: number) {
    super(body.message);
    this.name = 'ApiError';
    this.code = body.code;
    this.status = status;
    this.details = body.details;
  }

  /** True when retrying could plausibly help (network, timeout, 5xx). */
  get retryable(): boolean {
    return this.status >= 500 || this.code === 'network_error' || this.code === 'timeout';
  }

  /** True when the user simply is not allowed; the UI should not offer retry. */
  get isPermission(): boolean {
    return this.status === 403 || this.code === 'forbidden';
  }

  get isNotFound(): boolean {
    return this.status === 404 || this.code === 'not_found';
  }
}
