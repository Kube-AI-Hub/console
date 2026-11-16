/**
 * Self-checks for the retrying tunnel proxy (no cluster, no browser).
 *
 * The behaviour worth proving is the one the proxy exists for: a client that connects while the
 * upstream is down must still get through once the upstream returns, instead of being refused.
 *
 * Run with `node --test tools/tunnel-proxy.test.mjs` (Node's own runner: this directory has no
 * bundler, and the proxy is plain Node).
 */
import { spawn } from 'node:child_process';
import net from 'node:net';
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

const children = [];

after(() => {
  for (const child of children.splice(0)) child.kill('SIGKILL');
});

function startEcho(port) {
  const server = net.createServer((socket) => {
    socket.on('data', (chunk) => socket.write(chunk));
    socket.on('error', () => socket.destroy());
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

function startProxy(listen, upstream, budget = 8000) {
  const child = spawn(
    process.execPath,
    ['tools/tunnel-proxy.mjs', '--listen', String(listen), '--upstream', String(upstream), '--budget', String(budget), '--retry', '100'],
    { cwd: new URL('..', import.meta.url).pathname, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  children.push(child);
  return new Promise((resolve) => {
    child.stdout.on('data', (chunk) => {
      if (String(chunk).includes('tunnel-proxy:')) resolve(child);
    });
  });
}

/** Send one line through `port` and return what comes back. */
function roundTrip(port, payload, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('round trip timed out'));
    }, timeoutMs);
    socket.once('connect', () => socket.write(payload));
    socket.once('data', (chunk) => {
      clearTimeout(timer);
      socket.destroy();
      resolve(String(chunk));
    });
    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('tunnel proxy', () => {
  it('forwards traffic while the upstream is up', async () => {
    const upstream = await startEcho(19101);
    await startProxy(19100, 19101);
    assert.equal(await roundTrip(19100, 'ping'), 'ping');
    upstream.close();
  });

  it('holds a client connection open while the upstream is briefly gone', async () => {
    const upstream = await startEcho(19111);
    await startProxy(19110, 19111);
    assert.equal(await roundTrip(19110, 'before'), 'before');

    // Simulate the tunnel dropping: nothing listens on the upstream port for a moment.
    upstream.close();
    await wait(150);
    const pending = roundTrip(19110, 'during', 8000);
    await wait(600);
    const revived = await startEcho(19111);

    // The client that connected during the gap still gets an answer once the upstream returns.
    assert.equal(await pending, 'during');
    revived.close();
  });

  /*
   * A proxy that corrupts large responses is worse than no proxy: it turns "the tunnel is flaky"
   * into "the API returns broken JSON". This checks a multi-megabyte body arrives intact.
   *
   * Honest limitation: reintroducing the `upstream.on('close', () => client.destroy())` handler
   * this proxy used to have does NOT make this test fail -- Node finishes flushing before 'close',
   * so that handler was not proven to be the truncation cause. It was removed because destroying
   * the peer on close is wrong in principle, not because this test proved it.
   */
  it('does not truncate a large response', async () => {
    const payload = 'x'.repeat(4 * 1024 * 1024);
    const upstream = net.createServer((socket) => {
      socket.end(payload);
    });
    await new Promise((resolve) => upstream.listen(19131, '127.0.0.1', resolve));
    await startProxy(19130, 19131);

    const received = await new Promise((resolve, reject) => {
      const chunks = [];
      const socket = net.connect({ port: 19130, host: '127.0.0.1' });
      // Read slowly on purpose: a fast reader drains the kernel buffer, so nothing is ever pending
      // in the proxy and a `destroy()` on close would go unnoticed. Backpressure is what makes the
      // truncation observable, and a real browser is a slow reader too.
      socket.on('data', (chunk) => {
        chunks.push(chunk);
        socket.pause();
        setTimeout(() => socket.resume(), 2);
      });
      socket.on('end', () => resolve(Buffer.concat(chunks).length));
      socket.on('error', reject);
      setTimeout(() => {
        socket.destroy();
        reject(new Error('large response timed out'));
      }, 15000);
    });

    assert.equal(received, payload.length, '大响应体被截断了');
    upstream.close();
  });

  it('gives up only when the upstream never returns', async () => {
    await startProxy(19120, 19121, 700);
    await assert.rejects(() => roundTrip(19120, 'nobody-home', 4000));
  });
});
