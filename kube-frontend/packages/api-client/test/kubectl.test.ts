import { describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import { kubectlApi } from '../src/kubectl';

describe('kubectl target discovery', () => {
  it('uses resources v1alpha2 and encodes cluster/account segments', async () => {
    let url = '';
    const client = createClient({ fetchImpl: (async (input) => {
      url = String(input);
      return new Response('{"namespace":"kubesphere-system","pod":"kubectl-user-1","container":"kubectl"}',
        { headers: { 'content-type': 'application/json' } });
    }) as typeof fetch });
    expect(await kubectlApi(client).target({ cluster: 'member/a', username: 'user/b' })).toEqual({
      namespace: 'kubesphere-system', pod: 'kubectl-user-1', container: 'kubectl',
    });
    // `clusters/<id>` goes before the group (see `clusterScoped`).
    expect(url).toContain('/kapis/clusters/member%2Fa/resources.kubesphere.io/v1alpha2/users/user%2Fb/kubectl');
  });
  it('rejects incomplete discovery data instead of opening a default Pod', async () => {
    const client = createClient({ fetchImpl: (async () => new Response('{}',
      { headers: { 'content-type': 'application/json' } })) as typeof fetch });
    await expect(kubectlApi(client).target({ cluster: 'host', username: 'admin' })).rejects.toThrow('No ready kubectl Pod');
  });
  it('does not hide denied discovery or send a request without an account', async () => {
    let count = 0;
    const client = createClient({ fetchImpl: (async () => {
      count++;
      return new Response('{"message":"forbidden"}', { status: 403 });
    }) as typeof fetch });
    await expect(kubectlApi(client).target({ cluster: 'host', username: '' })).rejects.toThrow('signed-in');
    expect(count).toBe(0);
    await expect(kubectlApi(client).target({ cluster: 'host', username: 'admin' })).rejects.toThrow();
  });
});
