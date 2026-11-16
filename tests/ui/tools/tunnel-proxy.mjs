/**
 * A retrying TCP proxy in front of the SSH tunnel.
 *
 * The tunnel to the B200 cluster drops every few minutes. `ssh -L` reconnects in about a second,
 * but during that second nothing is listening on the local port, so every connection attempt in
 * that window is refused -- and the BFF surfaces it as
 *
 *     502 upstream_unreachable  connect ECONNREFUSED 127.0.0.1:18088
 *
 * which is what turns a one-second tunnel gap into a failed UI test that looks like a product bug.
 *
 * This proxy keeps the listening socket alive permanently and moves the reconnect problem inside:
 * when the upstream is momentarily gone it retries with a short backoff instead of refusing the
 * client. A gap of a second or two becomes a slightly slow request rather than an error.
 *
 * Usage:
 *
 *     node tools/tunnel-proxy.mjs --listen 18088 --upstream 18089
 *
 * and point the ssh loop at 18089.
 */
import net from 'node:net';

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? Number(process.argv[index + 1]) : fallback;
}

const LISTEN_PORT = arg('listen', 18088);
const UPSTREAM_PORT = arg('upstream', 18089);
const UPSTREAM_HOST = '127.0.0.1';
/** How long a client connection may wait for the upstream before we give up on it. */
const CONNECT_BUDGET_MS = arg('budget', 20000);
const RETRY_DELAY_MS = arg('retry', 250);

let retries = 0;
let refusals = 0;

/**
 * Connect upstream, retrying until the budget runs out.
 *
 * The retry loop is the whole point: a refused connection here means "the tunnel is between
 * reconnects", not "the request is invalid".
 */
function connectUpstream(deadline) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect({ port: UPSTREAM_PORT, host: UPSTREAM_HOST });
      socket.once('connect', () => resolve(socket));
      socket.once('error', (error) => {
        socket.destroy();
        if (Date.now() >= deadline) {
          reject(error);
          return;
        }
        retries += 1;
        setTimeout(attempt, RETRY_DELAY_MS);
      });
    };
    attempt();
  });
}

const server = net.createServer((client) => {
  client.on('error', () => client.destroy());
  const deadline = Date.now() + CONNECT_BUDGET_MS;
  connectUpstream(deadline).then(
    (upstream) => {
      upstream.on('error', () => {
        client.destroy();
        upstream.destroy();
      });
      /*
       * Plain piping, and nothing that destroys the peer on 'close'.
       *
       * Destroying the client when the upstream closes looks harmless and truncates responses: the
       * upstream's FIN means "I am done sending", not "discard what you have not written yet", and
       * `destroy()` drops whatever is still buffered. With that handler a 153KB JSON body arrived
       * cut in half; without it the same request completes.
       */
      client.pipe(upstream);
      upstream.pipe(client);
    },
    () => {
      // The tunnel stayed down for the whole budget: this one really is a failure.
      refusals += 1;
      client.destroy();
    },
  );
});

server.listen(LISTEN_PORT, '127.0.0.1', () => {
  process.stdout.write(`tunnel-proxy: 127.0.0.1:${LISTEN_PORT} -> ${UPSTREAM_HOST}:${UPSTREAM_PORT}\n`);
});

/*
 * Report the counters on SIGUSR2 so a run can say how much of its traffic rode through a gap.
 * Silence by default: a proxy that logs every connection is noise in a test log.
 */
process.on('SIGUSR2', () => {
  process.stdout.write(`tunnel-proxy: retries=${retries} refusals=${refusals}\n`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    process.stdout.write(`tunnel-proxy: retries=${retries} refusals=${refusals}\n`);
    server.close(() => process.exit(0));
  });
}
