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
      /*
       * Subpath into the ui package, for modules its barrel must not re-export.
       *
       * The barrel is imported by every page, so anything re-exported from it is
       * in every first load; `YamlEditor` (CodeMirror, 188 KB gzip) is the one
       * that matter. Dialogs import it through this subpath, which lives inside
       * their lazily-loaded chunk.
       */
      {
        find: /^@kube-ai-hub\/ui\/editor$/,
        replacement: fileURLToPath(new URL('../../packages/ui/src/editor.ts', import.meta.url)),
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
      /*
       * The BFF is a separate process; proxying keeps the app same-origin in
       * development so cookies and relative `/api` paths behave as in production.
       *
       * Every prefix the BFF forwards needs an entry of its own — Vite matches
       * proxy keys by URL prefix and has no `changeOrigin`-style wildcard. With
       * only `/api` listed, `/kapis/...` fell through to the SPA fallback and every
       * resource page rendered "资源不存在" from an HTML body (observed; it looks
       * like a product bug rather than a missing proxy rule). `server/src/index.ts`
       * forwards `/api/`, `/kapis/` and `/apis/`, and `scripts/dev-static-server.mjs`
       * proxies the same three.
       */
      '/api': { target: process.env['BFF_URL'] ?? 'http://127.0.0.1:8091', changeOrigin: true },
      '/kapis': { target: process.env['BFF_URL'] ?? 'http://127.0.0.1:8091', changeOrigin: true },
      '/apis': { target: process.env['BFF_URL'] ?? 'http://127.0.0.1:8091', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        /*
         * Split by product area, not by page (DEC-CORE-KUBE_FRONTEND-04).
         *
         * Every resource page in the workbench shares the same Radix primitives
         * and ai-kit components. Left to Rollup's default, all of that lands in
         * one `index-*` chunk — 150.8 KB gzip in the configmaps-era build — and
         * any dependency change invalidates the whole block.
         *
         * `manualChunks` as a function rather than an object map: the rules are
         * ordered, and the first match must win. An object map would let Rollup
         * pick whichever entry it visits first.
         *
         * Groups are keyed by module path, so the same package always resolves
         * to the same chunk no matter which area imports it first. A chunk name
         * that moves between builds defeats the purpose of caching it.
         */
        manualChunks(id: string): string | undefined {
          const RULES: ReadonlyArray<readonly [RegExp, string]> = [
            /*
             * The YAML editor's engine: CodeMirror and its parsers. Also the
             * heaviest single dependency in the app (188 KB gzip). A list page
             * never imports it, so it must not share a chunk with anything a
             * list page needs; it is required to sit before the generic
             * third-party rule.
             *
             * `yaml` / `js-yaml` are deliberately NOT here: the list page imports
             * `toYaml` from `components/resource/yaml.ts`, and grouping the
             * serializer made that page chunk statically depend on this one.
             * Left ungrouped, Rollup keeps the serializer with its importer.
             */
            [
              /node_modules[\\/](@codemirror|@lezer|codemirror|@uiw)[\\/]/,
              'vendor-yaml-editor',
            ],
            /*
             * React and its renderer: effectively frozen, shared by every area.
             * Kept apart so an ai-kit change never invalidates it.
             */
            [/node_modules[\\/](react|react-dom|scheduler)[\\/]/, 'vendor-react'],
            /* Router and query: shared, changes on upgrade only. */
            [/node_modules[\\/]@tanstack[\\/]/, 'vendor-tanstack'],
            /*
             * Radix primitives, shared by every area that renders a form, menu or
             * dialog. Grouped because they are released in lockstep and upgraded
             * together.
             */
            [/node_modules[\\/]@radix-ui[\\/]/, 'vendor-radix'],
            /* Other third-party code (clsx, tailwind-merge, lucide, …). */
            [/node_modules[\\/]/, 'vendor-misc'],
            /*
             * The YAML editor pulls CodeMirror. A list page must not download it,
             * so it stays in its own chunk even though every area's dialogs
             * import it.
             */
            [/packages[\\/]ai-kit[\\/]src[\\/]editor[\\/]/, 'ai-kit-editor'],
            /*
             * ai-kit's list/detail form schema layer, plus our own shared
             * packages and app-level components: what every area needs before it
             * can paint a resource.
             *
             * Deliberately does NOT cover `src/pages/` or the lazily-loaded
             * editor dialog. A page's private dialogs must stay in that page's
             * chunk, and `YamlDialog` is only ever reached through
             * `React.lazy` — grouping it here would force its chunk, and
             * CodeMirror with it, into the first load.
             */
            /*
             * The `yaml` serializer helper must not be grouped here either: it
             * lives under `components/resource/` for the dialog's sake but is
             * imported by list pages, and the `yaml` package drags its parser
             * along. Leaving it ungrouped lets Rollup place it in the importing
             * page's chunk.
             */
            [
              /(packages[\\/]ai-kit[\\/]src[\\/]schema[\\/]|kube-frontend[\\/]packages[\\/]|apps[\\/]console-next[\\/]src[\\/]shell[\\/]|apps[\\/]console-next[\\/]src[\\/]components[\\/](?!resource[\\/](YamlDialog|yaml)))/,
              'app-shared',
            ],
            /*
             * ai-kit, split by how often each part changes rather than kept as
             * one block.
             *
             * The primitives are edited most days; the theme and utility layers
             * almost never. As one 124 KB chunk, every primitives tweak
             * invalidated all of it — measured: a one-word change in
             * `Button.tsx` replaced every ai-kit chunk and the shell around it.
             * Split this way a primitives change leaves theme/utils cacheable.
             */
            [/packages[\\/]ai-kit[\\/]src[\\/](theme|utils|motion|styles)[\\/]/, 'ai-kit-core'],
            [/packages[\\/]ai-kit[\\/]src[\\/]/, 'ai-kit'],
          ];
          for (const [pattern, name] of RULES) if (pattern.test(id)) return name;
          return undefined;
        },
      },
    },
  },
});
