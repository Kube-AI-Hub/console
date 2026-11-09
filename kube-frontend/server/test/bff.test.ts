import { describe, expect, it, vi } from 'vitest';
import { codeForStatus, normaliseUpstreamError, upstreamUnreachable } from '../src/errors';
import { parseListQuery, toSummary } from '../src/configmaps';
import { loadConfig, resourcePath } from '../src/config';

/**
 * BFF behaviour, tested without a network.
 *
 * The BFF is where upstream quirks are supposed to disappear. If these mappings
 * are wrong the page shows the wrong state — a 403 rendered as "retry" is the
 * failure that wastes a user's time most reliably.
 */

describe('status to code', () => {
  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [409, 'conflict'],
    [422, 'invalid'],
    [429, 'rate_limited'],
    [500, 'upstream_error'],
    [418, 'http_error'],
  ])('maps %i to %s', (status, code) => {
    expect(codeForStatus(status)).toBe(code);
  });
});

describe('normaliseUpstreamError', () => {
  it('keeps the kube message and the status-derived code', async () => {
    const response = new Response(JSON.stringify({ message: 'configmaps is forbidden' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
    const error = await normaliseUpstreamError(response);
    expect(error).toEqual({ code: 'forbidden', message: 'configmaps is forbidden', status: 403 });
  });

  it('survives an HTML proxy error page', async () => {
    const response = new Response('<html>502 Bad Gateway</html>', {
      status: 502,
      statusText: 'Bad Gateway',
      headers: { 'content-type': 'text/html' },
    });
    const error = await normaliseUpstreamError(response);
    expect(error.code).toBe('upstream_error');
    expect(error.message).toBe('Bad Gateway');
  });

  it('survives malformed JSON', async () => {
    const response = new Response('{not json', {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'content-type': 'application/json' },
    });
    const error = await normaliseUpstreamError(response);
    expect(error.code).toBe('upstream_error');
  });

  it('wraps a transport failure as 502', () => {
    const error = upstreamUnreachable(new Error('ECONNREFUSED'));
    expect(error.status).toBe(502);
    expect(error.code).toBe('upstream_unreachable');
  });
});

describe('parseListQuery', () => {
  const valid = (overrides: Record<string, string> = {}) => {
    const params = new URLSearchParams({ cluster: 'host', namespace: 'default', ...overrides });
    return parseListQuery(params);
  };

  it('applies documented defaults', () => {
    const result = valid();
    expect(result).toMatchObject({ page: 1, pageSize: 10, sortBy: 'createdAt', order: 'desc', keyword: '' });
  });

  it('rejects a missing namespace', () => {
    const result = parseListQuery(new URLSearchParams({ cluster: 'host' }));
    expect('code' in result && result.code).toBe('invalid_request');
  });

  it('rejects an out-of-range page size', () => {
    const result = valid({ pageSize: '500' });
    expect('code' in result && result.status).toBe(400);
  });

  it('rejects a sort field the columns do not have', () => {
    // Without this the upstream silently ignores the parameter and the header
    // arrow points the wrong way.
    const result = valid({ sortBy: 'cpu' });
    expect('status' in result && result.status).toBe(400);
  });

  it('trims the keyword so a trailing space does not narrow the search', () => {
    const result = valid({ keyword: '  app  ' });
    expect('keyword' in result && result.keyword).toBe('app');
  });
});

describe('toSummary', () => {
  it('reads the description annotation and sorts keys', () => {
    const summary = toSummary({
      metadata: {
        name: 'app-config',
        namespace: 'default',
        creationTimestamp: '2026-11-01T08:12:00Z',
        annotations: { 'kubesphere.io/description': '主配置' },
      },
      data: { 'log.yaml': '', 'app.yaml': '' },
    });
    expect(summary).toMatchObject({
      name: 'app-config',
      description: '主配置',
      keys: ['app.yaml', 'log.yaml'],
    });
  });

  it('treats a missing data block as no keys rather than throwing', () => {
    const summary = toSummary({ metadata: { name: 'empty' } });
    expect(summary.keys).toEqual([]);
    expect(summary.description).toBe('');
  });
});

describe('resource path', () => {
  const config = loadConfig({ KS_API_URL: 'http://up', KS_API_PREFIX: '/kapis/x' });

  it('omits the cluster segment for the host cluster', () => {
    expect(resourcePath(config, 'host', 'default', 'configmaps')).toBe('/kapis/x/namespaces/default/configmaps');
  });

  it('inserts the member cluster segment otherwise', () => {
    expect(resourcePath(config, 'gpu01', 'ai', 'configmaps')).toBe('/kapis/x/clusters/gpu01/namespaces/ai/configmaps');
  });

  it('encodes the namespace', () => {
    expect(resourcePath(config, 'host', 'a/b', 'configmaps')).toContain('namespaces/a%2Fb');
  });
});

describe('service list', () => {
  it('forwards the bearer token and never caches', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ items: [], totalItems: 0 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { createConfigMapService } = await import('../src/configmaps');
    const service = createConfigMapService({
      config: { baseUrl: 'http://up', apiPrefix: '/kapis/x' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await service.list(
      { cluster: 'host', namespace: 'default', page: 1, pageSize: 10, sortBy: 'name', order: 'asc', keyword: '' },
      'token-123',
    );
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(call[0])).toContain('/kapis/x/namespaces/default/configmaps');
    expect((call[1].headers as Record<string, string>).Authorization).toBe('Bearer token-123');
  });
});

describe('kube mode (development harness)', () => {
  /**
   * `kube` mode exists so the app can be driven against real cluster data through
   * `kubectl proxy` when no KubeSphere JWT is available. It has no server-side
   * sorting, so the service must sort and page locally — otherwise the harness
   * would show data in a different order than production and prove nothing.
   */
  const items = [
    { metadata: { name: 'b-older', creationTimestamp: '2026-11-01T00:00:00Z' }, data: { k: 'v' } },
    { metadata: { name: 'a-newest', creationTimestamp: '2026-11-09T00:00:00Z' }, data: { k: 'v' } },
    { metadata: { name: 'c-middle', creationTimestamp: '2026-11-05T00:00:00Z' }, data: { k: 'v' } },
  ];

  async function listWith(overrides: Record<string, unknown> = {}) {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ items }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const { createConfigMapService } = await import('../src/configmaps');
    const service = createConfigMapService({
      config: { baseUrl: 'http://proxy', apiPrefix: '/kapis', mode: 'kube' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const result = await service.list(
      { cluster: 'host', namespace: 'demo', page: 1, pageSize: 10, sortBy: 'createdAt', order: 'desc', keyword: '', ...overrides },
      undefined,
    );
    return { result, fetchImpl };
  }

  it('addresses kube API paths rather than kapis', async () => {
    const { fetchImpl } = await listWith();
    expect(String((fetchImpl.mock.calls[0] as unknown as [string])[0])).toContain('/api/v1/namespaces/demo/configmaps');
  });

  it('drops kapis-only parameters the plain API rejects', async () => {
    const { fetchImpl } = await listWith();
    const url = new URL(String((fetchImpl.mock.calls[0] as unknown as [string])[0]));
    for (const param of ['sortBy', 'ascending', 'page', 'limit']) {
      expect(url.searchParams.has(param)).toBe(false);
    }
  });

  it('sorts newest first locally so the harness matches production order', async () => {
    const { result } = await listWith();
    expect(result.items.map((item) => item.name)).toEqual(['a-newest', 'c-middle', 'b-older']);
  });

  it('sorts by name ascending when asked', async () => {
    const { result } = await listWith({ sortBy: 'name', order: 'asc' });
    expect(result.items.map((item) => item.name)).toEqual(['a-newest', 'b-older', 'c-middle']);
  });

  it('pages and reports the unpaged total', async () => {
    const { result } = await listWith({ page: 2, pageSize: 2 });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(3);
  });

  it('filters by name locally', async () => {
    const { result } = await listWith({ keyword: 'middle' });
    expect(result.items.map((item) => item.name)).toEqual(['c-middle']);
  });
});
