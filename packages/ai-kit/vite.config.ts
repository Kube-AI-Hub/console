import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'node:path';

/**
 * Library build.
 *
 * React and React DOM stay external: the consumer supplies them, so the bundle
 * must never embed a second copy (two React instances break hooks).
 *
 * Styles are emitted as a single `styles.css` next to the JS. Consumers import
 * it once at the app root; components ship no runtime CSS-in-JS.
 */
export default defineConfig({
  plugins: [
    react(),
    dts({ include: ['src'], rollupTypes: false, insertTypesEntry: true }),
  ],
  build: {
    lib: {
      /*
       * Two entries: the component library and the Tailwind preset.
       *
       * `package.json` already advertises `./tailwind.preset`, but the build only
       * emitted `index.js` — so a consumer that followed the export map resolved
       * nothing, Tailwind never loaded the preset, and every `rounded-ai-*` /
       * `bg-ai-surface-*` class silently did not exist.
       */
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'tailwind.preset': resolve(__dirname, 'src/tailwind.preset.ts'),
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react-dom/client',
        // Radix packages are peer-ish: the consumer's bundler resolves them so
        // a host app can dedupe a single copy across libraries.
        /^@radix-ui\//,
        'class-variance-authority',
        'clsx',
        'tailwind-merge',
      ],
      output: {
        assetFileNames: (asset) =>
          asset.name === 'style.css' ? 'styles.css' : (asset.name ?? 'asset'),
      },
    },
    cssCodeSplit: false,
    sourcemap: true,
    minify: false,
  },
});
