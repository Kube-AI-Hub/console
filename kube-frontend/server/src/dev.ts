import { loadConfig } from './config';
import { loadDocs } from './docs';
import { loadManifest, startServer } from './index';

/**
 * Development entry point.
 *
 * Reads configuration from the environment and prints what it resolved, because
 * a BFF pointed at the wrong upstream fails as an empty list rather than an
 * error, which is the least diagnosable outcome.
 *
 * `STATIC_DIR` is set in the deployed image (the container ships the built SPA);
 * locally it is usually unset, and `scripts/dev-static-server.mjs` serves the
 * build in front of this process instead.
 */
const port = Number(process.env['BFF_PORT'] ?? '8080');
const config = loadConfig();
const staticDir = process.env['STATIC_DIR'];

async function main(): Promise<void> {
  const server = await startServer(port, {
    config,
    manifest: loadManifest,
    docs: loadDocs(process.env),
    ...(staticDir === undefined || staticDir === '' ? {} : { staticDir }),
  });
  console.log(`[bff] listening on http://127.0.0.1:${port}`);
  console.log(`[bff] upstream   ${config.baseUrl}${config.apiPrefix}`);
  console.log(`[bff] static     ${staticDir === undefined || staticDir === '' ? '(not served here)' : staticDir}`);

  const shutdown = (signal: string): void => {
    console.log(`[bff] ${signal} received, closing`);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

void main();
