import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/errors';
import { identityProvidersApi } from '../src/identity';

/**
 * Identity providers.
 *
 * Two things matter: the endpoint spelling may differ between deployments (try both), and
 * "route not served" is a deployment state the page states explicitly rather than showing
 * an empty configured list.
 */
function clientWith(responses: Array<unknown | Error>) {
  const calls: string[] = [];
  let index = 0;
  return {
    calls,
    client: {
      request: async (url: string) => {
        calls.push(url);
        const response = responses[index++];
        if (response instanceof Error) throw response;
        return response;
      },
    } as never,
  };
}

describe('identityProvidersApi.list', () => {
  it('maps providers from the first served endpoint', async () => {
    const { client, calls } = clientWith([
      { items: [{ metadata: { name: 'ldap' }, spec: { type: 'LDAP', displayName: '企业 LDAP' } }] },
    ]);
    expect(await identityProvidersApi(client).list()).toEqual({
      available: true,
      providers: [{ name: 'ldap', type: 'LDAP', displayName: '企业 LDAP' }],
    });
    expect(calls).toHaveLength(1);
  });

  it('falls back to the second spelling on 404 and reports unavailable if both are absent', async () => {
    const notFound = new ApiError({ code: 'not_found', message: 'not served' }, 404);
    const { client, calls } = clientWith([notFound, notFound]);
    expect(await identityProvidersApi(client).list()).toEqual({ available: false, reason: 'not served' });
    expect(calls).toHaveLength(2);
  });

  it('does not turn a permission error into "no providers"', async () => {
    const { client } = clientWith([new ApiError({ code: 'forbidden', message: 'forbidden' }, 403)]);
    await expect(identityProvidersApi(client).list()).rejects.toThrow('forbidden');
  });
});
