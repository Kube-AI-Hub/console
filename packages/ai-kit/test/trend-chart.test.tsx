import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TrendChart, TREND_SERIES_COLORS } from '../src/primitives/TrendChart';

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

  it('draws one line per series identity instead of merging them', () => {
    render(<TrendChart label="By verb" emptyText="No samples" start={0} end={100}
      series={[
        { key: 'GET', label: 'GET', points: [{ at: 0, value: 1 }, { at: 100, value: 2 }] },
        { key: 'POST', label: 'POST', points: [{ at: 0, value: 3 }, { at: 100, value: 4 }] },
      ]} />);
    const paths = document.querySelectorAll('path');
    expect(paths).toHaveLength(2);
    expect(Array.from(paths).map((path) => path.getAttribute('data-ai-series'))).toEqual(['GET', 'POST']);
    expect(document.querySelector('[data-ai-points]')).toHaveAttribute('data-ai-points', '4');
    expect(document.querySelector('[data-ai-series-count]')).toHaveAttribute('data-ai-series-count', '2');
    // Distinct palette colours, and channel tokens wrapped in rgb() (a bare var() renders nothing).
    const strokes = Array.from(paths).map((path) => path.getAttribute('stroke'));
    expect(new Set(strokes).size).toBe(2);
    for (const stroke of strokes) expect(stroke).toMatch(/^rgb\(var\(--ai-chart-\d\)\)$/);
  });

  it('keeps a series with only NaN points out of the drawing', () => {
    render(<TrendChart label="Latency" emptyText="No samples" start={0} end={100}
      series={[
        { key: 'GET', label: 'GET', points: [{ at: 0, value: 3 }, { at: 100, value: 4 }] },
        { key: 'APPLY', label: 'APPLY', points: [{ at: 0, value: NaN }, { at: 100, value: NaN }] },
      ]} />);
    const paths = document.querySelectorAll('path');
    expect(paths).toHaveLength(1);
    expect(paths[0]!.getAttribute('data-ai-series')).toBe('GET');
    expect(document.querySelector('[data-ai-points]')).toHaveAttribute('data-ai-points', '2');
  });

  it('is empty when every series has no finite sample, even if series were passed', () => {
    render(<TrendChart label="Empty" emptyText="No samples" start={0} end={100}
      series={[{ key: 'GET', label: 'GET', points: [] }, { key: 'POST', label: 'POST', points: [{ at: 0, value: NaN }] }]} />);
    expect(screen.getByText('No samples')).toHaveAttribute('data-ai-state', 'empty');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('exposes a palette whose first entry is the first series colour', () => {
    render(<TrendChart label="Palette" emptyText="Empty" start={0} end={100}
      series={[{ key: 'A', label: 'A', points: [{ at: 0, value: 1 }] }]} />);
    expect(document.querySelector('path')).toHaveAttribute('stroke', TREND_SERIES_COLORS[0]);
  });
  it('supports pointer and keyboard sample inspection with formatted values', () => {
    const view = render(<TrendChart label="CPU history" emptyText="Empty" start={0} end={100} interactive showAxes showGrid
      yDomain={[0, 100]} formatTime={(at) => `${at}s`} formatValue={(value) => `${value}%`}
      points={[{ at: 0, value: 0 }, { at: 50, value: 20 }, { at: 100, value: 125 }]} />);
    const chart = screen.getByRole('group', { name: 'CPU history' });
    fireEvent.focus(chart);
    expect(chart).toHaveAttribute('data-ai-cursor-at', '100');
    fireEvent.keyDown(chart, { key: 'ArrowLeft' });
    expect(view.container.querySelector('[data-ai-trend-readout]')).toHaveTextContent('50s20%');
    fireEvent.keyDown(chart, { key: 'Home' });
    expect(chart).toHaveAttribute('data-ai-cursor-at', '0');
    const svg = screen.getByRole('img');
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 100 } as DOMRect);
    fireEvent.mouseMove(chart, { clientX: 51 });
    expect(chart).toHaveAttribute('data-ai-cursor-at', '50');
    fireEvent.mouseLeave(chart);
    expect(chart).not.toHaveAttribute('data-ai-cursor-at');
  });
  it('does not fill areas across missing scrapes and keeps new features opt-in', () => {
    const view = render(<TrendChart label="Gaps" emptyText="Empty" start={0} end={100} area maxGap={20}
      points={[{ at: 0, value: 2 }, { at: 10, value: 3 }, { at: 90, value: 4 }, { at: 100, value: 5 }]} />);
    expect(view.container.querySelectorAll('[data-ai-trend-area]')).toHaveLength(2);
    expect(screen.queryByRole('group')).toBeNull();
    view.rerender(<TrendChart label="Legacy" emptyText="Empty" start={0} end={100} points={[{ at: 0, value: 0 }]} />);
    expect(view.container.querySelector('[data-ai-trend-area]')).toBeNull();
    expect(view.container.querySelector('[data-ai-trend-readout]')).toBeNull();
  });
});
