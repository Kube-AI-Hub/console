/**
 * One label/value pair in a detail page's definition list.
 *
 * The implementation now lives in ai-kit as `DescriptionItem`: the 24 call sites in this
 * app and the design-system's own consumers share one behaviour — the same value colour
 * and wrapping rule, and the `data-ai-id` on the value itself rather than on the `<dd>`
 * (so a row's hint is never included in the text an agent reads).
 *
 * This module stays as the app-local name the pages already import; it no longer carries
 * a second copy of the component.
 */
export { DescriptionItem as DefinitionRow } from '@kube-ai-hub/ui';
export type { DescriptionItemProps as DefinitionRowProps } from '@kube-ai-hub/ui';
