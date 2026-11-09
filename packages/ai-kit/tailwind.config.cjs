/**
 * Storybook-only Tailwind config.
 *
 * The library ships pre-compiled CSS, but stories need the utilities generated
 * from the preset so components look the same as they will in a consumer app.
 *
 * Two details matter here:
 *   - `.cjs` because Tailwind loads its config through a CommonJS require.
 *   - `require(...).default` because `src/tailwind.preset.ts` is an ES module;
 *     requiring it yields `{ __esModule, default }`, and passing that wrapper
 *     straight to Tailwind produces an empty preset with no error.
 */
const presetModule = require('./src/tailwind.preset.ts');
const aiKitPreset = presetModule.default ?? presetModule;

module.exports = {
  presets: [aiKitPreset],
  content: ['./src/**/*.{ts,tsx}', './stories/**/*.{ts,tsx}', './.storybook/**/*.{ts,tsx}'],
};
