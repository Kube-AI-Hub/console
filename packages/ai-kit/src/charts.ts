/**
 * Chart primitives that carry a drawing library.
 *
 * Kept off the main barrel so importing `@kube-ai-hub/ai-kit` does not pull
 * recharts (and its React 18 resolution edge) into pages that never draw a
 * chart. Hosts import this subpath explicitly.
 */
export { DonutChart } from './primitives/DonutChart';
export type { DonutChartProps, DonutSegment } from './primitives/DonutChart';

export { TimeSeriesChart, pivotSeries } from './charts/TimeSeriesChart';
export type { TimeSeries, TimeSeriesChartProps, SeriesPoint } from './charts/TimeSeriesChart';

export { PieChart, progressSlices } from './charts/PieChart';
export type { PieChartProps, PieSlice } from './charts/PieChart';

export { ProgressRing } from './charts/ProgressRing';
export type { ProgressRingProps, ProgressRingLabels } from './charts/ProgressRing';

export { ChartPanel } from './charts/ChartPanel';
export type { ChartPanelProps, ChartPanelLabels } from './charts/ChartPanel';

export { TimeRangePicker, rangePresets } from './charts/TimeRangePicker';
export type { TimeRangePickerProps, TimeRangePickerLabels } from './charts/TimeRangePicker';

export {
  RANGE_PRESET_KEYS,
  RANGE_PRESET_MS,
  describeRange,
  formatRangeEdge,
  formatRangeValue,
  gapForStep,
  parseRangeEdge,
  parseRangeValue,
  presetKeyOf,
  presetRange,
  resolveRange,
  sameRange,
  stepForSpan,
  stepToMs,
} from './charts/timeRange';
export type {
  AbsoluteRange,
  RangePreset,
  RelativeRange,
  ResolvedRange,
  TimeRange,
} from './charts/timeRange';

export { CHART_TOKENS, FALLBACK_CHART_COLORS, resolveTokenValue, useChartPalette } from './charts/useChartPalette';
