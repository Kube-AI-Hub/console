import { createClient, configMapsApi, secretsApi, serviceAccountsApi, storageApi, workloadsApi } from '@kube-ai-hub/api-client';

/**
 * The prefix this app is served under.
 *
 * It shares an origin with the old console, so both the assets and every request
 * this app makes have to stay inside `/kube-frontend`: the old console owns `/`,
 * `/login` and its own `/kapis` proxy, and a bare `/api/session/login` would be
 * answered by it instead. The reverse proxy in front of this app strips the
 * prefix before the BFF sees the request, so the paths below are unchanged from
 * the BFF's point of view.
 */
export const APP_BASE = '/kube-frontend';

/**
 * The app's single API client.
 *
 * Token comes from `localStorage` under the key the platform sets after login.
 * Reading it lazily (per request) rather than once at startup means a re-login
 * in another tab takes effect without a reload.
 *
 * The key is the old console's (`kah_token`), not a second one of our own: both
 * apps are served from one origin and one login, so a reader arriving from the
 * old console is already signed in here, and signing out on either side ends the
 * session on both.
 */
const TOKEN_KEY = 'kah_token';

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

export const api = createClient({ baseUrl: APP_BASE, getToken: currentToken });

export const TOKEN_STORAGE_KEY = TOKEN_KEY;

export { configMapsApi, secretsApi, serviceAccountsApi, storageApi, workloadsApi };
