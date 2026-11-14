import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TrendChart } from '../src/primitives/TrendChart';

describe('TrendChart', () => {
  it('preserves real zero samples and ignores non-finite and out-of-range values', () => {
    render(<TrendChart label="Idle GPU" emptyText="No samples" start={0} end={100}
      points={[{ at: 0, value: 0 }, { at: 100, value: 0 }, { at: 20, value: NaN }, { at: 101, value: 99 }]} />);
    expect(screen.getByRole('img', { name: 'Idle GPU' })).toBeInTheDocument();
    expect(document.querySelector('[data-ai-points]')).toHaveAttribute('data-ai-points', '2');
    expect(document.querySelector('path')).toHaveAttribute('d', 'M0.00,30.00 L100.00,30.00');
  });
  it('separates missing scrape gaps without filling them with zero', () => {
    render(<TrendChart label="Gaps" emptyText="Empty" start={0} end={100} maxGap={30}
      points={[{ at: 0, value: 10 }, { at: 20, value: 20 }, { at: 90, value: 15 }]} />);
    const path = document.querySelector('path')?.getAttribute('d') ?? '';
    expect(path.match(/M/g)).toHaveLength(2);
    expect(path.match(/L/g)).toHaveLength(1);
  });
  it('renders missing data as an empty state rather than an idle chart', () => {
    render(<TrendChart label="GPU" emptyText="No samples" start={0} end={100} points={[]} />);
    expect(screen.getByText('No samples')).toHaveAttribute('data-ai-state', 'empty');
    expect(screen.queryByRole('img')).toBeNull();
  });
});
