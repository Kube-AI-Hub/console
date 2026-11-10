import { createClient, configMapsApi } from '@kube-ai-hub/api-client';

/**
 * The app's single API client.
 *
 * Token comes from `localStorage` under the key the platform sets after login.
 * Reading it lazily (per request) rather than once at startup means a re-login
 * in another tab takes effect without a reload.
 */
const TOKEN_KEY = 'kubesphere-token';

export const api = createClient({
  getToken: () => {
    try {
      return window.localStorage.getItem(TOKEN_KEY);
    } catch {
      // Private browsing can throw on access; treat it as "no token" and let the
      // BFF answer 401, which the page renders as a permission notice.
      return null;
    }
  },
});

export const TOKEN_STORAGE_KEY = TOKEN_KEY;

export { configMapsApi };
