import type { Meta, StoryObj } from '@storybook/react';
import { TrendChart } from '../src/primitives/TrendChart';

const meta: Meta<typeof TrendChart> = {
  title: 'Components/TrendChart', component: TrendChart, tags: ['autodocs'],
  args: { start: 0, end: 100, label: 'Metric trend', emptyText: 'No samples' },
};
export default meta;
type Story = StoryObj<typeof TrendChart>;
export const Samples: Story = { args: { points: [{ at: 0, value: 10 }, { at: 20, value: 25 }, { at: 50, value: 0 }, { at: 100, value: 40 }] } };
export const Idle: Story = { args: { points: [{ at: 0, value: 0 }, { at: 100, value: 0 }] } };
export const MissingSamples: Story = { args: { maxGap: 30, points: [{ at: 0, value: 10 }, { at: 20, value: 20 }, { at: 90, value: 15 }, { at: 100, value: 30 }] } };
export const Empty: Story = { args: { points: [] } };
export const OneSample: Story = { args: { points: [{ at: 50, value: 0 }] } };
