/**
 * Login, logout and the current user.
 *
 * These three calls go to the BFF rather than straight to ks-apiserver, because
 * `/oauth/token` needs an OAuth client secret. A failed login answers 400/401
 * with a `code` that says *why* — the page turns it into a sentence — so unlike
 * resource calls this module keeps the server's code instead of the status class.
 */

import type { Client } from './client';
import { ApiError } from './errors';

/**
 * `SessionUser` is declared in `./token`, not here: the type is only useful
 * together with the decoder that produces it, and the BFF imports both.
 */
import type { SessionUser } from './token';

export type { SessionUser };

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
  'invalid_client',
  'upstream_unreachable',
] as const;

export type LoginErrorCode = (typeof LOGIN_ERROR_CODES)[number];

export function isLoginErrorCode(code: string): code is LoginErrorCode {
  return (LOGIN_ERROR_CODES as readonly string[]).includes(code);
}

export function sessionApi(client: Client): SessionApi {
  return {
    async login(input) {
      try {
        return await client.request<Session>('/api/session/login', { method: 'POST', body: input });
      } catch (cause) {
        throw asLoginError(cause);
      }
    },

    async me() {
      const body = await client.request<{ user: SessionUser }>('/api/session/me');
      return body.user;
    },

    async logout() {
      await client.request<void>('/api/session/logout', { method: 'POST' });
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
 * code the BFF sent is restored here.
 */
function asLoginError(cause: unknown): ApiError {
  if (!(cause instanceof ApiError)) {
    return new ApiError({ code: 'upstream_unreachable', message: 'login failed' }, 0);
  }
  const details = cause.details as { serverCode?: unknown } | undefined;
  const serverCode = typeof details?.serverCode === 'string' ? details.serverCode : undefined;
  if (!serverCode || serverCode === cause.code) return cause;
  return new ApiError({ code: serverCode, message: cause.message, status: cause.status }, cause.status);
}
