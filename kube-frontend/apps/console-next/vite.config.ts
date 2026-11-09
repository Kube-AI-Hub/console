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
    // `@/` mirrors the tsconfig path so imports read the same in both tools.
    alias: { '@': new URL('./src', import.meta.url).pathname },
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
