import { defineConfig } from 'vitest/config';

/**
 * Architecture-constraint test config.
 *
 * Separate from any package's config because these tests read the repository
 * itself — package manifests and source text — not runtime behaviour. They need
 * no DOM, so they run in the node environment and finish in milliseconds.
 */
export default defineConfig({
  test: {
    include: ['config/**/*.test.ts'],
    environment: 'node',
    // One worker: the tests read files and some assert on ordering of findings.
    maxWorkers: 1,
    minWorkers: 1,
  },
});
