/**
 * The error contract between the BFF and the app.
 *
 * ks-apiserver answers with `{ message }` for most failures, a `Status` object
 * for raw kube errors, and plain HTML for proxy failures. The app should not
 * know any of that, so everything is collapsed here into one shape with a
 * stable `code` the UI can branch on.
 */

export interface BffError {
  code: string;
  message: string;
  status: number;
  details?: unknown;
}

/** Map an upstream status to a code the client can branch on. */
export function codeForStatus(status: number): string {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 422) return 'invalid';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'upstream_error';
  return 'http_error';
}

/**
 * Turn an upstream response into a `BffError`.
 *
 * A kube `Status` carries the human message in `message`; the aggregation API
 * uses the same field. Both are read, then the status-derived code wins so the
 * client never has to interpret upstream-specific strings.
 */
export async function normaliseUpstreamError(response: Response): Promise<BffError> {
  const code = codeForStatus(response.status);
  let message = response.statusText || 'upstream request failed';
  let details: unknown;

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('json')) {
    try {
      const body = (await response.json()) as Record<string, unknown>;
      if (typeof body['message'] === 'string' && body['message']) message = body['message'];
      if (typeof body['reason'] === 'string' && body['reason']) {
        details = { reason: body['reason'] };
      }
    } catch {
      // Malformed JSON from upstream: keep the status text.
    }
  } else {
    // Drain the body so the socket is released; HTML pages are not useful to the UI.
    await response.text().catch(() => undefined);
  }

  return details === undefined
    ? { code, message, status: response.status }
    : { code, message, status: response.status, details };
}

/** An error the BFF itself raises, before reaching upstream. */
export function badRequest(message: string): BffError {
  return { code: 'invalid_request', message, status: 400 };
}

export function upstreamUnreachable(cause: unknown): BffError {
  return {
    code: 'upstream_unreachable',
    message: cause instanceof Error ? cause.message : 'upstream unreachable',
    status: 502,
  };
}
