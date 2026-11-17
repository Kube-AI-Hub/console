import { describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import { DEFAULT_DOCUMENTS, publicConfigApi } from '../src/config';

/**
 * `/api/config` read.
 *
 * The header's help menu falls back to DEFAULT_DOCUMENTS when this fails; that fallback
 * pins the old console's relative paths, so a config endpoint regression does not remove
 * the help entry.
 */
function recordingClient(body: unknown) {
  const calls: string[] = [];
  const client = createClient({
    baseUrl: '/kube-frontend',
    fetchImpl: (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch,
  });
  return { client, calls };
}

describe('publicConfigApi', () => {
  it('reads /api/config relative to the app base', async () => {
    const docs = { zh: { url: '/zh/docs/', api: '/zh/api/' }, en: { url: '/docs/', api: '/api/' } };
    const { client, calls } = recordingClient({ documents: docs });
    const config = await publicConfigApi(client).get();
    expect(calls[0]?.endsWith('/kube-frontend/api/config')).toBe(true);
    expect(config.documents).toEqual(docs);
  });

  it('has the old console’s relative docs paths as fallback', () => {
    expect(DEFAULT_DOCUMENTS.zh.url).toBe('/kube-docs/zh/docs/');
    expect(DEFAULT_DOCUMENTS.en.api).toBe('/kube-docs/docs/reference/api-docs/');
  });
});
