import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createHandler } from '../src/index';
import type { UpstreamConfig } from '../src/config';
import { encodePassword, loginErrorFor } from '../src/auth/session';
import { userFromToken } from '../src/auth/token';

/**
 * Login, `me` and logout against a stand-in for ks-apiserver.
 *
 * The OAuth exchange is the only place the BFF injects a credential, so the
 * things worth pinning are: the client secret never reaches the browser, the
 * form encoding is what ks-apiserver expects, and a failure keeps the narrow
 * code the login form phrases (rather than collapsing to "bad request").
 */

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

interface Recorded {
  method: string | undefined;
  url: string | undefined;
  body: string;
  authorization: string | undefined;
}

/** Start an upstream that answers `routes[path]` and records requests. */
async function upstream(routes: Record<string, { status: number; body: unknown }>): Promise<{ baseUrl: string; calls: Recorded[] }> {
  const calls: Recorded[] = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const path = (request.url ?? '/').split('?')[0] ?? '/';
      calls.push({
        method: request.method,
        url: request.url,
        body: Buffer.concat(chunks).toString('utf8'),
        authorization: request.headers.authorization,
      });
      const route = routes[path] ?? { status: 404, body: { message: 'not found' } };
      response.writeHead(route.status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(route.body));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return { baseUrl: `http://127.0.0.1:${port}`, calls };
}

/**
 * A JWT with the given claims; the signature is never checked by the BFF. */
function token(claims: Record<string, unknown>): string {
  const encode = (value: unknown): string =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.signature`;}

const CONFIG: UpstreamConfig = { baseUrl: 'http://placeholder', apiPrefix: '/kapis/resources.kubesphere.io/v1alpha3', mode: 'kapis' };

async function bff(baseUrl: string, fetchImpl?: typeof fetch) {
  const server = createServer((request, response) => {
    void createHandler({
      config: { ...CONFIG, baseUrl },
      oauthClient: { clientId: 'kube-ai-hub', clientSecret: 'kube-ai-hub', encryptKey: 'kubesphere' },
      ...(fetchImpl ? { fetchImpl } : {}),
    })(request, response);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return `http://127.0.0.1:${port}`;
}

function post(url: string, body: unknown): Promise<Response> {
  return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

describe('POST /api/session/login', () => {
  it('exchanges a password for a token and returns the user', async () => {
    const accessToken = token({ sub: 'admin', username: 'admin', exp: 4102444800 });
    const { baseUrl, calls } = await upstream({
      '/oauth/token': { status: 200, body: { access_token: accessToken, token_type: 'Bearer' } },
    });
    const url = await bff(baseUrl);

    const response = await post(`${url}/api/session/login`, { username: 'admin', password: 'P@88w0rd' });
    expect(response.status).toBe(200);

    const body = (await response.json()) as { token: string; user: { name: string; initialized: boolean } };
    expect(body.token).toBe(accessToken);
    expect(body.user.name).toBe('admin');
    expect(body.user.initialized).toBe(true);

    // The form the upstream receives, and the secret it carries, which the
    // browser never sees.
    expect(calls[0]?.url).toBe('/oauth/token');
    const form = new URLSearchParams(calls[0]?.body ?? '');
    expect(form.get('grant_type')).toBe('password');
    expect(form.get('username')).toBe('admin');
    /*
     * The password is encoded before it leaves this process. Pinned to the exact
     * ciphertext the legacy console sends, captured from the live cluster: a
     * plaintext password is rejected there with `invalid_grant`, so this string is
     * the working contract, not an implementation detail.
     */
    expect(form.get('password')).toBe('MDAxMTAwMTAxMDAw@`]QLa\\enjiSA');
    expect(form.get('client_id')).toBe('kube-ai-hub');
    expect(form.get('client_secret')).toBe('kube-ai-hub');
  });

  it('encodes a password containing `@` to the same string regardless of length', async () => {
    /*
     * `@` is the separator in the encoded form, and the payload is base64 of the
     * password after a salt is mixed in. A short password is padded with the
     * sentinel `64`, a long one extends the salt — both branches must produce a
     * stable, server-accepted string. The expected values are the ones the live
     * cluster accepts; `encodePassword` is pure, so asserting here is the cheapest
     * way to pin the wire format.
     */
    expect(encodePassword('kubesphere', 'P@88w0rd')).toBe('MDAxMTAwMTAxMDAw@`]QLa\\enjiSA');

    // A long password takes the other branch: the salt is extended with the
    // payload, so the encoded body is longer than the salt.
    const long = 'a'.repeat(40);
    const encoded = encodePassword('kubesphere', long);
    expect(encoded).toContain('@');
    expect(encoded.split('@')[1]!.length).toBe(Buffer.from(long).toString('base64').length);
  });

  it('keeps bad credentials distinguishable from a bad client', async () => {
    const wrongPassword = await upstream({
      '/oauth/token': {
        status: 400,
        body: { error: 'invalid_grant', error_description: 'incorrect password' },
      },
    });
    const urlA = await bff(wrongPassword.baseUrl);
    const responseA = await post(`${urlA}/api/session/login`, { username: 'admin', password: 'x' });
    expect(responseA.status).toBe(400);
    expect(((await responseA.json()) as { code: string }).code).toBe('invalid_credentials');

    const wrongClient = await upstream({
      '/oauth/token': { status: 400, body: { error: 'invalid_client', error_description: 'bad client' } },
    });
    const urlB = await bff(wrongClient.baseUrl);
    const responseB = await post(`${urlB}/api/session/login`, { username: 'admin', password: 'x' });
    expect(((await responseB.json()) as { code: string }).code).toBe('invalid_client');
  });

  it('refuses an empty username or password without calling upstream', async () => {
    const { baseUrl, calls } = await upstream({});
    const url = await bff(baseUrl);

    const response = await post(`${url}/api/session/login`, { username: '  ', password: 'x' });
    expect(response.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('reports an unreachable cluster as a gateway problem, not a bad password', async () => {
    const url = await bff('http://127.0.0.1:1');
    const response = await post(`${url}/api/session/login`, { username: 'admin', password: 'x' });
    expect(response.status).toBe(502);
    expect(((await response.json()) as { code: string }).code).toBe('upstream_unreachable');
  });
});

describe('GET /api/session/me', () => {
  it('returns the user when the cluster accepts the token', async () => {
    const { baseUrl, calls } = await upstream({ '/kapis/iam.kubesphere.io/v1alpha2/users/alice': { status: 200, body: {} } });
    const url = await bff(baseUrl);
    const accessToken = token({ sub: 'alice', extra: { email: ['alice@example.com'] } });

    const response = await fetch(`${url}/api/session/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { user: { name: string; email?: string } };
    expect(body.user.name).toBe('alice');
    expect(body.user.email).toBe('alice@example.com');
    // The token is spent on one authorised read: decoding alone cannot tell a
    // revoked token from a live one.
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain('/kapis/iam.kubesphere.io/v1alpha2/users/alice');
    expect(calls[0]?.authorization).toBe(`Bearer ${accessToken}`);
  });

  it('answers 401 for a revoked token even though it still decodes', async () => {
    // This is the failure a claims-only `me` produced: the console painted and
    // every list behind it answered 401.
    const { baseUrl } = await upstream({
      '/kapis/iam.kubesphere.io/v1alpha2/users/alice': { status: 401, body: { message: 'token not found in cache' } },
    });
    const url = await bff(baseUrl);

    const response = await fetch(`${url}/api/session/me`, {
      headers: { Authorization: `Bearer ${token({ sub: 'alice', exp: 4102444800 })}` },
    });
    expect(response.status).toBe(401);
  });

  it('answers 401 without a token', async () => {
    const { baseUrl } = await upstream({});
    const url = await bff(baseUrl);
    expect((await fetch(`${url}/api/session/me`)).status).toBe(401);
  });
});

describe('POST /api/session/logout', () => {
  it('revokes upstream with the bearer token, then reports 204', async () => {
    const { baseUrl, calls } = await upstream({ '/oauth/logout': { status: 200, body: { ok: true } } });
    const url = await bff(baseUrl);

    const response = await fetch(`${url}/api/session/logout`, {
      method: 'POST',
      headers: { Authorization: 'Bearer abc.def.ghi' },
    });

    expect(response.status).toBe(204);
    // `GET` is the only verb ks-apiserver accepts (POST and DELETE answer 401).
    expect(calls[0]?.method).toBe('GET');
    expect(calls[0]?.url).toBe('/oauth/logout');
    expect(calls[0]?.authorization).toBe('Bearer abc.def.ghi');
  });

  it('still reports 204 when the cluster is unreachable', async () => {
    const url = await bff('http://127.0.0.1:1');
    const response = await fetch(`${url}/api/session/logout`, {
      method: 'POST',
      headers: { Authorization: 'Bearer abc.def.ghi' },
    });
    // The browser has already dropped its copy; failing here strands the reader.
    expect(response.status).toBe(204);
  });
});

describe('userFromToken', () => {
  it('reads the kube-ai-hub claims, which carry no `extra`', () => {
    // This cluster's issuer writes only sub/username/exp. The old console read
    // `extra.email[0]` unconditionally and produced undefined for every field.
    const user = userFromToken(token({ iss: 'kube-ai-hub', sub: 'admin', exp: 4102444800 }));
    expect(user).toEqual({ name: 'admin', initialized: true, expiresAt: 4102444800 });
  });

  it('honours KubeSphere array-style extras', () => {
    const user = userFromToken(
      token({ sub: 'bob', extra: { username: ['Bob'], email: ['b@x.io'], uninitialized: ['true'] } }),
    );
    expect(user).toMatchObject({ name: 'bob', displayName: 'Bob', email: 'b@x.io', initialized: false });
  });

  it('rejects a token with no subject', () => {
    expect(userFromToken(token({ exp: 1 }))).toBeNull();
  });

  it('rejects a malformed token', () => {
    expect(userFromToken('not-a-jwt')).toBeNull();
  });
});

describe('loginErrorFor', () => {
  it('maps a rate limit to its own code', () => {
    expect(loginErrorFor(429, null).code).toBe('too_many_attempts');
  });

  it('maps a server error to an unreachable cluster', () => {
    expect(loginErrorFor(503, null).code).toBe('upstream_unreachable');
  });
});
