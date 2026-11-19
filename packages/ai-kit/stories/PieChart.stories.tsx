import type { Meta, StoryObj } from '@storybook/react';
import { PieChart } from '../src/charts/PieChart';

const meta: Meta<typeof PieChart> = {
  title: 'Charts/PieChart',
  component: PieChart,
  tags: ['autodocs'],
  args: { label: '算力卡厂商分布', emptyText: '没有数据' },
};
export default meta;
type Story = StoryObj<typeof PieChart>;

/** Composition as a full pie: a total split across categories. */
export const Composition: Story = {
  args: {
    slices: [
      { key: 'nvidia', label: '英伟达', value: 12 },
      { key: 'ascend', label: '昇腾', value: 6 },
      { key: 'cambricon', label: '寒武纪', value: 4 },
      { key: 'cpu', label: 'CPU', value: 3 },
    ],
  },
};

/** The ring form: the hole carries the number the reader came for. */
export const Ring: Story = {
  args: {
    donut: true,
    size: 200,
    slices: [
      { key: 'bound', label: '已绑定', value: 42 },
      { key: 'pending', label: '等待中', value: 5 },
      { key: 'lost', label: '丢失', value: 1 },
    ],
    centerLabel: (
      <span className="flex flex-col items-center leading-tight">
        <span className="text-xl font-semibold tabular-nums text-ai-fg">48</span>
        <span className="text-[11px] text-ai-fg-muted">存储卷</span>
      </span>
    ),
  },
};

/** Progress as a gauge: one value against its capacity, with the share in the hole. */
export const Progress: Story = {
  args: {
    donut: true,
    size: 160,
    label: 'GPU 显存使用率',
    slices: [
      { key: 'used', label: '已用', value: 62, color: 'rgb(var(--ai-chart-2))' },
      { key: 'free', label: '剩余', value: 38, color: 'rgb(var(--ai-surface-3))' },
    ],
    centerLabel: <span className="text-lg font-semibold tabular-nums text-ai-fg">62%</span>,
  },
};

/** A thin ring: the shape a compact quota or health indicator uses. */
export const ThinRing: Story = {
  args: {
    donut: true,
    thickness: 0.12,
    size: 132,
    showLegend: false,
    slices: [
      { key: 'used', label: '已用', value: 7, color: 'rgb(var(--ai-raw-status-success))' },
      { key: 'free', label: '剩余', value: 18, color: 'rgb(var(--ai-surface-3))' },
    ],
    centerLabel: <span className="text-base font-semibold tabular-nums text-ai-fg">28%</span>,
  },
};

/** Nothing drawable is an explanation, never an empty ring that reads as all-good. */
export const Empty: Story = { args: { slices: [] } };
