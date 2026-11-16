import type { Meta, StoryObj } from '@storybook/react';
import { MetricRing } from '../src/primitives/MetricRing';
import { Icon } from '../src/primitives/Icon';

const meta: Meta<typeof MetricRing> = {
  title: 'Components/MetricRing', component: MetricRing, tags: ['autodocs'],
  args: { value: 68, 'aria-label': 'Resource utilization', children: <Icon name="gpu" /> },
};
export default meta;
type Story = StoryObj<typeof MetricRing>;
export const Usage: Story = {};
export const Zero: Story = { args: { value: 0 } };
export const Unknown: Story = { args: { value: undefined } };
export const Warning: Story = { args: { value: 85 } };
export const OverCapacity: Story = { args: { value: 125 } };
export const Healthy: Story = { args: { value: 100, tone: 'success' } };
