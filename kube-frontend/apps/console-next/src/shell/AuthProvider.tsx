import * as React from 'react';
import { ApiError, isTokenExpired, sessionApi, userFromToken, type SessionUser } from '@kube-ai-hub/api-client';
import { api, TOKEN_STORAGE_KEY } from '@/api';

/**
 * Who is signed in, for the whole app.
 *
 * The token lives in `localStorage` under the key the platform already used
 * (`kah_token`) so a session started in the old console carries over and the API
 * client's lazy `getToken` keeps working unchanged. The user is derived from the
 * token rather than cached separately: two sources for "who am I" is how a page
 * ends up greeting one account while acting as another.
 *
 * The same value is also mirrored into a `kah_token` cookie. The old console
 * does that because the model portal's same-origin proxy reads the JWT from the
 * cookie (`server/proxy.js` → `injectConsoleJwt`); a reader who signs in here and
 * then opens `/platform-model` would otherwise reach it unauthenticated.
 */

/** The cookie the old console writes and the portal proxy reads. */
const TOKEN_COOKIE = 'kah_token';

/**
 * The key earlier builds of this app used.
 *
 * Both apps are now served from one origin and one login, so there is exactly one
 * key. A session stored under the old name is migrated once, on read, instead of
 * being silently dropped — that would sign out every reader who was already using
 * this console.
 */
const LEGACY_TOKEN_KEY = 'kubesphere-token';

function migrateLegacyToken(): void {
  try {
    const legacy = window.localStorage.getItem(LEGACY_TOKEN_KEY);
    if (!legacy) return;
    if (!window.localStorage.getItem(TOKEN_STORAGE_KEY)) window.localStorage.setItem(TOKEN_STORAGE_KEY, legacy);
    window.localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // Private browsing: nothing to migrate.
  }
}

export function readToken(): string | null {
  migrateLegacyToken();
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Mirror the token into the cookie the portal proxy reads. */
function writeTokenCookie(token: string | null): void {
  try {
    document.cookie = token
      ? `${TOKEN_COOKIE}=${encodeURIComponent(token)};path=/;SameSite=Lax`
      : `${TOKEN_COOKIE}=;path=/;max-age=0`;
  } catch {
    // `document` is absent in a non-browser environment (tests mount pages in jsdom,
    // where it exists but may throw on assignment in strict privacy modes).
  }
}

function writeToken(token: string | null): void {
  try {
    if (token === null) window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    else window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Private browsing or a full quota: the session then lasts one page load.
  }
  writeTokenCookie(token);
}

/** The stored token's user, or `null` when missing, unreadable or expired. */
function storedUser(): SessionUser | null {
  const token = readToken();
  if (!token || isTokenExpired(token)) return null;
  return userFromToken(token);
}

interface AuthValue {
  user: SessionUser | null;
  /** True once the stored token has been read and, if present, validated. */
  ready: boolean;
  signIn: (username: string, password: string) => Promise<SessionUser>;
  signOut: () => Promise<void>;
  /** Drops the token locally; used when the BFF reports the session is gone. */
  clear: () => void;
}

const AuthContext = React.createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [user, setUser] = React.useState<SessionUser | null>(storedUser);
  const [ready, setReady] = React.useState(false);

  /*
   * `me` is called once on mount, not on every render: it is the only way to
   * tell a revoked token from an expired one, since a JWT stays self-consistent
   * after the cluster has forgotten it. A 401 clears the stored token, so a
   * stale session shows the login page instead of a console whose every request
   * fails.
   */
  /*
   * `me` is called once on mount, not on every render: it is the only way to
   * tell a revoked token from an expired one, since a JWT stays self-consistent
   * after the cluster has forgotten it. A 401 clears the stored token, so a
   * stale session shows the login page instead of a console whose every request
   * fails.
   *
   * **Never** clear the token for a transport failure. This effect runs once per
   * app mount, and the page the reader landed on immediately refetches its own
   * data anyway; an already-authenticated session that hit one slow or dropped
   * `/me` (a cold BFF, a flaky network) was being signed out permanently — the
   * symptom was a page that bounced back to the login screen on a later
   * navigation, with the stored session silently gone.
   */
  React.useEffect(() => {
    const stored = readToken();
    if (!stored) {
      setReady(true);
      return;
    }
    // A token that cannot be decoded is unusable without a round trip.
    const derived = userFromToken(stored);
    if (!derived) {
      writeToken(null);
      setUser(null);
      setReady(true);
      return;
    }

    let cancelled = false;
    const validate = (attempt: number): Promise<void> =>
      sessionApi(api)
        .me()
        .then((fresh) => {
          if (!cancelled) setUser(fresh);
        })
        .catch(async (error: unknown) => {
          if (cancelled) return;
          const status = error instanceof ApiError ? error.status : 0;
          // A definite rejection means the cluster forgot the session.
          if (status === 401 || status === 403) {
            writeToken(null);
            setUser(null);
            return;
          }
          // Anything else (502 from the BFF, a timeout, a 5xx) is worth a retry;
          // after that, keep the self-consistent session and let each request
          // decide for itself.
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 400));
            return validate(attempt + 1);
          }
          if (!cancelled) setUser(derived);
        });
    void validate(1).finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * Another tab signing in or out changes `localStorage`, which fires `storage`
   * here but not in the tab that made the change. Without this, one tab keeps
   * acting as the old account after a re-login elsewhere — the failure the lazy
   * `getToken` was meant to avoid, one layer up.
   */
  React.useEffect(() => {
    const onStorage = (event: StorageEvent): void => {
      if (event.key !== TOKEN_STORAGE_KEY) return;
      setUser(storedUser());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const signIn = React.useCallback(async (username: string, password: string) => {
    const session = await sessionApi(api).login({ username, password });
    writeToken(session.token);
    setUser(session.user);
    return session.user;
  }, []);

  const signOut = React.useCallback(async () => {
    // Upstream first, while the token is still readable, so the cluster actually
    // revokes it. `logout` swallows upstream errors; the local drop is what the
    // reader sees either way.
    await sessionApi(api).logout().catch(() => undefined);
    writeToken(null);
    setUser(null);
  }, []);

  const clear = React.useCallback(() => {
    writeToken(null);
    setUser(null);
  }, []);

  const value = React.useMemo<AuthValue>(
    () => ({ user, ready, signIn, signOut, clear }),
    [user, ready, signIn, signOut, clear],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = React.useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
