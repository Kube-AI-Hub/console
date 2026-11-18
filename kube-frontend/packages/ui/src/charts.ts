/**
 * Chart primitives that carry a drawing library.
 *
 * Kept out of the main barrel on purpose. `DonutChart` pulls recharts, whose
 * `react` resolves from ai-kit's own install (React 18); re-exporting it from
 * the barrel would put both the bundle weight and that second-React edge into
 * every page and every test that imports a Button. Feature code imports this
 * subpath; the app aliases it the way it aliases `ui/editor`.
 */
export { DonutChart } from '@kube-ai-hub/ai-kit/charts';
export type { DonutChartProps, DonutSegment } from '@kube-ai-hub/ai-kit/charts';
