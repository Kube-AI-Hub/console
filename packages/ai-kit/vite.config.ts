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
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'index.js',
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
