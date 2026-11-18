import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DonutChart } from '../src/primitives/DonutChart';

/** jsdom has no cascade for custom properties, so tests hand the hook token values. */
function mockTokens(tokens: Record<string, string>): void {
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    getPropertyValue: (name: string) => tokens[name] ?? '',
  } as unknown as CSSStyleDeclaration);
}

function sectorFills(): string[] {
  return Array.from(document.querySelectorAll('svg [fill]'))
    .map((node) => node.getAttribute('fill') ?? '')
    .filter((fill) => fill.startsWith('rgb') || fill.startsWith('#'));
}

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-accent');
});

describe('DonutChart', () => {
  it('draws one legend row per segment with its value and share', () => {
    render(
      <DonutChart
        label="GPU vendors"
        emptyText="No data"
        segments={[
          { key: 'nvidia', label: 'NVIDIA', value: 3 },
          { key: 'cambricon', label: 'Cambricon', value: 1 },
        ]}
      />,
    );
    const chart = screen.getByRole('img', { name: 'GPU vendors' });
    expect(chart).toHaveAttribute('data-ai-state', 'ready');
    expect(chart).toHaveAttribute('data-ai-segments', '2');
    expect(chart.querySelector('svg')).not.toBeNull();
    // The figure owns the accessible name; no recharts-only tab stop inside it.
    expect(chart.querySelector('[tabindex="0"]')).toBeNull();
    const rows = chart.querySelectorAll('[data-ai-segment]');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute('data-ai-segment', 'nvidia');
    expect(rows[0]).toHaveTextContent('NVIDIA');
    expect(rows[0]).toHaveTextContent('3');
    expect(rows[0]).toHaveTextContent('75%');
    expect(rows[1]).toHaveTextContent('Cambricon');
    expect(rows[1]).toHaveTextContent('25%');
  });

  it('resolves the chart tokens to colours recharts can draw and honours a segment colour', () => {
    mockTokens({ '--ai-chart-1': '169 129 248', '--ai-chart-2': '50 157 206', '--ai-chart-3': '#123456' });
    render(
      <DonutChart
        label="Vendors"
        emptyText="No data"
        segments={[
          { key: 'a', label: 'A', value: 1 },
          { key: 'b', label: 'B', value: 1 },
          { key: 'c', label: 'C', value: 1 },
          { key: 'd', label: 'D', value: 1, color: '#0ebe84' },
        ]}
      />,
    );
    const fills = sectorFills();
    expect(fills).toContain('rgb(169 129 248)');
    expect(fills).toContain('rgb(50 157 206)');
    expect(fills).toContain('#123456');
    expect(fills).toContain('#0ebe84');
  });

  it('falls back to the built-in palette when a token does not resolve to a colour', () => {
    mockTokens({ '--ai-chart-1': 'not a colour', '--ai-chart-2': 'var(--missing)' });
    render(<DonutChart label="Vendors" emptyText="No data" segments={[{ key: 'a', label: 'A', value: 1 }, { key: 'b', label: 'B', value: 1 }]} />);
    expect(sectorFills()).toEqual(['rgb(169 129 248)', 'rgb(50 157 206)']);
  });

  it('drops non-finite and non-positive values instead of drawing or counting them as zero', () => {
    render(
      <DonutChart
        label="Segments"
        emptyText="No data"
        segments={[
          { key: 'a', label: 'A', value: 5 },
          { key: 'zero', label: 'Zero', value: 0 },
          { key: 'nan', label: 'NaN', value: Number.NaN },
          { key: 'negative', label: 'Negative', value: -2 },
          { key: 'infinite', label: 'Infinite', value: Number.POSITIVE_INFINITY },
          { key: 'b', label: 'B', value: 5 },
        ]}
      />,
    );
    const chart = screen.getByRole('img', { name: 'Segments' });
    expect(chart).toHaveAttribute('data-ai-segments', '2');
    const rows = chart.querySelectorAll('[data-ai-segment]');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('A');
    expect(rows[0]).toHaveTextContent('50%');
    expect(rows[1]).toHaveTextContent('B');
    expect(rows[1]).toHaveTextContent('50%');
    expect(screen.queryByText('Zero')).toBeNull();
  });

  it('renders only the empty text when nothing is drawable', () => {
    const view = render(
      <DonutChart
        label="Empty chart"
        emptyText="No data to draw"
        segments={[
          { key: 'nan', label: 'NaN', value: Number.NaN },
          { key: 'zero', label: 'Zero', value: 0 },
          { key: 'negative', label: 'Negative', value: -1 },
        ]}
      />,
    );
    const chart = screen.getByRole('img', { name: 'Empty chart' });
    expect(chart).toHaveAttribute('data-ai-state', 'empty');
    expect(chart).toHaveTextContent('No data to draw');
    expect(chart.querySelector('svg')).toBeNull();
    expect(chart.querySelector('[data-ai-segment]')).toBeNull();
    view.rerender(<DonutChart label="Empty chart" emptyText="No data to draw" segments={[]} />);
    expect(screen.getByRole('img', { name: 'Empty chart' })).toHaveAttribute('data-ai-state', 'empty');
  });

  it('supports formatValue, centerLabel, size and an optional legend', () => {
    const view = render(
      <DonutChart
        label="Cards"
        emptyText="No data"
        size={200}
        formatValue={(value) => `${value} cards`}
        centerLabel={<span>34</span>}
        segments={[{ key: 'a', label: 'A', value: 30 }, { key: 'b', label: 'B', value: 4 }]}
      />,
    );
    const chart = screen.getByRole('img', { name: 'Cards' });
    expect(screen.getByText('34')).toBeInTheDocument();
    expect(chart).toHaveTextContent('30 cards');
    expect(chart).toHaveTextContent('4 cards');
    const box = chart.querySelector('div') as HTMLElement;
    expect(box.style.width).toBe('200px');
    expect(box.style.height).toBe('200px');
    view.rerender(
      <DonutChart label="Cards" emptyText="No data" showLegend={false} segments={[{ key: 'a', label: 'A', value: 30 }]} />,
    );
    expect(screen.getByRole('img', { name: 'Cards' }).querySelector('[data-ai-segment]')).toBeNull();
    expect(screen.queryByText('30 cards')).toBeNull();
  });

  it('re-resolves the palette when the page theme changes', async () => {
    let mode: 'dark' | 'light' = 'dark';
    vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
      getPropertyValue: (name: string) => (name === '--ai-chart-1'
        ? (mode === 'dark' ? '169 129 248' : '107 41 250')
        : ''),
    }) as unknown as CSSStyleDeclaration);
    render(<DonutChart label="Vendors" emptyText="No data" segments={[{ key: 'a', label: 'A', value: 1 }]} />);
    expect(sectorFills()).toContain('rgb(169 129 248)');
    mode = 'light';
    document.documentElement.setAttribute('data-theme', 'light');
    await waitFor(() => expect(sectorFills()).toContain('rgb(107 41 250)'));
  });
});
