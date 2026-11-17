import type { Client } from './client';
import { ApiError } from './errors';

/**
 * 第三方登录（身份源）.
 *
 * The platform may expose identity providers through the IAM aggregate. There is no
 * guarantee: some deployments serve the route, some do not (B200 answers 404 on every
 * candidate, measured 2026-11-17). "Not served" is a deployment fact the page must state,
 * not an empty provider list.
 *
 * The old console's ThirdPartyLogin cards were **display-only**: their Configure modals had
 * an `onOk` that closed the dialog without a request. This read-only status page therefore
 * loses no write capability; when an API exists, only the provider list is shown.
 */
export interface IdentityProvider {
  name: string;
  /** `spec.type` (e.g. LDAP, OIDC, GitHub) when present. */
  type: string;
  /** `spec.displayName`, falling back to the object name. */
  displayName: string;
}

export type IdentityProvidersResult =
  | { available: true; providers: IdentityProvider[] }
  | { available: false; reason: string };

interface KubeIdentityProvider {
  metadata?: { name?: string };
  spec?: Record<string, unknown>;
}

/** Candidate endpoints, most specific first; the first non-404 answer wins. */
const CANDIDATES = [
  '/kapis/iam.kubesphere.io/v1alpha2/identityproviders',
  '/apis/iam.kubesphere.io/v1alpha2/identityproviders',
];

export function identityProvidersApi(client: Client) {
  return {
    async list(params: { signal?: AbortSignal } = {}): Promise<IdentityProvidersResult> {
      let lastReason = '';
      for (const path of CANDIDATES) {
        try {
          const body = await client.request<{ items?: KubeIdentityProvider[] }>(path, {
            query: { limit: -1 },
            ...(params.signal ? { signal: params.signal } : {}),
          });
          return {
            available: true,
            providers: (body?.items ?? []).map((item) => ({
              name: item.metadata?.name ?? '',
              type: String(item.spec?.['type'] ?? ''),
              displayName: String(item.spec?.['displayName'] ?? item.metadata?.name ?? ''),
            })),
          };
        } catch (error) {
          // 404 means "this deployment does not serve the route"; try the next spelling.
          // 403 must stay a failure: a permission problem is not "no identity providers".
          if (error instanceof ApiError && error.status === 404) {
            lastReason = error.message;
            continue;
          }
          if (error instanceof ApiError && (error.status === 400 || error.status === 501 || error.status >= 500)) {
            return { available: false, reason: error.message };
          }
          throw error;
        }
      }
      return { available: false, reason: lastReason || 'identityproviders API is not served' };
    },
  };
}
