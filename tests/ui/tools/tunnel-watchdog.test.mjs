/**
 * Self-checks for the tunnel watchdog (no cluster).
 *
 * The case that matters is the one observed in practice: the port accepts connections and never
 * answers. A TCP-level check would call that healthy, so the probe must be an HTTP request with a
 * deadline.
 */
import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import net from 'node:net';
import http from 'node:http';
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

const children = [];
const markers = [];

after(() => {
  for (const child of children.splice(0)) child.kill('SIGKILL');
  for (const marker of markers.splice(0)) rmSync(marker, { force: true });
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A marker path unique to this process.
 *
 * A fixed path lets a file left by an earlier run satisfy the assertion, which is exactly how a
 * test stops being able to fail: it kept passing with the probe deliberately broken.
 */
let markerSeq = 0;
function markerPath(name) {
  markerSeq += 1;
  return `/tmp/watchdog-${name}-${process.pid}-${Date.now()}-${markerSeq}.marker`;
}

/**
 * Start a healthy stub on an ephemeral port and return it with its URL.
 *
 * Fixed ports collide with a server left behind by an earlier run (observed as
 * `EADDRINUSE: 127.0.0.1:19211`), which fails the test for a reason unrelated to the watchdog.
 */
function startHealthy() {
  const server = http.createServer((_request, response) => {
    response.writeHead(200);
    response.end('ok');
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/` })),
  );
}

/** Accepts the connection and then says nothing: the hung-forward shape. */
function startBlackHole() {
  const sockets = [];
  const server = net.createServer((socket) => sockets.push(socket));
  server.on('close', () => sockets.forEach((socket) => socket.destroy()));
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/` })),
  );
}

function startWatchdog(url, marker) {
  const child = spawn(
    process.execPath,
    [
      'tools/tunnel-watchdog.mjs',
      '--url', url,
      '--interval', '150',
      '--timeout', '300',
      '--strikes', '2',
      '--restart', `touch ${marker}`,
    ],
    { cwd: new URL('..', import.meta.url).pathname, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  children.push(child);
  const lines = [];
  child.stdout.on('data', (chunk) => lines.push(String(chunk)));
  return lines;
}

describe('tunnel watchdog', () => {
  it('never restarts while the tunnel answers', async () => {
    const marker = markerPath('healthy');
    markers.push(marker);
    rmSync(marker, { force: true });
    const { server, url } = await startHealthy();
    startWatchdog(url, marker);
    await wait(1200);
    assert.equal(existsSync(marker), false, '健康的隧道不该被重启');
    server.close();
  });

  it('restarts a tunnel that accepts connections but never answers', async () => {
    const marker = markerPath('hung');
    markers.push(marker);
    rmSync(marker, { force: true });
    const { server, url } = await startBlackHole();
    const lines = startWatchdog(url, marker);

    // Two failed probes at ~450ms each (300ms deadline + 150ms interval), plus slack.
    for (let waited = 0; waited < 4000 && !existsSync(marker); waited += 100) await wait(100);

    assert.equal(existsSync(marker), true, `挂死的隧道必须被重启；日志：${lines.join('')}`);
    server.close();
  });

  it('reports recovery instead of restarting forever', async () => {
    const marker = markerPath('recover');
    markers.push(marker);
    rmSync(marker, { force: true });
    const { server, url } = await startHealthy();
    const lines = startWatchdog(url, marker);
    await wait(900);
    assert.match(lines.join(''), /watching http:\/\/127\.0\.0\.1:\d+\//);
    assert.equal(existsSync(marker), false);
    server.close();
  });
});
