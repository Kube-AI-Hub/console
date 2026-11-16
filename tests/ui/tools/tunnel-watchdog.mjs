/**
 * Watchdog for the tunnel: restart ssh when the forward hangs.
 *
 * The failure this exists for is not "ssh exited" -- the reconnect loop already handles that in a
 * second. It is "ssh is still listening but the forward is dead": connections are accepted and then
 * never answered. Measured on 2026-11-16: `curl` through the tunnel returned 000 after 8s while the
 * ssh process was alive and `ssh sgb000 'echo ok'` still worked. Killing that process and letting the
 * loop restart it restored the tunnel in under 4 seconds.
 *
 * So: probe through the tunnel on a timer, and after N consecutive failures run the restart command.
 *
 * Usage:
 *
 *     node tools/tunnel-watchdog.mjs --url http://127.0.0.1:18088/ \
 *         --restart 'pkill -f "ssh -N -L 18089"'
 */
import { execSync } from 'node:child_process';

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
}

const URL_TO_PROBE = arg('url', 'http://127.0.0.1:18088/');
const INTERVAL_MS = Number(arg('interval', 20000));
const TIMEOUT_MS = Number(arg('timeout', 8000));
const STRIKES = Number(arg('strikes', 2));
const RESTART_CMD = arg('restart', '');

/** One probe. Any answer -- even a 404 -- proves the forward is alive. */
/** One probe. Any answer -- even a 404 -- proves the forward is alive. */
/** One probe. Any answer -- even a 404 -- proves the forward is alive. */
async function probe() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    await fetch(URL_TO_PROBE, { signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

let strikes = 0;
let restarts = 0;

function log(message) {
  process.stdout.write(`tunnel-watchdog: ${message}\n`);
}

async function tick() {
  if (await probe()) {
    if (strikes > 0) log(`recovered after ${strikes} failed probe(s)`);
    strikes = 0;
    return;
  }
  strikes += 1;
  log(`probe failed (${strikes}/${STRIKES})`);
  if (strikes < STRIKES) return;
  if (!RESTART_CMD) {
    log('no --restart command configured; not restarting');
    strikes = 0;
    return;
  }
  try {
    execSync(RESTART_CMD, { stdio: 'ignore' });
    restarts += 1;
    log(`ran restart command (${restarts} total)`);
  } catch (error) {
    log(`restart command failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  strikes = 0;
}

log(`watching ${URL_TO_PROBE} every ${INTERVAL_MS}ms, ${STRIKES} strikes before restart`);
setInterval(() => { void tick(); }, INTERVAL_MS);
