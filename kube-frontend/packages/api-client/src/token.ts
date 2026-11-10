/**
 * Reading a session token.
 *
 * The BFF and the browser both need this — the BFF to answer `/api/session/me`,
 * the browser to show the signed-in account before any request finishes — and a
 * second copy is how the two start disagreeing about which accounts are
 * uninitialised. It runs in either environment: no `Buffer`, no `process`.
 *
 * The token is never verified here. ks-apiserver signed it and will reject it on
 * the next call if it is forged; decoding only decides what to display.
 */

export interface SessionUser {
  /** The account name (`sub`), which is what ks-apiserver authorises against. */
  name: string;
  displayName?: string;
  email?: string;
  /**
   * `false` for a pre-registration account that has not set a password. Such a
   * token authenticates but every request is refused, so the login page routes
   * it to password confirmation instead of the console.
   */
  initialized: boolean;
  /** Seconds since the epoch, when the issuer included it. */
  expiresAt?: number;
}

interface TokenClaims {
  sub?: unknown;
  username?: unknown;
  exp?: unknown;
  /**
   * Identity-provider extras. KubeSphere's own issuer puts `email`, `username`
   * and `uninitialized` here; the kube-ai-hub issuer this cluster uses omits the
   * field entirely, so every read has to tolerate its absence rather than
   * assume it.
   */
  extra?: unknown;
}

/** base64url → utf8. */
function decodeSegment(segment: string): string | null {
  if (typeof atob !== 'function') return null;
  const normalised = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalised + '='.repeat((4 - (normalised.length % 4)) % 4);
  try {
    const binary = atob(padded);
    // `atob` yields one char per byte; the claims are UTF-8.
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
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
 * Read the first entry of an IdP extra.
 *
 * `extra` maps a claim name to an array of strings — KubeSphere writes
 * `{ "email": ["a@b"] }` — but a bare string is accepted too. Anything else is
 * "absent", which is different from "empty": the difference decides whether the
 * `email` field is shown at all.
 */
function firstExtra(extra: unknown, key: string): string | undefined {
  if (!extra || typeof extra !== 'object') return undefined;
  const value = (extra as Record<string, unknown>)[key];
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

/** Who a token belongs to, or `null` if it cannot be read. */
export function userFromToken(token: string): SessionUser | null {
  const claims = decodeClaims(token);
  if (!claims) return null;

  const name = typeof claims.sub === 'string' ? claims.sub : typeof claims.username === 'string' ? claims.username : '';
  if (!name) return null;

  const displayName = firstExtra(claims.extra, 'username');
  const email = firstExtra(claims.extra, 'email');

  return {
    name,
    initialized: firstExtra(claims.extra, 'uninitialized') !== 'true',
    ...(displayName === undefined ? {} : { displayName }),
    ...(email === undefined ? {} : { email }),
    ...(typeof claims.exp === 'number' ? { expiresAt: claims.exp } : {}),
  };
}

/**
 * Whether a token's expiry has passed.
 *
 * Cheap local check only: a revoked token still looks valid, which is why the
 * app still asks the BFF once per load.
 */
export function isTokenExpired(token: string, now: number = Date.now()): boolean {
  const claims = decodeClaims(token);
  return typeof claims?.exp === 'number' && claims.exp * 1000 <= now;
}
