import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { ChartPanel } from '../src/charts/ChartPanel';
import type { ChartPanelLabels } from '../src/charts/ChartPanel';
import { presetRange, type TimeRange } from '../src/charts/timeRange';

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

const SERIES = [
  { key: 'gpu0', label: 'GPU-0 · 33210130', points: curve(0) },
  { key: 'gpu1', label: 'GPU-1 · 12013010', points: curve(6) },
  { key: 'gpu2', label: 'GPU-2 · 20213010', points: curve(-8) },
];

const LABELS: ChartPanelLabels = {
  placeholder: '选择时间范围',
  presets: '选择时间范围',
  custom: '自定义时间范围',
  rangePlaceholder: '选择起止时间',
  step: '采样间隔',
  stepHint: '采样间隔将根据所选时间范围自动调整，避免数据点过多导致查询超时或无数据。',
  stepOptions: [
    { value: '15s', label: '15 秒' },
    { value: '60s', label: '1 分钟' },
    { value: '5m', label: '5 分钟' },
    { value: '15m', label: '15 分钟' },
    { value: '1h', label: '1 小时' },
  ],
  cancel: '取消',
  confirm: '确定',
  invalid: '结束时间必须晚于开始时间。',
  refresh: '刷新',
  error: '读取监控数据失败。',
  retry: '重试',
  loading: '正在读取监控数据…',
  autoPause: '暂停',
  autoResume: '继续',
  autoPauseLabel: '暂停自动刷新（每 5 秒）',
  autoResumeLabel: '继续自动刷新（每 5 秒）',
};

const meta: Meta<typeof ChartPanel> = {
  title: 'Charts/ChartPanel',
  component: ChartPanel,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof ChartPanel>;

function PanelDemo({ state = 'ready' as const, single = false }: { state?: 'loading' | 'refreshing' | 'ready' | 'error' | 'empty'; single?: boolean }) {
  const [range, setRange] = React.useState<TimeRange>(presetRange('1h'));
  const [auto, setAuto] = React.useState(true);
  return (
    <ChartPanel
      aiId="story:gpu"
      title="GPU 利用率"
      description="所选时间范围内每张卡的平均利用率。"
      series={single ? [SERIES[0]!] : SERIES}
      range={range}
      onRangeChange={setRange}
      labels={LABELS}
      state={state}
      onRetry={() => undefined}
      onRefresh={() => undefined}
      autoRefresh={{ value: auto, onChange: setAuto }}
      yDomain={[0, 100]}
      formatAxis={(value) => `${Math.round(value)}%`}
      formatValue={(value) => `${value.toFixed(1)}%`}
      formatTime={(at) => new Date(at).toLocaleTimeString()}
    />
  );
}

/** The ready state: window picker, refresh, auto-refresh and a toggleable legend. */
export const PanelReady: Story = { render: () => <PanelDemo /> };

/**
 * One series fills and smooths by default: a lone curve is easier to read as an
 * area, while several filled curves would stack into mud.
 */
export const PanelSingleArea: Story = { render: () => <PanelDemo single /> };

/** Bars for a count per bucket rather than a continuous rate. */
export const PanelBars: Story = {
  render: () => {
    const [range, setRange] = React.useState<TimeRange>(presetRange('1h'));
    return (
      <ChartPanel
        aiId="story:pods"
        title="容器组数"
        series={[{ key: 'pods', label: '容器组', points: curve(0, 0.4) }]}
        range={range}
        onRangeChange={setRange}
        labels={LABELS}
        state="ready"
        chartType="bar"
        yDomain={[0, 80]}
        formatValue={(value) => String(Math.round(value))}
        formatTime={(at) => new Date(at).toLocaleTimeString()}
      />
    );
  },
};

/** A refresh keeps the plot: it dims and the new points animate in. No flicker. */
export const PanelRefreshing: Story = { render: () => <PanelDemo state="refreshing" /> };

/** The first load: a placeholder that keeps the height, so nothing jumps. */
export const PanelLoading: Story = { render: () => <PanelDemo state="loading" /> };

/** A failed read keeps the window controls usable and offers a retry. */
export const PanelError: Story = { render: () => <PanelDemo state="error" /> };
