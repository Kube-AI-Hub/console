import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RefreshVeil, ChartSkeleton } from '../src/primitives/RefreshVeil';
import { Table } from '../src/primitives/Table';

/**
 * One loading and one refreshing appearance across the kit.
 *
 * The defect these pin: the chart's first load was a single grey block while a
 * table's was skeleton rows, and the two refresh veils had already drifted (40% vs
 * 45% tint, a rounded corner on one, a different z-index). The same action looked
 * like two different features depending on which page you were on.
 */

describe('RefreshVeil', () => {
  it('is the one veil: tint, blur, spinner and pill', () => {
    render(<RefreshVeil aiId="test:refreshing" />);
    const veil = document.querySelector('[data-ai-id="test:refreshing"]')!;
    expect(veil).toHaveClass('bg-ai-bg/40');
    expect(veil).toHaveClass('backdrop-blur-[1px]');
    expect(veil).toHaveClass('z-30');
    expect(veil).toHaveClass('pointer-events-none');
    // The label is the pill's text, not an aria label: the veil is decorative and the
    // container's `aria-busy` carries the meaning for a screen reader.
    expect(veil).toHaveTextContent('更新中…');
    expect(veil.querySelector('.animate-spin')).not.toBeNull();
  });

  it('accepts a localised label', () => {
    render(<RefreshVeil label="Updating…" />);
    expect(screen.getByText('Updating…')).toBeInTheDocument();
  });
});

describe('ChartSkeleton', () => {
  it('occupies the plot box and pulses like the table skeleton', () => {
    render(<ChartSkeleton height={220} aiId="test:loading" />);
    const skeleton = document.querySelector<HTMLElement>('[data-ai-id="test:loading"]')!;
    // The plot area is the inner box: the outer one may add a legend row, so the
    // declared height belongs to the element that stands in for the drawing.
    const plot = skeleton.firstElementChild as HTMLElement;
    expect(plot.style.height).toBe('220px');
    // Same pulse treatment as the table's skeleton rows: `animate-pulse` on
    // `bg-ai-surface-3`, so the two loading states read as one kind of thing.
    const bars = skeleton.querySelectorAll('.animate-pulse');
    expect(bars.length).toBeGreaterThan(3);
    for (const bar of bars) expect(bar).toHaveClass('bg-ai-surface-3');
  });

  it('draws a legend row only when the plot it stands in for has one', () => {
    // `ChartPanel` always renders a legend under the plot, so its skeleton must too:
    // without it the panel is shorter on the first load and the page jumps when the
    // data lands. A bare chart has no legend, so its skeleton must not invent one.
    const { unmount } = render(<ChartSkeleton height={180} legend />);
    expect(document.querySelectorAll('.rounded-full')).toHaveLength(3);
    unmount();
    render(<ChartSkeleton height={180} />);
    expect(document.querySelectorAll('.rounded-full')).toHaveLength(0);
  });

  it('draws a y-axis gutter and the baseline, so it looks like a chart', () => {
    render(<ChartSkeleton height={200} />);
    // Four tick-label bars in the gutter.
    expect(document.querySelectorAll('.w-9 > .animate-pulse')).toHaveLength(4);
    // The plot's baseline.
    expect(document.querySelector('.bg-ai-line')).not.toBeNull();
  });
});

describe('Table refresh veil', () => {
  it('uses the shared veil rather than its own copy', () => {
    const columns = [{ key: 'name', title: '名称' }];
    render(
      <Table
        columns={columns}
        rows={[{ name: 'a' }]}
        rowKey={(row) => row.name}
        refreshing
      />,
    );
    const veil = document.querySelector('[data-ai-id="table:refreshing"]')!;
    // The classes the shared component owns; a local copy would have to repeat them
    // and could drift.
    expect(veil).toHaveClass('bg-ai-bg/40');
    expect(veil).toHaveClass('z-30');
    expect(veil).toHaveTextContent('更新中…');
  });
});
