import aiKitPreset from '@kube-ai-hub/ai-kit/tailwind.preset';

/**
 * Tailwind preset for the app.
 *
 * ai-kit already defines the semantic tokens; this only adds the breakpoint
 * helpers the shell needs. Re-declaring colours here would give the app a
 * second palette that drifts from the components.
 */
const preset = aiKitPreset;

export default preset;
