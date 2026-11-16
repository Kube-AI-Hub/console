#!/usr/bin/env node
/**
 * Bundle the BFF into one file for the container image.
 *
 * `tsx` runs the TypeScript sources directly, which is right for development but
 * would mean shipping `node_modules` (tsx, esbuild, TypeScript) in a runtime image
 * that only needs `node:http`. Bundling leaves a single JS file plus the built SPA
 * — and, unlike `tsc`, it keeps the `node:` builtins external and the ESM shape
 * intact without a second tsconfig.
 *
 * Usage: node scripts/build.mjs   (writes `server/dist/server.js`)
 */
import { build } from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(here, '..');

await build({
  entryPoints: [resolve(serverDir, 'src/dev.ts')],
  outfile: resolve(serverDir, 'dist/server.js'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  /*
   * ESM output plus `node:` builtins: without this marker Node treats the file as
   * CommonJS (the package has no `"type": "module"` in the image) and `import`
   * statements fail at load.
   */
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  sourcemap: true,
  minify: false,
  logLevel: 'info',
});
