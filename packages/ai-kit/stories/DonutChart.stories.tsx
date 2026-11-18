import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { DonutChart } from '../src/primitives/DonutChart';

const meta: Meta<typeof DonutChart> = {
  title: 'Components/DonutChart',
  component: DonutChart,
  tags: ['autodocs'],
  args: {
    label: 'GPU vendors',
    emptyText: 'No data',
    segments: [
      { key: 'nvidia', label: 'NVIDIA', value: 24 },
      { key: 'cambricon', label: 'Cambricon', value: 8 },
      { key: 'other', label: 'Other', value: 2 },
    ],
  },
};
export default meta;
type Story = StoryObj<typeof DonutChart>;

export const VendorMix: Story = {};

export const NodeHealth: Story = {
  args: {
    label: 'Node health',
    segments: [
      { key: 'healthy', label: 'Healthy', value: 42 },
      { key: 'warning', label: 'Warning', value: 3 },
      { key: 'error', label: 'Error', value: 1 },
    ],
  },
};

export const OneSegment: Story = {
  args: { segments: [{ key: 'only', label: 'Only', value: 12 }] },
};

export const CustomColors: Story = {
  args: {
    segments: [
      { key: 'up', label: 'Up', value: 6, color: '#0ebe84' },
      { key: 'down', label: 'Down', value: 2, color: '#ca2621' },
    ],
  },
};

export const WithoutLegend: Story = { args: { showLegend: false } };

export const CenteredTotal: Story = {
  args: {
    size: 180,
    centerLabel: (
      <span className="text-lg font-semibold tabular-nums text-ai-fg">34</span>
    ),
  },
};

/** No drawable value: the component must say so instead of drawing an empty ring. */
export const Empty: Story = {
  args: {
    segments: [
      { key: 'nan', label: 'NaN', value: Number.NaN },
      { key: 'negative', label: 'Negative', value: -3 },
    ],
    emptyText: 'No segments to draw',
  },
};

export const LargeSize: Story = { args: { size: 240 } };

/**
 * Formatting is the host's job: the component renders whatever `formatValue`
 * returns and computes the share itself.
 */
export const FormattedValues: Story = {
  args: {
    formatValue: (value) => `${value} cards`,
    segments: [
      { key: 'nvidia', label: 'NVIDIA', value: 24 },
      { key: 'cambricon', label: 'Cambricon', value: 8 },
      { key: 'other', label: 'Other', value: 2 },
    ],
  },
};

/**
 * Force one theme for a single canvas story so both palettes can be compared
 * without touching the Storybook toolbar. Excluded from the docs page: two
 * stories forcing different themes at once would fight over `<html data-theme>`.
 */
function PreviewTheme({ mode, children }: { mode: 'dark' | 'light'; children: React.ReactNode }): React.ReactElement {
  React.useEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute('data-theme');
    // The story decorator's ThemeProvider applies its own mode in a passive effect;
    // deferring one task lets that run first and keeps the forced mode in place.
    const timer = window.setTimeout(() => root.setAttribute('data-theme', mode), 0);
    return () => {
      window.clearTimeout(timer);
      if (previous === null) root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', previous);
    };
  }, [mode]);
  return <>{children}</>;
}

export const DarkTheme: Story = {
  tags: ['!autodocs'],
  decorators: [(Story) => <PreviewTheme mode="dark"><Story /></PreviewTheme>],
};

export const LightTheme: Story = {
  tags: ['!autodocs'],
  decorators: [(Story) => <PreviewTheme mode="light"><Story /></PreviewTheme>],
};
