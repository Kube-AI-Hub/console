import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

/**
 * Build config.
 *
 * Deliberately a plain SPA: dongba runs SSR through Cloudflare and nitro, which
 * conflicts with the node:22-alpine image the platform deploys. The console has
 * no SEO requirement, so the SSR layer is dropped and only the router plugin is
 * kept for file-based routes.
 *
 * The router plugin must run before React: it generates `routeTree.gen.ts`,
 * which the app imports, so React's transform would otherwise see a file that
 * does not exist on a clean checkout.
 */


export default defineConfig({
  plugins: [TanStackRouterVite({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
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
  server: {
    port: 5174,
    proxy: {
      // The BFF is a separate process; proxying keeps the app same-origin in
      // development so cookies and relative `/api` paths behave as in production.
      '/api': { target: process.env['BFF_URL'] ?? 'http://127.0.0.1:8091', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
