import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Package test config.
 *
 * `jsdom` because these components render DOM and are asserted through roles and
 * attributes — the same surface an agent uses.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
