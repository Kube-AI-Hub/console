/**
 * Editor entry for `@kube-ai-hub/ui`.
 *
 * Exists as a subpath because `index.ts` is the barrel every page imports, and
 * anything reachable from it is in the first load. `YamlEditor` brings
 * CodeMirror (188 KB gzip), which only a dialog needs — so it sits behind
 * `@kube-ai-hub/ui/editor` and is imported from the lazily-loaded dialog chunk.
 *
 * Everything else must keep coming from the package root; adding to this file
 * silently moves that module out of the always-loaded bundle.
 */
export { YamlEditor } from '@kube-ai-hub/ai-kit';
export type { YamlEditorProps } from '@kube-ai-hub/ai-kit';
