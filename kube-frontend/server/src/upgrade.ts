import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import type { Duplex } from 'node:stream';
import type { UpstreamConfig } from './config';
import { isProxiedPath } from './proxy';

/**
 * WebSocket upgrade forwarding for container exec and the versioned node shell.
 *
 * The BFF's HTTP proxy answers everything the cluster serves as plain HTTP; exec
 * is the one endpoint that is a protocol upgrade. It cannot go through
 * 'proxyRequest': that forwards an ordinary request and pipes the response, while
 * exec needs the raw duplex byte stream that starts with a 101 handshake. This
 * module keeps that hop separate so the HTTP proxy keeps its single, transparent
 * rule.
 *
 * Containers use kube's v5 channel protocol. Nodes use KubeSphere's JSON terminal
 * protocol and nodes/exec authorization; only that exact kapis route is allowed.
 * Frames remain transparent on this hop. See the container-detail and nodes designs.
 */

/**
 * Browser subprotocol entry that carries the bearer token.
 *
 * The browser's WebSocket constructor cannot set request headers, and this app's
 * identity is a bearer token (there is no cookie session). Subprotocols are the
 * one handshake field the API lets a page choose, so the token rides there as
 * 'bearer.<token>' and is stripped before the handshake is forwarded upstream.
 * DEC-CORE-KUBE-FRONTEND-08 names this option; a query parameter was rejected
 * because tokens end up in access logs and proxy traces.
 */
export const BEARER_PROTOCOL_PREFIX = 'bearer.';

/** Channel protocol the upstream exec endpoint expects (k8s 1.37 removed SPDY). */
export const CHANNEL_PROTOCOL = 'v5.channel.k8s.io';

/** How long the upstream may take to answer the handshake before this process gives up. */
export const UPGRADE_TIMEOUT_MS = 15_000;

/**
 * Which upgrades are forwarded.
 *
 * Only the exec subresource. A generic upgrade proxy would forward any socket to
 * the cluster, and unlike the HTTP proxy — where every path is a documented kube
 * endpoint — an upgraded socket is an interactive shell. Keeping the rule narrow
 * means a mistake here cannot silently open a channel that is not exec.
 */
export function isExecUpgradePath(pathname: string): boolean {
  if (!isProxiedPath(pathname)) return false;
  // Only the documented node endpoint, never a generic kapis upgrade proxy.
  if (/^\/kapis\/terminal\.kubesphere\.io\/v1alpha2\/(?:clusters\/[^/]+\/)?nodes\/[^/]+\/exec$/.test(pathname)) return true;
  if (!pathname.startsWith('/api/v1/') && !pathname.startsWith('/apis/')) return false;
  return pathname.endsWith('/exec');
}

/** Subprotocols offered by the browser, in order, without empty entries. */
export function offeredProtocols(request: IncomingMessage): string[] {
  const raw = request.headers['sec-websocket-protocol'];
  if (typeof raw !== 'string' || raw.length === 0) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * The bearer token presented on the upgrade.
 *
 * Two carriers, in order:
 * 1. 'Authorization' — what a script or test client sends, and what this process
 *    forwards upstream.
 * 2. 'bearer.<token>' subprotocol — the only carrier a browser page has.
 */
export function upgradeBearerToken(request: IncomingMessage): string | undefined {
  const header = request.headers.authorization;
  if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
    const token = header.slice('bearer '.length).trim();
    if (token) return token;
  }
  const protocol = offeredProtocols(request).find((entry) => entry.startsWith(BEARER_PROTOCOL_PREFIX));
  const token = protocol?.slice(BEARER_PROTOCOL_PREFIX.length).trim();
  return token && token.length > 0 ? token : undefined;
}

/** Subprotocols to offer upstream: the browser's channel protocols, bearer entry stripped. */
export function upstreamProtocols(request: IncomingMessage): string[] {
  const offered = offeredProtocols(request).filter((entry) => !entry.startsWith(BEARER_PROTOCOL_PREFIX));
  // A caller that offers nothing still gets the protocol kube needs; the upstream
  // rejects a handshake with no supported value, and defaulting here is more
  // useful than refusing.
  const nodePath = (request.url ?? '').split('?')[0] ?? '';
  return offered.length > 0 ? offered : [nodePath.startsWith('/kapis/terminal.kubesphere.io/') ? 'binary.k8s.io' : CHANNEL_PROTOCOL];
}

/** 'Server.on(upgrade)' handler shape, so tests can attach it to a bare server. */
export type UpgradeHandler = (request: IncomingMessage, socket: Duplex, head: Buffer) => void;

const STATUS_TEXT: Record<number, string> = {
  401: 'Unauthorized',
  404: 'Not Found',
  502: 'Bad Gateway',
};

/**
 * Answer an upgrade with a normal HTTP response and close.
 *
 * A browser cannot read this status (the WebSocket API reports only "handshake
 * failed"), but scripts and the page's own diagnostic message can, and a response
 * is more honest than dropping the socket.
 */
function reject(client: Socket, status: number, code: string, message: string): void {
  if (!client.writable) {
    client.destroy();
    return;
  }
  const body = JSON.stringify({ code, message, status });
  client.end(
    'HTTP/1.1 ' +
      status +
      ' ' +
      (STATUS_TEXT[status] ?? 'Error') +
      '\r\n' +
      'content-type: application/json; charset=utf-8\r\n' +
      'content-length: ' +
      Buffer.byteLength(body) +
      '\r\n' +
      'cache-control: no-store\r\n' +
      'connection: close\r\n' +
      '\r\n' +
      body,
  );
}

/**
 * Write one raw upstream response head to the client socket.
 *
 * A 101 keeps its headers verbatim: Connection/Upgrade and Sec-WebSocket-* are the
 * handshake. A plain HTTP answer (a refused exec) is relayed differently — the
 * upstream body is already de-chunked by node:http, so its transfer-encoding is
 * a lie on this hop; the head says "close" instead, and the body is delimited by
 * the socket ending.
 */
function writeHead(target: Socket, status: number, message: string, rawHeaders: string[], upgraded: boolean): void {
  const lines = ['HTTP/1.1 ' + status + ' ' + message];
  let hasLength = false;
  for (let index = 0; index < rawHeaders.length; index += 2) {
    const name = String(rawHeaders[index]).toLowerCase();
    if (!upgraded && (name === 'transfer-encoding' || name === 'connection' || name === 'keep-alive')) continue;
    if (name === 'content-length') hasLength = true;
    lines.push(String(rawHeaders[index]) + ': ' + String(rawHeaders[index + 1]));
  }
  if (!upgraded && !hasLength) lines.push('connection: close');
  target.write(lines.join('\r\n') + '\r\n\r\n');
}

/** Splice the two raw sockets together and make either close take the other down. */
function bridge(client: Socket, upstream: Socket): void {
  client.setNoDelay(true);
  upstream.setNoDelay(true);
  client.pipe(upstream);
  upstream.pipe(client);
  const destroyBoth = (): void => {
    client.destroy();
    upstream.destroy();
  };
  client.on('error', destroyBoth);
  upstream.on('error', destroyBoth);
  client.on('close', () => upstream.destroy());
  upstream.on('close', () => client.destroy());
}

/**
 * Build the 'upgrade' handler.
 *
 * Failure modes, all answered rather than left hanging:
 * - not an exec path: 404 (nothing else is upgradeable here);
 * - no bearer: 401;
 * - upstream unreachable or handshake timeout: 502;
 * - upstream refuses the handshake (403 RBAC, 404 pod): its status and body are
 *   relayed verbatim.
 */
export function createUpgradeHandler(config: UpstreamConfig): UpgradeHandler {
  return (request, socket, head) => {
    const client = socket as Socket;
    client.on('error', () => client.destroy());

    const url = new URL(request.url ?? '/', 'http://' + (request.headers.host ?? 'localhost'));
    if (!isExecUpgradePath(url.pathname)) {
      reject(client, 404, 'not_found', 'no such upgrade endpoint');
      return;
    }

    const token = upgradeBearerToken(request);
    if (!token) {
      reject(client, 401, 'unauthorized', 'a bearer token is required to open an exec session');
      return;
    }

    const upstream = new URL(config.baseUrl);
    const isHttps = upstream.protocol === 'https:';
    const sendRequest = isHttps ? httpsRequest : httpRequest;

    const headers: Record<string, string> = {
      connection: 'Upgrade',
      upgrade: 'websocket',
      authorization: 'Bearer ' + token,
      'sec-websocket-protocol': upstreamProtocols(request).join(', '),
      host: upstream.host,
    };
    for (const name of ['sec-websocket-key', 'sec-websocket-version', 'sec-websocket-extensions', 'user-agent']) {
      const value = request.headers[name];
      if (typeof value === 'string' && value.length > 0) headers[name] = value;
    }

    const upstreamRequest = sendRequest({
      protocol: upstream.protocol,
      hostname: upstream.hostname,
      port: upstream.port || (isHttps ? 443 : 80),
      method: 'GET',
      path: url.pathname + url.search,
      headers,
      // Same opt-in as the HTTP proxy: self-signed cluster certificates are normal
      // in air-gapped installs.
      ...(config.insecure === true ? { rejectUnauthorized: false } : {}),
    });
    client.on('close', () => upstreamRequest.destroy());

    const timer = setTimeout(() => {
      upstreamRequest.destroy(new Error('upstream exec handshake timed out'));
    }, UPGRADE_TIMEOUT_MS);
    // Do not hold the process open for a terminal that is just slow to start.
    timer.unref();

    upstreamRequest.on('upgrade', (response, upstreamSocket, upstreamHead) => {
      clearTimeout(timer);
      writeHead(client, response.statusCode ?? 101, response.statusMessage ?? 'Switching Protocols', response.rawHeaders, true);
      // Bytes already read past the handshake belong to the side they came from;
      // dropping them corrupts the first frame of the session.
      if (upstreamHead.length > 0) client.write(upstreamHead);
      if (head.length > 0) upstreamSocket.write(head);
      bridge(client, upstreamSocket);
    });

    /*
     * The upstream declined to upgrade (RBAC 403, wrong container 400, ...). Relay the
     * refusal rather than turning it into 502: it is an answer from the cluster, and
     * its body is the only place the reason exists.
     */
    upstreamRequest.on('response', (response) => {
      clearTimeout(timer);
      writeHead(client, response.statusCode ?? 502, response.statusMessage ?? 'Bad Gateway', response.rawHeaders, false);
      response.pipe(client);
    });

    upstreamRequest.on('error', (cause) => {
      clearTimeout(timer);
      reject(client, 502, 'upstream_unreachable', cause instanceof Error ? cause.message : 'upstream unreachable');
    });

    upstreamRequest.end();
  };
}
