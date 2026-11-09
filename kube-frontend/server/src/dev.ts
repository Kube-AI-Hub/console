import { loadConfig } from './config';
import { loadManifest, startServer } from './index';

/**
 * Development entry point.
 *
 * Reads configuration from the environment and prints what it resolved, because
 * a BFF pointed at the wrong upstream fails as an empty list rather than an
 * error, which is the least diagnosable outcome.
 */
const port = Number(process.env['BFF_PORT'] ?? '8080');
const config = loadConfig();

async function main(): Promise<void> {
  const server = await startServer(port, { config, manifest: loadManifest });
  console.log(`[bff] listening on http://127.0.0.1:${port}`);
  console.log(`[bff] upstream   ${config.baseUrl}${config.apiPrefix}`);

  const shutdown = (signal: string): void => {
    console.log(`[bff] ${signal} received, closing`);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

void main();
