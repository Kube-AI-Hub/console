import { createClient, configMapsApi, secretsApi, serviceAccountsApi, storageApi, workloadsApi } from '@kube-ai-hub/api-client';

/**
 * The app's single API client.
 *
 * Token comes from `localStorage` under the key the platform sets after login.
 * Reading it lazily (per request) rather than once at startup means a re-login
 * in another tab takes effect without a reload.
 */
const TOKEN_KEY = 'kubesphere-token';

/**
 * The current bearer token, or null when signed out.
 *
 * Exported for the WebSocket channels, which cannot go through the client's
 * header path: a browser `WebSocket` cannot set headers, so the exec session sends
 * the token as a subprotocol instead (see `openExecSession`).
 */
export function currentToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    // Private browsing can throw on access; treat it as "no token" and let the
    // BFF answer 401, which the page renders as a permission notice.
    return null;
  }
}

export const api = createClient({ getToken: currentToken });

export const TOKEN_STORAGE_KEY = TOKEN_KEY;

export { configMapsApi, secretsApi, serviceAccountsApi, storageApi, workloadsApi };
