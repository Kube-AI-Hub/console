import { describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import { resourceApi } from '../src/resources';
import { secretsApi, toKubeSecret, toSecretSummary, secretKeyProblem, isSystemManagedSecret } from '../src/secrets';
import { serviceAccountsApi, toKubeServiceAccount, toServiceAccountSummary, ROLE_ANNOTATION } from '../src/serviceaccounts';

/**
 * Transport contract for the two new collections.
 *
 * Reads go through kapis and writes through `/api/v1` — the kapis resources
 * endpoint registers GET only and answers 405 to every write, which is easy to
 * "tidy up" into a single builder. Everything here asserts that boundary, plus
 * the two KubeSphere-specific operations (default registry, project role).
 */

interface Call {
  url: string;
  method: string;
  contentType: string | undefined;
  body: string | undefined;
}

function recordingClient(response?: (call: Call) => { status: number; body: unknown }) {
  const calls: Call[] = [];
  const client = createClient({
    fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const call: Call = {
        url,
        method,
        contentType: headers['Content-Type'] ?? headers['content-type'],
        body: typeof init?.body === 'string' ? init.body : undefined,
      };
      calls.push(call);
      const answer = response?.(call) ?? {
        status: 200,
        body:
          method === 'GET' && !url.match(/\/[^/]+$/)
            ? { items: [], totalItems: 0 }
            : { metadata: { name: 'x', namespace: 'ns', resourceVersion: '7' }, data: {} },
      };
      return new Response(JSON.stringify(answer.body), {
        status: answer.status,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch,
  });
  return { client, calls };
}

describe('resourceApi', () => {
  const api = (client: ReturnType<typeof createClient>) =>
    resourceApi(client, {
      resource: 'secrets',
      toSummary: (item) => ({ name: String(item.metadata?.name ?? '') }),
      toDetail: (item) => ({ name: String(item.metadata?.name ?? '') }),
    });

  it('reads one page through kapis with paging, sort and keyword', async () => {
    const { client, calls } = recordingClient();
    const result = await api(client).list({ cluster: 'host', namespace: 'ns', page: 2, pageSize: 10, sortBy: 'createTime', order: 'desc', keyword: ' web ' });
    const url = new URL(calls[0]?.url ?? '');
    expect(url.pathname).toBe('/kapis/resources.kubesphere.io/v1alpha3/namespaces/ns/secrets');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(url.searchParams.get('sortBy')).toBe('createTime');
    expect(url.searchParams.get('ascending')).toBe('false');
    // Trimmed: `name=" web "` would match nothing upstream.
    expect(url.searchParams.get('name')).toBe('web');
    expect(result.total).toBe(0);
  });

  it('addresses a member cluster with the clusters segment', async () => {
    const { client, calls } = recordingClient();
    await api(client).list({ cluster: 'member-1', namespace: 'ns', page: 1, pageSize: 10 });
    expect(calls[0]?.url).toContain('/clusters/member-1/namespaces/ns/secrets');
  });

  it('lists across projects when the namespace is empty', async () => {
    const { client, calls } = recordingClient();
    await api(client).list({ cluster: 'host', namespace: '', page: 1, pageSize: 10 });
    expect(new URL(calls[0]?.url ?? '').pathname).toBe('/kapis/resources.kubesphere.io/v1alpha3/secrets');
  });

  it('writes through /api/v1', async () => {
    const { client, calls } = recordingClient();
    await api(client).create({ metadata: { name: 'x', namespace: 'ns' } }, { cluster: 'host', namespace: 'ns' });
    expect(calls[0]?.url).toContain('/api/v1/namespaces/ns/secrets');
    expect(calls[0]?.method).toBe('POST');
  });

  it('carries the current resourceVersion on a replace', async () => {
    const { client, calls } = recordingClient((call) =>
      call.method === 'GET'
        ? { status: 200, body: { metadata: { name: 'x', namespace: 'ns', resourceVersion: '42' }, data: {} } }
        : { status: 200, body: { metadata: { name: 'x', namespace: 'ns', resourceVersion: '43' }, data: {} } },
    );
    await api(client).update({ cluster: 'host', namespace: 'ns', body: { metadata: { name: 'x', namespace: 'ns' }, data: {} } });
    expect(calls.map((call) => call.method)).toEqual(['GET', 'PUT']);
    const body = JSON.parse(calls[1]?.body ?? '{}') as { metadata: { resourceVersion?: string } };
    expect(body.metadata.resourceVersion).toBe('42');
  });

  it('sends PATCH with a merge-patch media type', async () => {
    const { client, calls } = recordingClient();
    await api(client).patch({ cluster: 'host', namespace: 'ns', name: 'x', body: { metadata: { annotations: { a: 'b' } } } });
    // kube-apiserver answers 415 to a patch sent as `application/json`.
    expect(calls[0]?.contentType).toBe('application/merge-patch+json');
    expect(calls[0]?.method).toBe('PATCH');
  });

  it('answers checkName from the NotFound reason', async () => {
    const { client } = recordingClient(() => ({ status: 404, body: { kind: 'Status', reason: 'NotFound', code: 404 } }));
    await expect(api(client).checkName({ cluster: 'host', namespace: 'ns', name: 'free' })).resolves.toBe(false);
    const taken = recordingClient(() => ({ status: 200, body: { metadata: { name: 'x' } } }));
    await expect(api(taken.client).checkName({ cluster: 'host', namespace: 'ns', name: 'x' })).resolves.toBe(true);
  });

  it('deletes a batch one request per name', async () => {
    const { client, calls } = recordingClient();
    await api(client).remove({ cluster: 'host', namespace: 'ns', names: ['a', 'b'] });
    expect(calls.map((call) => `${call.method} ${new URL(call.url).pathname}`)).toEqual([
      'DELETE /api/v1/namespaces/ns/secrets/a',
      'DELETE /api/v1/namespaces/ns/secrets/b',
    ]);
  });
});

describe('secrets mapping', () => {
  it('defaults an empty type to Opaque and counts keys', () => {
    const summary = toSecretSummary({ metadata: { name: 's' }, data: { a: '1', b: '2' } });
    expect(summary.type).toBe('Opaque');
    expect(summary.fieldCount).toBe(2);
  });

  it('reads the default-registry annotation', () => {
    expect(toSecretSummary({ metadata: { name: 's', annotations: { 'secret.kubesphere.io/is-default-class': 'true' } } }).isDefault).toBe(true);
  });

  it('builds the create body the old console builds', () => {
    const body = toKubeSecret({ name: 's', namespace: 'ns', type: 'kubernetes.io/tls', alias: ' ali ', description: ' d ', data: { 'tls.crt': 'x' } });
    expect(body.metadata?.annotations).toEqual({ 'kubesphere.io/alias-name': 'ali', 'kubesphere.io/description': 'd' });
    expect(body.type).toBe('kubernetes.io/tls');
    expect(body.kind).toBe('Secret');
  });

  it('validates keys the way kube-apiserver does', () => {
    expect(secretKeyProblem('')).toBe('required');
    expect(secretKeyProblem('a/b')).toBe('pattern');
    expect(secretKeyProblem('app.yaml')).toBeNull();
    expect(secretKeyProblem('-._aZ09')).toBeNull();
  });

  it('recognises system-managed token secrets', () => {
    expect(isSystemManagedSecret({ type: 'kubernetes.io/service-account-token' })).toBe(true);
    expect(isSystemManagedSecret({ type: 'Opaque' })).toBe(false);
  });
});

describe('secretsApi.setDefault', () => {
  it('clears the previous default before setting the new one', async () => {
    const { client, calls } = recordingClient();
    await secretsApi(client).setDefault({ cluster: 'host', namespace: 'ns', name: 'new', previous: 'old' });
    expect(calls.map((call) => `${call.method} ${new URL(call.url).pathname}`)).toEqual([
      'PATCH /api/v1/namespaces/ns/secrets/old',
      'PATCH /api/v1/namespaces/ns/secrets/new',
    ]);
    expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({ metadata: { annotations: { 'secret.kubesphere.io/is-default-class': 'false' } } });
    expect(JSON.parse(calls[1]?.body ?? '{}')).toEqual({ metadata: { annotations: { 'secret.kubesphere.io/is-default-class': 'true' } } });
  });

  it('sets only the new one when there is no previous default', async () => {
    const { client, calls } = recordingClient();
    await secretsApi(client).setDefault({ cluster: 'host', namespace: 'ns', name: 'only' });
    expect(calls).toHaveLength(1);
  });
});

describe('serviceAccounts mapping', () => {
  it('reads the role annotation and the bound secrets', () => {
    const summary = toServiceAccountSummary({
      metadata: { name: 'sa', annotations: { [ROLE_ANNOTATION]: 'project-viewer' } },
      secrets: [{ name: 'sa-token' }],
    });
    expect(summary.role).toBe('project-viewer');
    expect(summary.secrets).toEqual(['sa-token']);
  });

  it('tolerates a null secrets list', () => {
    expect(toServiceAccountSummary({ metadata: { name: 'sa' }, secrets: null as never }).secrets).toEqual([]);
  });

  it('omits the role annotation when none is chosen', () => {
    expect(toKubeServiceAccount({ name: 'sa', namespace: 'ns' }).metadata?.annotations).toBeUndefined();
    expect(toKubeServiceAccount({ name: 'sa', namespace: 'ns', role: 'project-viewer' }).metadata?.annotations).toEqual({
      [ROLE_ANNOTATION]: 'project-viewer',
    });
  });
});

describe('serviceAccountsApi', () => {
  it('reads assignable project roles and drops role templates', async () => {
    const { client, calls } = recordingClient(() => ({
      status: 200,
      body: {
        items: [
          { metadata: { name: 'viewer' } },
          { metadata: { name: 'admin' } },
          // A template is a building block, never an assignable project role.
          { metadata: { name: 'role-template-view-basic', labels: { 'iam.kubesphere.io/role-template': 'true' } } },
        ],
        totalItems: 3,
      },
    }));
    const roles = await serviceAccountsApi(client).roles({ cluster: 'host', namespace: 'ns' });
    const url = new URL(calls[0]?.url ?? '');
    expect(url.pathname).toBe('/kapis/iam.kubesphere.io/v1alpha2/namespaces/ns/roles');
    expect(url.searchParams.get('limit')).toBe('-1');
    // Without this filter the endpoint returns every role template as well.
    expect(url.searchParams.get('annotation')).toBe('kubesphere.io/creator');
    expect(roles.map((role) => role.name)).toEqual(['admin', 'viewer']);
  });

  it('changes the role with a single-annotation merge patch', async () => {
    const { client, calls } = recordingClient();
    await serviceAccountsApi(client).setRole({ cluster: 'host', namespace: 'ns', name: 'sa', role: 'project-editor' });
    expect(calls[0]?.method).toBe('PATCH');
    expect(calls[0]?.contentType).toBe('application/merge-patch+json');
    expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({ metadata: { annotations: { [ROLE_ANNOTATION]: 'project-editor' } } });
  });
});
