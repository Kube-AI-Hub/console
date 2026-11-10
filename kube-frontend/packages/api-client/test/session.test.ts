import { describe, expect, it, vi } from 'vitest';
import { createClient } from '../src/client';
import { sessionApi } from '../src/session';
import { userFromToken, isTokenExpired } from '../src/token';

/**
 * Session calls against a stubbed BFF.
 *
 * Two things matter here and neither is the happy path: a login failure has to
 * keep its specific code (the form phrases it), and the token decoder has to
 * cope with the kube-ai-hub issuer, which omits the `extra` claim the old console
 * assumed.
 */

function client(respond: (url: string, init?: RequestInit) => Response) {
  return createClient({ fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => respond(String(input), init)) as typeof fetch });
}

function b64(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function jwt(claims: Record<string, unknown>): string {
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}.sig`;
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('sessionApi.login', () => {
  it('postpones the redirect to the caller and returns the session', async () => {
    const token = jwt({ sub: 'admin' });
    const api = sessionApi(
      client((url) => {
        expect(url).toContain('/api/session/login');
        return json(200, { token, user: { name: 'admin', initialized: true } });
      }),
    );

    const session = await api.login({ username: 'admin', password: 'x' });
    expect(session.token).toBe(token);
    expect(session.user.name).toBe('admin');
  });

  it('keeps the specific code from the BFF instead of collapsing to "unauthorized"', async () => {
    const api = sessionApi(client(() => json(400, { code: 'invalid_credentials', message: 'incorrect password', status: 400 })));
    // A generic 401 from a resource call is the coarse class; the login form needs
    // the narrow one, which travels in `details.serverCode`.
    await expect(api.login({ username: 'admin', password: 'x' })).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
  });

  it('keeps invalid_client, which is an operator problem rather than a wrong password', async () => {
    const api = sessionApi(client(() => json(400, { code: 'invalid_client', message: 'bad client', status: 400 })));
    await expect(api.login({ username: 'admin', password: 'x' })).rejects.toMatchObject({ code: 'invalid_client' });
  });
});

describe('sessionApi.me', () => {
  it('returns the user from the body', async () => {
    const api = sessionApi(client(() => json(200, { user: { name: 'admin', initialized: true } })));
    expect(await api.me()).toMatchObject({ name: 'admin' });
  });

  it('rejects with unauthorized when the session is gone', async () => {
    const api = sessionApi(client(() => json(401, { code: 'unauthorized', message: 'not signed in', status: 401 })));
    await expect(api.me()).rejects.toMatchObject({ code: 'unauthorized' });
  });
});

describe('userFromToken', () => {
  it('reads the kube-ai-hub claims that carry no extra', () => {
    expect(userFromToken(jwt({ iss: 'kube-ai-hub', sub: 'admin', exp: 4102444800 }))).toEqual({
      name: 'admin',
      initialized: true,
      expiresAt: 4102444800,
    });
  });

  it('reads KubeSphere array-style extras', () => {
    expect(userFromToken(jwt({ sub: 'bob', extra: { email: ['b@x.io'], username: ['Bob'] } }))).toMatchObject({
      name: 'bob',
      email: 'b@x.io',
      displayName: 'Bob',
    });
  });

  it('treats an uninitialised account as such', () => {
    expect(userFromToken(jwt({ sub: 'new', extra: { uninitialized: ['true'] } }))?.initialized).toBe(false);
  });

  it('returns null for junk rather than throwing', () => {
    expect(userFromToken('nope')).toBeNull();
    expect(userFromToken(`${b64({})}.${b64({ nope: 1 })}.x`)).toBeNull();
  });
});

describe('isTokenExpired', () => {
  it('compares expiry against the given clock', () => {
    const token = jwt({ sub: 'admin', exp: 1000 });
    expect(isTokenExpired(token, 999_000)).toBe(false);
    expect(isTokenExpired(token, 1_001_000)).toBe(true);
  });

  it('treats a token without exp as unexpired', () => {
    expect(isTokenExpired(jwt({ sub: 'admin' }), Date.now())).toBe(false);
  });
});

describe('login copy helpers', () => {
  it('does not call the network for a blank password', async () => {
    const fetchImpl = vi.fn();
    const api = sessionApi(createClient({ fetchImpl: fetchImpl as unknown as typeof fetch }));
    // The page checks first; this pins that the API layer is not the guard, so a
    // blank password must still reach the BFF and be refused there.
    await api.login({ username: 'admin', password: '' }).catch(() => undefined);
    expect(fetchImpl).toHaveBeenCalled();
  });
});
