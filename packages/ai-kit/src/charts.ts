/**
 * Chart primitives that carry a drawing library.
 *
 * Kept off the main barrel so importing `@kube-ai-hub/ai-kit` does not pull
 * recharts (and its React 18 resolution edge) into pages that never draw a
 * chart. Hosts import this subpath explicitly.
 */
export { DonutChart } from './primitives/DonutChart';
export type { DonutChartProps, DonutSegment } from './primitives/DonutChart';
