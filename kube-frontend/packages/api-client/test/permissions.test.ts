import { describe, expect, it } from 'vitest';
import { accessReviewApi } from '../src/permissions';
import { createClient } from '../src/client';

/**
 * Access-review transport contract.
 *
 * ks-apiserver's IAM route answers with the request user's identity; the kube API
 * SelfSubjectAccessReview is only a fallback for older backends (where /apis is
 * evaluated as the proxy service account). Pinning both shapes keeps a backend
 * upgrade from silently changing who can attempt a write.
 */
function recordingClient(body: unknown, status = 200) {
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
  it('asks ks-apiserver with the user identity, not the kube proxy', async () => {
    const { client, calls } = recordingClient({ allowed: true });
    const allowed = await accessReviewApi(client).allowed({ verb: 'create', resource: 'services', namespace: 'default' });
    expect(allowed).toBe(true);
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url.endsWith('/kapis/iam.kubesphere.io/v1alpha2/selfsubjectaccessreviews')).toBe(true);
    expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({ verb: 'create', resource: 'services', namespace: 'default' });
  });

  it('sends the API group for a grouped resource such as Ingress', async () => {
    const { client, calls } = recordingClient({ allowed: false });
    const allowed = await accessReviewApi(client).allowed({
      verb: 'create',
      resource: 'ingresses',
      group: 'networking.k8s.io',
      namespace: 'demo',
    });
    expect(allowed).toBe(false);
    expect(JSON.parse(calls[0]?.body ?? '{}').group).toBe('networking.k8s.io');
  });

  it('treats a missing answer as not allowed', async () => {
    const { client } = recordingClient({});
    expect(await accessReviewApi(client).allowed({ verb: 'create', resource: 'services', namespace: 'default' })).toBe(false);
  });

  it('falls back to the kube review on an older backend (404)', async () => {
    const calls: string[] = [];
    let first = true;
    const client = createClient({
      fetchImpl: (async (input: RequestInfo | URL) => {
        calls.push(String(input));
        if (first) {
          first = false;
          return new Response(JSON.stringify({ message: 'not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
        }
        return new Response(JSON.stringify({ status: { allowed: true } }), { status: 201, headers: { 'content-type': 'application/json' } });
      }) as typeof fetch,
    });
    expect(await accessReviewApi(client).allowed({ verb: 'create', resource: 'services', namespace: 'default' })).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.endsWith('/apis/authorization.k8s.io/v1/selfsubjectaccessreviews')).toBe(true);
  });

  it('falls back when go-restful reports the unregistered route as 500 "no matches"', async () => {
    let first = true;
    const client = createClient({
      fetchImpl: (async () => {
        if (first) {
          first = false;
          return new Response('no matches for iam.kubesphere.io/v1alpha2, Resource=selfsubjectaccessreviews', {
            status: 500,
            headers: { 'content-type': 'text/plain' },
          });
        }
        return new Response(JSON.stringify({ status: { allowed: false } }), { status: 201, headers: { 'content-type': 'application/json' } });
      }) as typeof fetch,
    });
    expect(await accessReviewApi(client).allowed({ verb: 'create', resource: 'services' })).toBe(false);
  });
});
