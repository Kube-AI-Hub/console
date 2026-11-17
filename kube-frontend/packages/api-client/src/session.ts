/**
 * Login, logout and the current user.
 *
 * These go to ks-apiserver directly. The console used to run its own Node process
 * ("BFF") that performed the password grant on the browser's behalf, because
 * `/oauth/token` requires an OAuth client secret. That secret never has to leave
 * the cluster: the API server performs the grant itself at a first-party endpoint,
 * so a browser page can sign in without ever holding a client credential.
 *
 * The three calls and why each is where it is:
 *
 * - `login` → `POST /kapis/oauth.kubesphere.io/v1alpha1/login`. A kapis path, not
 *   `/oauth/token`: the latter must keep authenticating its *client* per RFC 6749,
 *   and a route that skips that would make the `/oauth` namespace ambiguous.
 * - `me` → `GET /oauth/userinfo`. The standard OIDC endpoint, which now also
 *   reports the two fields this app needs (see `sessionUserFromClaims`).
 * - `logout` → `GET /oauth/logout`. Revokes only the token the request carries, so
 *   signing out of one browser does not end every session of the account.
 *
 * A failed login answers with a `code` that says *why* — the page turns it into a
 * sentence — so unlike resource calls this module keeps the server's code instead
 * of the status class.
 */

import type { Client } from './client';
import { ApiError } from './errors';

/** The signed-in user, as this app renders it. */
export interface SessionUser {
  name: string;
  /** False for a pre-registered account that has not chosen a password yet. */
  initialized: boolean;
  displayName?: string;
  email?: string;
  /** Token expiry, epoch seconds. Absent when the cluster issues non-expiring tokens. */
  expiresAt?: number;
}

export interface Session {
  token: string;
  user: SessionUser;
}

export interface SessionApi {
  login: (input: { username: string; password: string }) => Promise<Session>;
  me: () => Promise<SessionUser>;
  logout: () => Promise<void>;
}

/** Codes the login form knows how to phrase. Anything else falls back to `message`. */
export const LOGIN_ERROR_CODES = [
  'invalid_credentials',
  'too_many_attempts',
  'account_not_active',
  'upstream_unreachable',
] as const;

export type LoginErrorCode = (typeof LOGIN_ERROR_CODES)[number];

export function isLoginErrorCode(code: string): code is LoginErrorCode {
  return (LOGIN_ERROR_CODES as readonly string[]).includes(code);
}

/** Path of the first-party sign-in endpoint. */
export const LOGIN_PATH = '/kapis/oauth.kubesphere.io/v1alpha1/login';

/**
 * The OIDC userinfo document, as far as this app reads it.
 *
 * `extra` is where the server puts non-standard claims; `uninitialized` is the one
 * this app cares about. `exp` is the registered expiry claim.
 */
interface UserinfoDocument {
  sub?: string;
  name?: string;
  email?: string;
  exp?: number;
  extra?: Record<string, string[]>;
}

/**
 * Project a userinfo document onto the app's user shape.
 *
 * Exported for the tests: the mapping is where the "pre-registered account" rule
 * lives, and it is the one thing that would silently send a reader to the wrong
 * screen if it were wrong.
 */
export function sessionUserFromClaims(document: UserinfoDocument): SessionUser {
  const extras = document.extra ?? {};
  const uninitialized = extras['uninitialized'] ?? [];
  const displayName = extras['username'] ?? [];
  const name = document.sub ?? document.name ?? '';
  return {
    name,
    // The annotation's presence marks a pre-registered account; its value is not
    // meaningful, so any entry at all means "not initialized".
    initialized: uninitialized.length === 0,
    ...(displayName[0] ? { displayName: displayName[0] } : {}),
    ...(document.email ? { email: document.email } : {}),
    ...(typeof document.exp === 'number' ? { expiresAt: document.exp } : {}),
  };
}

export function sessionApi(client: Client): SessionApi {
  return {
    async login(input) {
      try {
        return await client.request<Session>(LOGIN_PATH, { method: 'POST', body: input });
      } catch (cause) {
        throw asLoginError(cause);
      }
    },

    async me() {
      const document = await client.request<UserinfoDocument>('/oauth/userinfo');
      return sessionUserFromClaims(document ?? {});
    },

    async logout() {
      await client.request<void>('/oauth/logout');
    },
  };
}

/**
 * Keep the server's `code` for a login failure.
 *
 * `ApiError` from a resource call is deliberately coarse — a 401 is just
 * "unauthorized", because the page only has to stop and ask for a token. The
 * login form is the one place that must distinguish "wrong password" from "the
 * cluster is down", and those arrive at the same status class, so the narrower
 * code the server sent is restored here.
 */
function asLoginError(cause: unknown): ApiError {
  if (!(cause instanceof ApiError)) {
    return new ApiError({ code: 'upstream_unreachable', message: 'login failed' }, 0);
  }
  // The API server's login endpoint answers `{ code, message, status }` as the body,
  // which the client already surfaces as `code`; older shapes nested it in details.
  const details = cause.details as { serverCode?: unknown } | undefined;
  const serverCode = typeof details?.serverCode === 'string' ? details.serverCode : undefined;
  if (!serverCode || serverCode === cause.code) return cause;
  return new ApiError({ code: serverCode, message: cause.message, status: cause.status }, cause.status);
}
