import type { Meta, StoryObj } from '@storybook/react';
import { TimeSeriesChart } from '../src/charts/TimeSeriesChart';
import type { TimeSeries } from '../src/charts/TimeSeriesChart';

const NOW = 1_763_000_000_000;
const MINUTE = 60_000;

/** A believable curve: a slow rise, a spike, a dip, with one scrape hole. */
function curve(offset: number, scale = 1, holeAt?: number): Array<{ at: number; value: number }> {
  const points: Array<{ at: number; value: number }> = [];
  for (let index = 0; index < 60; index += 1) {
    const at = NOW - 60 * MINUTE + index * MINUTE;
    if (holeAt !== undefined && index >= holeAt && index < holeAt + 6) continue;
    const wave = Math.sin(index / 6) * 12 + Math.cos(index / 3) * 4;
    const spike = index > 34 && index < 40 ? 22 : 0;
    points.push({ at, value: Math.max(0, Math.round((40 + offset + wave + spike) * scale * 10) / 10) });
  }
  return points;
}

const SERIES: TimeSeries[] = [
  { key: 'gpu0', label: 'GPU-0 · 33210130', points: curve(0) },
  { key: 'gpu1', label: 'GPU-1 · 12013010', points: curve(6) },
  { key: 'gpu2', label: 'GPU-2 · 20213010', points: curve(-8) },
];



const meta: Meta<typeof TimeSeriesChart> = {
  title: 'Charts/TimeSeriesChart',
  component: TimeSeriesChart,
  tags: ['autodocs'],
  args: {
    start: NOW - 60 * MINUTE,
    end: NOW,
    label: 'GPU 利用率',
    emptyText: '该时间范围内没有采样',
    height: 220,
  },
};
export default meta;
type Story = StoryObj<typeof TimeSeriesChart>;

/** Three cards, one instant each — the shape a monitoring panel reads best. */
export const MultipleSeries: Story = { args: { series: SERIES } };

/** A single filled line: what makes a lone trend legible at a glance. */
export const SingleArea: Story = {
  args: { series: [{ ...SERIES[0]!, area: true }], yDomain: [0, 100], formatAxis: (value) => `${Math.round(value)}%` },
};

/**
 * A smooth filled curve — the default shape `ChartPanel` uses for a single series.
 *
 * `monotone` interpolation, not a spline: it never overshoots past the samples, so a
 * spike cannot be drawn taller than it was and a floor cannot dip below zero.
 */
export const SmoothArea: Story = {
  args: {
    series: [{ ...SERIES[0]!, area: true, smooth: true }],
    yDomain: [0, 100],
    formatAxis: (value) => `${Math.round(value)}%`,
  },
};

/** The same data as straight segments, for comparison: the smoothing is a choice. */
export const SharpArea: Story = {
  args: {
    series: [{ ...SERIES[0]!, area: true, smooth: false }],
    yDomain: [0, 100],
    formatAxis: (value) => `${Math.round(value)}%`,
  },
};

/** Bars for a count per bucket rather than a continuous rate. */
export const Bars: Story = {
  args: {
    series: [{ key: 'pods', label: '容器组', points: curve(0, 0.5), type: 'bar' }],
    yDomain: [0, 80],
  },
};

/** Lines and bars on one axis: a rate with its event count behind it. */
export const Mixed: Story = {
  args: {
    series: [
      { key: 'pods', label: '容器组数', points: curve(0, 0.4), type: 'bar', barSize: 6 },
      { ...SERIES[0]!, area: true },
    ],
    yDomain: [0, 100],
  },
};

/** A scrape hole is a break, never a straight line across the missing period. */
export const ScrapeHole: Story = {
  args: { series: [{ ...SERIES[0]!, points: curve(0, 1, 20) }], maxGap: 3 * MINUTE },
};

/** One series switched off by the legend: the line goes, the legend entry stays. */
export const LegendToggled: Story = {
  args: {
    series: [{ ...SERIES[0]! }, { ...SERIES[1]!, hidden: true }],
  },
};

/** Nothing to draw is an explanation, not a flat line at zero. */
export const Empty: Story = { args: { series: [{ key: 'gpu0', label: 'GPU-0', points: [] }] } };
