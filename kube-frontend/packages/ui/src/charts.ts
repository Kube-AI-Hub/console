/**
 * Chart primitives that carry a drawing library.
 *
 * Kept out of the main barrel on purpose. `DonutChart` pulls recharts, whose
 * `react` resolves from ai-kit's own install (React 18); re-exporting it from
 * the barrel would put both the bundle weight and that second-React edge into
 * every page and every test that imports a Button. Feature code imports this
 * subpath; the app aliases it the way it aliases `ui/editor`.
 */
export {
  ChartPanel,
  DonutChart,
  PieChart,
  ProgressRing,
  TimeRangePicker,
  TimeSeriesChart,
  pivotSeries,
  seriesColors,
  CHART_TOKENS,
  FALLBACK_CHART_COLORS,
  progressSlices,
  rangePresets,
  // Time-range arithmetic: hosts own the window, so they need the same helpers the
  // controls use — a second copy would drift the day one of them gains a preset.
  RANGE_PRESET_KEYS,
  RANGE_PRESET_MS,
  describeRange,
  formatRangeValue,
  gapForStep,
  parseRangeValue,
  presetKeyOf,
  presetRange,
  resolveRange,
  sameRange,
  stepForSpan,
  stepToMs,
} from '@kube-ai-hub/ai-kit/charts';
export type {
  AbsoluteRange,
  ChartPanelLabels,
  ChartPanelProps,
  DonutChartProps,
  DonutSegment,
  PieChartProps,
  PieSlice,
  ProgressRingLabels,
  ProgressRingProps,
  RangePreset,
  RelativeRange,
  ResolvedRange,
  SeriesPoint,
  TimeRange,
  TimeRangePickerLabels,
  TimeRangePickerProps,
  TimeSeries,
  TimeSeriesChartProps,
} from '@kube-ai-hub/ai-kit/charts';
