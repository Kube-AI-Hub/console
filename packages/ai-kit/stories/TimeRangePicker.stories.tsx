import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { TimeRangePicker, rangePresets } from '../src/charts/TimeRangePicker';
import type { TimeRangePickerLabels } from '../src/charts/TimeRangePicker';
import { presetRange, type TimeRange } from '../src/charts/timeRange';

const LABELS: TimeRangePickerLabels = {
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
};

const PRESET_LABELS: Record<string, string> = {
  '10m': '最近 10 分钟',
  '20m': '最近 20 分钟',
  '30m': '最近 30 分钟',
  '1h': '最近 1 小时',
  '2h': '最近 2 小时',
  '3h': '最近 3 小时',
  '5h': '最近 5 小时',
  '12h': '最近 12 小时',
  '1d': '最近 1 天',
  '2d': '最近 2 天',
  '3d': '最近 3 天',
  '7d': '最近 7 天',
};

const meta: Meta<typeof TimeRangePicker> = {
  /*
   * Under Components, beside `DatePicker`, not under Charts.
   *
   * It is a form control that produces a value — the reader picks a period the same
   * way they pick a date — while everything under `Charts/` draws data. Filing it
   * with the charts put a date picker in a group a reader opens to find plot types.
   */
  title: 'Components/TimeRangePicker',
  component: TimeRangePicker,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof TimeRangePicker>;

function PickerDemo({ initial = '1h' }: { initial?: string }) {
  const [range, setRange] = React.useState<TimeRange>(presetRange(initial));
  return (
    <div className="flex flex-wrap items-center gap-3">
      <TimeRangePicker
        value={range}
        onChange={setRange}
        labels={LABELS}
        presets={rangePresets((key) => PRESET_LABELS[key] ?? key)}
        aiId="story:range"
      />
      <span className="text-xs text-ai-fg-muted">
        {range.kind === 'relative' ? `滚动窗口 · ${range.ms / 60_000} 分钟` : '自定义固定区间'}
      </span>
    </div>
  );
}

/**
 * Rolling presets and a fixed span in one control, as the monitoring pages use it.
 *
 * A rolling window always ends now, so an auto-refreshing chart keeps moving
 * forward; a fixed span stops where it was set, which is what an incident
 * comparison needs.
 */
export const Picker: Story = { render: () => <PickerDemo /> };

/** The custom span is selected: the trigger reads the two instants, not a preset name. */
export const CustomSpan: Story = {
  render: () => {
    const [range, setRange] = React.useState<TimeRange>({
      kind: 'absolute',
      start: Date.now() - 90 * 60_000,
      end: Date.now() - 30 * 60_000,
    });
    return (
      <div className="flex flex-wrap items-center gap-3">
        <TimeRangePicker value={range} onChange={setRange} labels={LABELS} aiId="story:range-custom" />
        <span className="text-xs text-ai-fg-muted">固定区间：轴不再随刷新移动</span>
      </div>
    );
  },
};
