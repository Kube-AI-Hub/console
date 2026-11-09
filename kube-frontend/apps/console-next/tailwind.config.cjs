/**
 * Tailwind configuration for the app.
 *
 * All design tokens come from ai-kit's preset; nothing is redefined here.
 * The file exists only so Tailwind 4 can load that preset, which is what makes
 * the library's utility classes (`rounded-ai-md`, `bg-ai-surface-1`, …) resolve
 * in this app.
 */
module.exports = {
  // Scan the app plus the workspace packages, whose source is compiled here.
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../../packages/*/src/**/*.{ts,tsx}',
    '../../../packages/ai-kit/src/**/*.{ts,tsx}',
  ],
  // The package export map is ESM-only, so a CommonJS config cannot require it
  // by name. The built file is loaded directly instead.
  presets: [require('../../../packages/ai-kit/dist/tailwind.preset.js').default],
};
