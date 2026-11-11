/**
 * Login, logout and "who am I".
 *
 * This is the one place the BFF does not pass a request through untouched, and
 * the reason is a credential the browser must not hold: `/oauth/token` needs a
 * `client_id` / `client_secret`, and shipping those to the browser makes them
 * public. The old console solved it the same way — a server-side route that
 * injects the client credentials (`server/middlewares/injectOAuthCredentials.js`).
 *
 * Everything else about the exchange is unchanged from the old console: a
 * password grant, upstream status passed through, and a user derived from the
 * returned token.
 */

import type { UpstreamConfig } from '../config';
import { codeForStatus } from '../errors';
import { currentUser } from './token';
import type { LoginErrorBody, SessionResponse, SessionUser } from './types';

export { currentUser };

/**
 * The OAuth client the console logs in as.
 *
 * Defaults match the old console's (`kubesphere` / `kubesphere`, from
 * `server/config.yaml`). This cluster registers a `kube-ai-hub` client whose
 * secret is also `kube-ai-hub`, so the values are configuration rather than
 * constants — they change per install, and a wrong one fails as
 * `invalid_client`, which reads like a bad password in the login form.
 */
export interface OAuthClientConfig {
  clientId: string;
  clientSecret: string;
  /**
   * The salt ks-apiserver expects the password to be mixed with.
   *
   * Read from the console's own `config.encryptKey` upstream (this install sets
   * `kubesphere`). Kept in the same object as the client credentials because it
   * is part of the same exchange: the three values must come from one install.
   */
  encryptKey: string;
}

export function oauthClientFromEnv(env: NodeJS.ProcessEnv = process.env): OAuthClientConfig {
  return {
    clientId: env['KS_OAUTH_CLIENT_ID'] ?? 'kubesphere',
    clientSecret: env['KS_OAUTH_CLIENT_SECRET'] ?? 'kubesphere',
    encryptKey: env['KS_OAUTH_ENCRYPT_KEY'] ?? 'kubesphere',
  };
}

/**
 * The password encoding ks-apiserver requires on `/oauth/token`.
 *
 * This install's server expects the old console's `mix(salt, base64(pw))` form,
 * not the plaintext: posting `P@88w0rd` answers `invalid_grant: incorrect
 * password`, while the mixed form is accepted. Verified against the live
 * cluster by reproducing the ciphertext the legacy console sends
 * (`MDAxMTAwMTAxMDAw@`]QLa\enjiSA` for that password with salt `kubesphere`).
 *
 * It provides no secrecy — the salt is public and the transform is reversible —
 * so it is not a security measure and must not be described as one. It is a wire
 * format, which is why it lives here in the BFF rather than in the browser: the
 * reader types and sees the password, and only this process encodes it.
 *
 * A server that accepts plaintext ignores the difference, so encoding
 * unconditionally is safe for both.
 */
export function encodePassword(salt: string, password: string): string {
  return mix(salt, Buffer.from(password, 'utf8').toString('base64'));
}

/** The old console's `mix` (`console/src/utils/index.js:889`), ported verbatim. */
function mix(salt: string, encoded: string): string {
  let key = salt;
  if (encoded.length > key.length) key += encoded.slice(0, encoded.length - key.length);

  const prefix: string[] = [];
  const out: string[] = [];
  for (let index = 0; index < key.length; index += 1) {
    const tomix = encoded.length > index ? encoded.charCodeAt(index) : 64;
    const sum = key.charCodeAt(index) + tomix;
    prefix.push(sum % 2 === 0 ? '0' : '1');
    out.push(String.fromCharCode(Math.floor(sum / 2)));
  }
  return `${Buffer.from(prefix.join(''), 'utf8').toString('base64')}@${out.join('')}`;
}

/** The upstream base URL with `path` appended; `baseUrl` may carry no trailing slash. */
function upstreamUrl(config: UpstreamConfig, path: string): string {
  return `${config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  const text = await response.text().catch(() => '');
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Map an OAuth failure to something the login form can phrase.
 *
 * `error_description` is the only detail ks-apiserver gives, and it is English
 * and unversioned ("incorrect password"), so it is matched loosely; anything
 * unrecognised keeps the generic message rather than leaking the raw string.
 */
export function loginErrorFor(status: number, body: Record<string, unknown> | null): LoginErrorBody {
  const description = typeof body?.['error_description'] === 'string' ? body['error_description'].toLowerCase() : '';
  const error = typeof body?.['error'] === 'string' ? body['error'] : '';

  if (status === 400 || status === 401) {
    // A wrong client secret also answers 400 here. It is not the user's fault,
    // and "check your password" would send them round in circles, so it gets its
    // own message.
    if (error === 'invalid_client') {
      return { code: 'invalid_client', message: description || 'invalid OAuth client', status };
    }
    if (description.includes('too many')) {
      return { code: 'too_many_attempts', message: description, status: 429 };
    }
    return {
      code: 'invalid_credentials',
      message: description || 'incorrect username or password',
      status,
    };
  }
  if (status === 429) {
    return { code: 'too_many_attempts', message: description || 'too many login attempts', status };
  }
  if (status >= 500) {
    return { code: 'upstream_unreachable', message: description || 'ks-apiserver is unavailable', status };
  }
  return { code: codeForStatus(status), message: description || error || 'login failed', status };
}

export interface LoginInput {
  username: string;
  password: string;
}

/**
 * Exchange a username and password for a token.
 *
 * The password arrives as typed and is encoded here — see `encodePassword` for
 * why the encoding is required and why it belongs in this process rather than in
 * the browser. The comment that used to sit here said the transform was dropped
 * because it "broke passwords containing `@`"; the live cluster disproved that,
 * and a login that cannot happen at all is a worse bug than one that only works
 * with a different encoding.
 */
export async function login(
  config: UpstreamConfig,
  client: OAuthClientConfig,
  input: LoginInput,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; session: SessionResponse } | { ok: false; error: LoginErrorBody }> {
  const form = new URLSearchParams({
    username: input.username,
    password: encodePassword(client.encryptKey, input.password),
    grant_type: 'password',
    client_id: client.clientId,
    client_secret: client.clientSecret,
  });

  let response: Response;
  try {
    response = await fetchImpl(upstreamUrl(config, '/oauth/token'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: form.toString(),
      ...(config.insecure === true ? {} : {}),
    });
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'upstream_unreachable',
        message: cause instanceof Error ? cause.message : 'ks-apiserver is unreachable',
        status: 502,
      },
    };
  }

  const body = await readJson(response);
  if (!response.ok) {
    return { ok: false, error: loginErrorFor(response.status, body) };
  }

  const token = typeof body?.['access_token'] === 'string' ? body['access_token'] : '';
  const user = currentUser(token);
  if (!token || !user) {
    // A 200 with no usable token means either the issuer changed shape or the
    // token is malformed. Both are ours to fix, not the user's.
    return {
      ok: false,
      error: { code: 'invalid_token_response', message: 'the token response could not be read', status: 502 },
    };
  }

  return { ok: true, session: { token, user } };
}

/**
 * Resolve the signed-in user.
 *
 * The claims alone are not enough: after `GET /oauth/logout` a token still parses
 * and still carries a future `exp`, so answering from the JWT alone would render
 * a whole console whose every request then fails with 401. ks-apiserver is the
 * authority on validity, so the token is spent on one cheap authorised read and
 * the answer is whether it was accepted.
 *
 * The user object comes from the locally decoded claims rather than from that
 * response body: it is the shape the UI expects (`name` / `initialized`), and the
 * upstream document is a different one (KubeSphere's user resource).
 */
export async function resolveCurrentUser(
  config: UpstreamConfig,
  token: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<SessionUser | null> {
  const user = currentUser(token);
  if (!token || !user) return null;

  const response = await fetchImpl(upstreamUrl(config, `/kapis/iam.kubesphere.io/v1alpha2/users/${encodeURIComponent(user.name)}`), {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  // Anything other than success leaves the reader logged out: a 403 on the user's
  // own record means the token is not usable, and reporting "signed in" would only
  // move the failure to the first resource request.
  return response.ok ? user : null;
}

/**
 * Revoke a token.
 *
 * `GET /oauth/logout` is the only verb ks-apiserver accepts (POST and DELETE
 * answer 401), and a 200 invalidates the token immediately — the old console
 * called it before dropping the client-side copy, so a stolen token stops
 * working rather than merely being forgotten.
 */
export async function logout(
  config: UpstreamConfig,
  token: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (!token) return;
  try {
    await fetchImpl(upstreamUrl(config, '/oauth/logout'), {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch {
    // Logout must succeed locally even when the cluster is unreachable — the
    // browser has already dropped the token, and a 500 here would leave the user
    // on a page they asked to leave.
  }
}

/** Bearer token from an `Authorization` header, or undefined. */
export function bearerToken(header: string | string[] | undefined): string | undefined {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match?.[1];
}
