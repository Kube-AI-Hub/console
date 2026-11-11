import { stringify as stringifyYaml } from 'yaml';

/**
 * Object → YAML, for the dialog's initial document.
 *
 * Lives apart from `YamlDialog.tsx` on purpose: the list page imports `toYaml`
 * to build a template, and importing it from the dialog module pulled the whole
 * editor — CodeMirror included, 188 KB gzip — into every list page's first load.
 * This file only imports the serializer, so the editor can stay in the dialog's
 * lazily-loaded chunk.
 *
 * `lineWidth: 0` disables folding so a long base64 value is one line and a diff
 * is readable. `noRefs` is not settable through this signature but the objects
 * this app builds are freshly allocated each time, so aliases cannot appear.
 */
export function toYaml(object: unknown): string {
  return stringifyYaml(object, { lineWidth: 0 } as Parameters<typeof stringifyYaml>[1]);
}
