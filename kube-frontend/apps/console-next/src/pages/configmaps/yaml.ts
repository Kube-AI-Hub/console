/**
 * Object → YAML for the configmap dialog's initial document.
 *
 * Re-exported from the shared helper so the module path the page imports stays
 * the same, while the serializer lives somewhere that does not pull in the
 * editor.
 */
export { toYaml } from '@/components/resource/yaml';
