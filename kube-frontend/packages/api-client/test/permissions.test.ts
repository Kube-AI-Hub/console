import { describe, expect, it } from 'vitest';
import { accessReviewApi } from '../src/permissions';
import { createClient } from '../src/client';

/**
 * `SelfSubjectAccessReview` transport contract.
 *
 * The answer decides whether a create button is enabled, so both the request shape
 * and the reading of a missing `status` are pinned here: a wrong method (GET against
 * a create-only resource) or treating "no status" as allowed would silently change who
 * can attempt a write.
 */
function recordingClient(body: unknown, status = 201) {
  const calls: Array<{ url: string; method: string; body: string | undefined }> = [];
  const client = createClient({
    fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        method: (init?.method ?? 'GET').toUpperCase(),
        body: typeof init?.body === 'string' ? init.body : undefined,
      });
      return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch,
  });
  return { client, calls };
}

describe('accessReviewApi', () => {
  it('asks for a namespaced core-group create with the review POST endpoint', async () => {
    const { client, calls } = recordingClient({ status: { allowed: true } });
    const allowed = await accessReviewApi(client).allowed({ verb: 'create', resource: 'services', namespace: 'default' });
    expect(allowed).toBe(true);
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url.endsWith('/apis/authorization.k8s.io/v1/selfsubjectaccessreviews')).toBe(true);
    const body = JSON.parse(calls[0]?.body ?? '{}');
    expect(body.kind).toBe('SelfSubjectAccessReview');
    expect(body.spec.resourceAttributes).toEqual({ verb: 'create', resource: 'services', namespace: 'default' });
  });

  it('sends the API group for a grouped resource such as Ingress', async () => {
    const { client, calls } = recordingClient({ status: { allowed: false } });
    const allowed = await accessReviewApi(client).allowed({
      verb: 'create',
      resource: 'ingresses',
      group: 'networking.k8s.io',
      namespace: 'demo',
    });
    expect(allowed).toBe(false);
    const body = JSON.parse(calls[0]?.body ?? '{}');
    expect(body.spec.resourceAttributes.group).toBe('networking.k8s.io');
  });

  it('treats a review without a status as not allowed', async () => {
    const { client } = recordingClient({});
    expect(await accessReviewApi(client).allowed({ verb: 'create', resource: 'services', namespace: 'default' })).toBe(false);
  });
});
