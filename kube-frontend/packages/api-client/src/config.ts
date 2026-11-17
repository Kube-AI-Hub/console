import type { Client } from './client';

/**
 * Deployment configuration the SPA cannot know at build time.
 *
 * The old console received it as `globals.config` from its Node server. That server
 * is now the only one, so it answers `GET /kube-frontend/api/config` (see
 * `server/controllers/newConsole.js`). Currently only the documentation links live
 * here.
 */
export interface DocsLinks {
  /** User guide root. */
  url: string;
  /** API reference root. */
  api: string;
}

export interface PublicConfig {
  documents: { zh: DocsLinks; en: DocsLinks };
}

/**
 * Fallback when `/api/config` is unreachable.
 *
 * Kept in sync with `server/src/docs.ts` DEFAULT_DOCS (the same old-console relative
 * paths, served from the console origin). The header must still offer *a* guide when the
 * config endpoint fails — hiding the whole help menu because of one failed read is worse
 * than using the deployment defaults.
 */
export const DEFAULT_DOCUMENTS: PublicConfig['documents'] = {
  zh: { url: '/kube-docs/zh/docs/', api: '/kube-docs/zh/docs/reference/api-docs/' },
  en: { url: '/kube-docs/docs/', api: '/kube-docs/docs/reference/api-docs/' },
};

export function publicConfigApi(client: Client) {
  return {
    async get(params: { signal?: AbortSignal } = {}): Promise<PublicConfig> {
      return client.request<PublicConfig>('/api/config', params.signal ? { signal: params.signal } : {});
    },
  };
}
