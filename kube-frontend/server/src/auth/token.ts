/**
 * Turning a KubeSphere token into a user.
 *
 * The old console carried the same four steps inline in `services/session.js` and
 * again in the login page (`parseToken`), and the two disagreed about what an
 * uninitialised account looks like. One copy lives here.
 *
 * This deliberately duplicates approximately nothing but is not shared with the
 * browser as a module: `@kube-ai-hub/api-client` is a DOM-typed package and this
 * server compiles with `lib: ["ES2022"]` only, so importing it would pull `fetch`,
 * `localStorage` and friends into a typecheck that must not have them. The two
 * decoders agree by test (`test/auth-token.test.ts` mirrors the client's cases),
 * not by shared code.
 *
 * The token is not verified: ks-apiserver signed it and will reject it on the
 * next call if it is forged or expired. Decoding is for display only — nothing in
 * this file grants access.
 */

import type { SessionUser } from './types';

interface TokenClaims {
  sub?: unknown;
  username?: unknown;
  exp?: unknown;
  /**
   * Identity-provider extras. KubeSphere's own issuer puts `email`, `username`
   * and `uninitialized` here; the kube-ai-hub issuer (the one this cluster hands
   * out) omits the field entirely, so every read below has to tolerate its
   * absence rather than assume it.
   */
  extra?: unknown;
}

/** base64url → utf8. */
function decodeSegment(segment: string): string | null {
  const normalised = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalised + '='.repeat((4 - (normalised.length % 4)) % 4);
  try {
    return Buffer.from(padded, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Read the first entry of an IdP extra.
 *
 * `extra` maps a claim name to an array of strings — KubeSphere writes
 * `{ "email": ["a@b"] }` — but a bare string is accepted too. Anything else is
 * "absent", which is different from "empty": the difference decides whether the
 * `email` field exists on the user at all.
 */
function firstExtra(extra: unknown, key: string): string | undefined {
  if (!extra || typeof extra !== 'object') return undefined;
  const value = (extra as Record<string, unknown>)[key];
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

function decodeClaims(token: string): TokenClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  const json = decodeSegment(parts[1]);
  if (!json) return null;
  try {
    const claims = JSON.parse(json) as TokenClaims;
    return claims && typeof claims === 'object' ? claims : null;
  } catch {
    return null;
  }
}

/**
 * The subset of a token the console shows.
 *
 * Returns `null` rather than throwing on a malformed token: a stored token can be
 * truncated or written by an older release, and the right response is "log in
 * again", not a blank screen.
 */
export function userFromToken(token: string): SessionUser | null {
  const claims = decodeClaims(token);
  if (!claims) return null;

  const name = typeof claims.sub === 'string' ? claims.sub : typeof claims.username === 'string' ? claims.username : '';
  if (!name) return null;

  const displayName = firstExtra(claims.extra, 'username');
  const email = firstExtra(claims.extra, 'email');

  return {
    name,
    // A pre-registration account is real but has not chosen a password yet; the
    // login page sends it to the confirmation screen instead of the console.
    initialized: firstExtra(claims.extra, 'uninitialized') !== 'true',
    ...(displayName === undefined ? {} : { displayName }),
    ...(email === undefined ? {} : { email }),
    ...(typeof claims.exp === 'number' ? { expiresAt: claims.exp } : {}),
  };
}

/** The user a bearer request is acting as, or `null` when there is no token. */
export function currentUser(token: string | undefined): SessionUser | null {
  if (!token) return null;
  return userFromToken(token);
}
