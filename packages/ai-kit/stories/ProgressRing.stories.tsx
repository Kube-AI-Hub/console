import type { Meta, StoryObj } from '@storybook/react';
import { ProgressRing } from '../src/charts/ProgressRing';

const meta: Meta<typeof ProgressRing> = {
  title: 'Charts/ProgressRing',
  component: ProgressRing,
  tags: ['autodocs'],
  args: { used: 62, total: 100, label: 'GPU 显存', labels: { used: '已用', free: '剩余' } },
};
export default meta;
type Story = StoryObj<typeof ProgressRing>;

/** Used against capacity, with the percentage in the hole. */
export const Gauge: Story = {};

/** Over capacity is information, not an error: the ring fills and the legend drops "free". */
export const OverCapacity: Story = {
  args: { used: 120, total: 100, label: '超额分配', tone: 'warning' },
};

/** With the legend, the exact used/total pair sits beside the comparable percentage. */
export const GaugeWithLegend: Story = {
  args: {
    used: 4,
    total: 8,
    label: '已分配 GPU',
    labels: { used: '已分配', free: '空闲' },
    showLegend: true,
    size: 140,
    formatValue: (value) => `${value} 卡`,
  },
};

/** No capacity to compare against: the ring shows what it has and the hole prints "-". */
export const UnknownTotal: Story = {
  args: { used: 5, total: undefined, label: '未上报总量' },
};
