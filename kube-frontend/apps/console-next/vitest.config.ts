import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';



export default defineConfig({
  plugins: [react()],
  resolve: {
    /*
     * Point ai-kit at its **source**, not its prebuilt `dist`.
     *
     * The package keeps its own pnpm install (React 18) for Storybook. Consuming
     * `dist` therefore loads ai-kit's components against that second React, and
     * every hook inside them throws "Invalid hook call" — while the build still
     * succeeds. Compiling from source here means the whole graph is resolved by
     * this app's Vite, so there is exactly one React.
     */
    alias: [
      { find: /^@\//, replacement: fileURLToPath(new URL('./src/', import.meta.url)) },
      // Every Radix primitive resolves from this workspace's root copy. The linked
      // ai-kit keeps its own `node_modules/@radix-ui` bound to React 18; letting
      // its source reach that copy is what produced two React instances.
      {
        find: /^@radix-ui\/(.*)$/,
        replacement: fileURLToPath(new URL('../../node_modules/@radix-ui/$1', import.meta.url)),
      },
      {
        find: /^@kube-ai-hub\/ui$/,
        replacement: fileURLToPath(new URL('../../packages/ui/src/index.ts', import.meta.url)),
      },
      {
        find: /^@kube-ai-hub\/ui\/styles\.css$/,
        replacement: fileURLToPath(new URL('../../packages/ui/src/styles.css', import.meta.url)),
      },
      {
        find: /^@kube-ai-hub\/ai-surface$/,
        replacement: fileURLToPath(new URL('../../packages/ai-surface/src/index.ts', import.meta.url)),
      },
      {
        find: /^@kube-ai-hub\/api-client$/,
        replacement: fileURLToPath(new URL('../../packages/api-client/src/index.ts', import.meta.url)),
      },
      {
        find: /^@kube-ai-hub\/locales$/,
        replacement: fileURLToPath(new URL('../../packages/locales/src/index.ts', import.meta.url)),
      },
      {
        find: /^@kube-ai-hub\/ai-kit\/styles\.css$/,
        replacement: fileURLToPath(new URL('../../../packages/ai-kit/src/styles/tokens.css', import.meta.url)),
      },
      {
        find: /^@kube-ai-hub\/ai-kit\/tailwind\.preset$/,
        replacement: fileURLToPath(new URL('../../../packages/ai-kit/src/tailwind.preset.ts', import.meta.url)),
      },
      {
        find: /^@kube-ai-hub\/ai-kit$/,
        replacement: fileURLToPath(new URL('../../../packages/ai-kit/src/index.ts', import.meta.url)),
      },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
    server: {
      deps: {
        // Route the linked packages through Vite instead of Node's resolver, so
        // the React alias above applies to them too. As an external, ai-kit would
        // load from its own `node_modules` and pick up the second React.
        inline: [/@kube-ai-hub\//],
      },
    },
  },
});
