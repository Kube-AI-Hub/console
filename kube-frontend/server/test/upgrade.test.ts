import { createHash } from 'node:crypto';
import { createServer, request as httpRequest, type IncomingMessage, type Server } from 'node:http';
import type { Socket } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createHandler } from '../src/index';
import type { UpstreamConfig } from '../src/config';
import {
  createUpgradeHandler,
  isExecUpgradePath,
  upgradeBearerToken,
  upstreamProtocols,
} from '../src/upgrade';

/**
 * Container exec is a WebSocket, and the BFF is now the hop that accepts it.
 *
 * These tests speak raw HTTP handshakes rather than using a WebSocket library:
 * the contract here is exactly the handshake plus a transparent duplex pipe, and
 * a raw socket makes visible what a client library would hide (the relayed
 * subprotocol, the forwarded Authorization header, bytes that arrive in the same
 * read as the handshake).
 */

const servers: Server[] = [];
const sockets: Socket[] = [];

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.destroy();
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections?.();
          server.close(() => resolve());
        }),
    ),
  );
});

/** The RFC 6455 accept value for a client key. */
function acceptKey(key: string): string {
  return createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
}

const CLIENT_KEY = 'dGhlIHNhbXBsZSBub25jZQ==';

interface UpgradeReply {
  status: number;
  headers: IncomingMessage['headers'];
  body: string;
  socket?: Socket;
}

/** One raw upgrade request; resolves on 101 with the socket, or on any HTTP answer. */
function rawUpgrade(
  port: number,
  path: string,
  headers: Record<string, string> = {},
): Promise<UpgradeReply> {
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      host: '127.0.0.1',
      port,
      path,
      method: 'GET',
      headers: {
        connection: 'Upgrade',
        upgrade: 'websocket',
        'sec-websocket-key': CLIENT_KEY,
        'sec-websocket-version': '13',
        ...headers,
      },
    });
    request.on('upgrade', (response, socket) => {
      sockets.push(socket);
      resolve({ status: response.statusCode ?? 0, headers: response.headers, body: '', socket });
    });
    request.on('response', (response) => {
      let body = '';
      response.on('data', (chunk: Buffer) => {
        body += chunk.toString('utf8');
      });
      response.on('end', () => resolve({ status: response.statusCode ?? 0, headers: response.headers, body }));
    });
    request.on('error', reject);
    request.end();
  });
}

/** A stand-in for kube-apiserver's exec endpoint: completes the handshake and echoes bytes. */
async function fakeWsUpstream(): Promise<{
  baseUrl: string;
  recorded: IncomingMessage[];
  received: Buffer[];
}> {
  const recorded: IncomingMessage[] = [];
  const received: Buffer[] = [];
  const server = createServer();
  server.on('upgrade', (request, socket: Socket, head: Buffer) => {
    recorded.push(request);
    const offered = String(request.headers['sec-websocket-protocol'] ?? 'v5.channel.k8s.io');
    const selected = offered.split(',')[0]?.trim() ?? 'v5.channel.k8s.io';
    socket.write(
      [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        'Sec-WebSocket-Accept: ' + acceptKey(String(request.headers['sec-websocket-key'] ?? CLIENT_KEY)),
        'Sec-WebSocket-Protocol: ' + selected,
        '',
        '',
      ].join('\r\n'),
    );
    sockets.push(socket);
    if (head.length > 0) received.push(head);
    socket.on('data', (chunk: Buffer) => {
      received.push(chunk);
      // Echo the frame back unchanged; the test only proves the pipe is transparent.
      socket.write(chunk);
    });
    socket.on('error', () => socket.destroy());
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  return { baseUrl: 'http://127.0.0.1:' + address.port, recorded, received };
}

/** Start the BFF the way dev.ts does: request handler plus upgrade handler. */
async function startBff(upstream: string, overrides: Partial<UpstreamConfig> = {}): Promise<number> {
  const config: UpstreamConfig = {
    baseUrl: upstream,
    apiPrefix: '/kapis/resources.kubesphere.io/v1alpha3',
    mode: 'kapis',
    ...overrides,
  };
  const handler = createHandler({ config, manifest: async () => [] });
  const server = createServer((request, response) => void handler(request, response));
  server.on('upgrade', createUpgradeHandler(config));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  return address.port;
}

const EXEC_PATHNAME = '/api/v1/namespaces/kubesphere-system/pods/ks-console-0/exec';
const EXEC_QUERY = '?container=ks-console&stdin=true&stdout=true&tty=true&command=/bin/sh';
const EXEC_PATH = EXEC_PATHNAME + EXEC_QUERY;

describe('isExecUpgradePath', () => {
  it('accepts the kube exec subresource on both API prefixes', () => {
    expect(isExecUpgradePath(EXEC_PATHNAME)).toBe(true);
    expect(isExecUpgradePath('/api/v1/namespaces/demo/pods/web-0/exec')).toBe(true);
    expect(isExecUpgradePath('/apis/apps/v1/namespaces/demo/pods/web-0/exec')).toBe(true);
  });

  it('rejects every other path, so no other socket can be opened through it', () => {
    expect(isExecUpgradePath('/api/v1/namespaces/demo/pods/web-0/log')).toBe(false);
    expect(isExecUpgradePath('/api/v1/namespaces/demo/pods/web-0')).toBe(false);
    expect(isExecUpgradePath('/api/session/login')).toBe(false);
    expect(isExecUpgradePath('/kapis/terminal.kubesphere.io/v1alpha2/namespaces/demo/pods/web-0/exec')).toBe(false);
  });
});

describe('upgradeBearerToken', () => {
  const request = (headers: Record<string, string>): IncomingMessage =>
    ({ headers } as unknown as IncomingMessage);

  it('reads an Authorization header', () => {
    expect(upgradeBearerToken(request({ authorization: 'Bearer token-abc' }))).toBe('token-abc');
  });

  it('reads the browser subprotocol carrier', () => {
    expect(
      upgradeBearerToken(request({ 'sec-websocket-protocol': 'v5.channel.k8s.io, bearer.token-def' })),
    ).toBe('token-def');
  });

  it('prefers the header, which is what a non-browser client sends', () => {
    expect(
      upgradeBearerToken(
        request({ authorization: 'Bearer header-token', 'sec-websocket-protocol': 'bearer.protocol-token' }),
      ),
    ).toBe('header-token');
  });

  it('returns nothing when neither carrier is present', () => {
    expect(upgradeBearerToken(request({ 'sec-websocket-protocol': 'v5.channel.k8s.io' }))).toBeUndefined();
  });
});

describe('upstreamProtocols', () => {
  it('strips the bearer carrier and keeps the channel protocol', () => {
    const request = {
      headers: { 'sec-websocket-protocol': 'v5.channel.k8s.io, bearer.tok' },
    } as unknown as IncomingMessage;
    expect(upstreamProtocols(request)).toEqual(['v5.channel.k8s.io']);
  });

  it('defaults to the v5 channel protocol when the caller offered none', () => {
    expect(upstreamProtocols({ headers: {} } as unknown as IncomingMessage)).toEqual(['v5.channel.k8s.io']);
  });
});

describe('upgrade forwarding', () => {
  it('relays the handshake and pipes bytes in both directions', async () => {
    const upstream = await fakeWsUpstream();
    const port = await startBff(upstream.baseUrl);

    const reply = await rawUpgrade(port, EXEC_PATH, {
      'sec-websocket-protocol': 'v5.channel.k8s.io, bearer.token-abc',
    });

    expect(reply.status).toBe(101);
    expect(reply.headers['sec-websocket-protocol']).toBe('v5.channel.k8s.io');
    expect(reply.socket).toBeDefined();

    // What reached the upstream: the path and query verbatim, the bearer header,
    // and the channel subprotocol without the token carrier.
    expect(upstream.recorded).toHaveLength(1);
    const call = upstream.recorded[0]!;
    expect(call.url).toBe(EXEC_PATH);
    expect(call.headers.authorization).toBe('Bearer token-abc');
    expect(call.headers['sec-websocket-protocol']).toBe('v5.channel.k8s.io');

    // A stdin frame written by the browser reaches the upstream unchanged ...
    const frame = Buffer.concat([Buffer.from([0]), Buffer.from('echo tc-terminal-ok\n')]);
    reply.socket!.write(frame);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(Buffer.concat(upstream.received).equals(frame)).toBe(true);

    // ... and a stdout frame written by the upstream reaches the browser.
    const echoed = await new Promise<Buffer>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no frame came back')), 2000);
      reply.socket!.once('data', (chunk: Buffer) => {
        clearTimeout(timer);
        resolve(chunk);
      });
    });
    expect(echoed.equals(frame)).toBe(true);
  });

  it('accepts a plain Authorization header, for scripts and tests', async () => {
    const upstream = await fakeWsUpstream();
    const port = await startBff(upstream.baseUrl);

    const reply = await rawUpgrade(port, EXEC_PATH, { authorization: 'Bearer token-header' });

    expect(reply.status).toBe(101);
    expect(upstream.recorded[0]?.headers.authorization).toBe('Bearer token-header');
    reply.socket?.destroy();
  });

  it('refuses an upgrade with no bearer token', async () => {
    const upstream = await fakeWsUpstream();
    const port = await startBff(upstream.baseUrl);

    const reply = await rawUpgrade(port, EXEC_PATH, {
      'sec-websocket-protocol': 'v5.channel.k8s.io',
    });

    expect(reply.status).toBe(401);
    expect(JSON.parse(reply.body)).toMatchObject({ code: 'unauthorized', status: 401 });
    expect(upstream.recorded).toHaveLength(0);
  });

  it('refuses an upgrade on a path that is not exec', async () => {
    const upstream = await fakeWsUpstream();
    const port = await startBff(upstream.baseUrl);

    const reply = await rawUpgrade(port, '/api/v1/namespaces/demo/pods/web-0/log', {
      authorization: 'Bearer token-abc',
    });

    expect(reply.status).toBe(404);
    expect(JSON.parse(reply.body)).toMatchObject({ code: 'not_found', status: 404 });
    expect(upstream.recorded).toHaveLength(0);
  });

  it('answers 502 rather than hanging when the upstream is unreachable', async () => {
    // Port 1 is reserved and refuses connections, like a wrong KS_API_URL.
    const port = await startBff('http://127.0.0.1:1');

    const reply = await rawUpgrade(port, EXEC_PATH, { authorization: 'Bearer token-abc' });

    expect(reply.status).toBe(502);
    expect(JSON.parse(reply.body)).toMatchObject({ code: 'upstream_unreachable', status: 502 });
  });

  it('relays the upstream refusal instead of inventing a 502', async () => {
    // e.g. RBAC denies exec; the body is the only place the reason exists.
    const upstream = createServer((_request, response) => {
      response.writeHead(403, { 'content-type': 'application/json' });
      response.end('{"kind":"Status","message":"forbidden: cannot exec into pods"}');
    });
    await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
    servers.push(upstream);
    const address = upstream.address();
    if (address === null || typeof address === 'string') throw new Error('no port');

    const port = await startBff('http://127.0.0.1:' + address.port);
    const reply = await rawUpgrade(port, EXEC_PATH, { authorization: 'Bearer token-abc' });

    expect(reply.status).toBe(403);
    expect(reply.body).toContain('cannot exec into pods');
  });
});
