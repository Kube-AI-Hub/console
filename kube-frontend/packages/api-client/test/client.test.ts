import { describe, expect, it, vi } from 'vitest';
import { createClient } from '../src/client';
import { ApiError } from '../src/errors';

/**
 * Client behaviour.
 *
 * The error contract is the part worth testing: every call site branches on
 * `retryable` / `isPermission`, so a misclassified error shows the wrong button.
 */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('createClient', () => {
  it('sends the bearer token and parses JSON', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true }));
    const client = createClient({ baseUrl: '/api', getToken: () => 'tok', fetchImpl });
    await expect(client.request('/thing')).resolves.toEqual({ ok: true });
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('drops undefined query parameters instead of sending "undefined"', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    const client = createClient({ baseUrl: '/api', fetchImpl });
    await client.request('/thing', { query: { a: 1, b: undefined } });
    const url = String((fetchImpl.mock.calls[0] as unknown as [string])[0]);
    expect(url).toContain('a=1');
    expect(url).not.toContain('b=');
  });

  it('returns undefined for 204 rather than throwing on empty body', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const client = createClient({ baseUrl: '/api', fetchImpl });
    await expect(client.request('/thing', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('classifies a 403 as a permission error and not retryable', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ code: 'forbidden', message: 'nope' }, 403));
    const client = createClient({ baseUrl: '/api', fetchImpl });
    const error = await client.request('/thing').catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).isPermission).toBe(true);
    expect((error as ApiError).retryable).toBe(false);
  });

  it('classifies a 500 as retryable', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ code: 'upstream_error', message: 'boom' }, 500));
    const client = createClient({ baseUrl: '/api', fetchImpl });
    const error = (await client.request('/thing').catch((cause: unknown) => cause)) as ApiError;
    expect(error.retryable).toBe(true);
  });

  it('wraps a thrown fetch as a network error', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('failed to fetch');
    });
    const client = createClient({ baseUrl: '/api', fetchImpl });
    const error = (await client.request('/thing').catch((cause: unknown) => cause)) as ApiError;
    expect(error.code).toBe('network_error');
    expect(error.retryable).toBe(true);
  });

  it('keeps the status when upstream answers with HTML', async () => {
    const fetchImpl = vi.fn(async () => new Response('<html>', { status: 404, headers: { 'content-type': 'text/html' } }));
    const client = createClient({ baseUrl: '/api', fetchImpl });
    const error = (await client.request('/thing').catch((cause: unknown) => cause)) as ApiError;
    expect(error.isNotFound).toBe(true);
  });
});
