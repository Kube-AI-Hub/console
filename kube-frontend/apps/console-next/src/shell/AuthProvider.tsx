import * as React from 'react';
import { isTokenExpired, sessionApi, userFromToken, type SessionUser } from '@kube-ai-hub/api-client';
import { api, TOKEN_STORAGE_KEY } from '@/api';

/**
 * Who is signed in, for the whole app.
 *
 * The token lives in `localStorage` under the key the platform already used
 * (`kubesphere-token`) so a session started in the old console carries over and
 * the API client's lazy `getToken` keeps working unchanged. The user is derived
 * from the token rather than cached separately: two sources for "who am I" is how
 * a page ends up greeting one account while acting as another.
 */

export function readToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null): void {
  try {
    if (token === null) window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    else window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Private browsing or a full quota: the session then lasts one page load.
  }
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
  React.useEffect(() => {
    if (!readToken()) {
      setReady(true);
      return;
    }
    let cancelled = false;
    sessionApi(api)
      .me()
      .then((fresh) => {
        if (!cancelled) setUser(fresh);
      })
      .catch(() => {
        if (cancelled) return;
        writeToken(null);
        setUser(null);
      })
      .finally(() => {
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
