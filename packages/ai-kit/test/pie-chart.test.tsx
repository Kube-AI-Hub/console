import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PieChart, progressSlices } from '../src/charts/PieChart';
import { ProgressRing } from '../src/charts/ProgressRing';

describe('PieChart', () => {
  it('keeps positive slices, drops non-finite and zero ones, and shares the whole', () => {
    render(
      <PieChart
        label="厂商分布"
        emptyText="没有数据"
        slices={[
          { key: 'nvidia', label: '英伟达', value: 3 },
          { key: 'ascend', label: '昇腾', value: 1 },
          { key: 'zero', label: '零', value: 0 },
          { key: 'nan', label: 'NaN', value: Number.NaN },
        ]}
      />,
    );
    const slices = document.querySelectorAll('[data-ai-slice]');
    expect(slices).toHaveLength(2);
    expect(document.querySelector('[data-ai-pie-total]')).toHaveAttribute('data-ai-pie-total', '4');
    // 3 of 4 is 75%; the dropped zero must not be counted in the whole.
    expect(document.querySelector('[data-ai-slice="nvidia"]')).toHaveAttribute('data-ai-slice-percent', '75');
    expect(document.querySelector('[data-ai-slice="ascend"]')).toHaveAttribute('data-ai-slice-percent', '25');
  });

  it('explains an empty composition instead of drawing a ring that reads as all-good', () => {
    render(<PieChart label="空" emptyText="没有数据" slices={[{ key: 'a', label: 'a', value: 0 }]} />);
    expect(screen.getByText('没有数据')).toHaveAttribute('data-ai-state', 'empty');
    expect(document.querySelector('svg')).toBeNull();
  });

  it('draws a ring with a hole for a gauge and a full pie otherwise', () => {
    const view = render(
      <PieChart label="进度" emptyText="-" donut animate={false} size={120} slices={[{ key: 'used', label: '已用', value: 60 }, { key: 'free', label: '剩余', value: 40 }]} />,
    );
    expect(view.container.querySelectorAll('path').length).toBeGreaterThan(0);
    expect(view.container.querySelector('[data-ai-state]')).toHaveAttribute('data-ai-state', 'ready');
  });

  it('animates the sweep by default, and can be told not to', () => {
    // The sweep starts at 12 o'clock and grows clockwise; without it a composition
    // chart reads as a static image rather than as a share being filled.
    const animated = render(
      <PieChart label="动画" emptyText="-" slices={[{ key: 'a', label: 'a', value: 1 }, { key: 'b', label: 'b', value: 1 }]} />,
    );
    expect(animated.container.querySelectorAll('[class*="recharts-pie-sector"]').length).toBeGreaterThan(0);
  });

  it('renders the centre label in the hole', () => {
    render(
      <PieChart
        label="进度"
        emptyText="-"
        donut
        slices={[{ key: 'used', label: '已用', value: 1 }]}
        centerLabel={<span>62%</span>}
      />,
    );
    expect(screen.getByText('62%')).toBeInTheDocument();
  });

  it('builds the two slices a progress ring needs, and one when the pool is over-committed', () => {
    expect(progressSlices(30, 100, { used: 'used', free: 'free' })).toEqual([
      { key: 'used', label: 'used', value: 30 },
      { key: 'free', label: 'free', value: 70 },
    ]);
    // Over 100%: nothing remains, so a zero slice must not appear in the legend.
    expect(progressSlices(120, 100, { used: 'used', free: 'free' })).toEqual([
      { key: 'used', label: 'used', value: 120 },
    ]);
    expect(progressSlices(0, 100, { used: 'used', free: 'free' })).toEqual([]);
  });

  it('reads `thickness` as the band, so a small value really is a thin ring', () => {
    // The defect this pins: `thickness` used to be the inner-radius share, so 0.12 on
    // a 180px box left a 10.8px hole and the ring rendered as a solid pie.
    const view = render(
      <PieChart
        label="细环"
        emptyText="-"
        donut
        animate={false}
        thickness={0.12}
        size={200}
        slices={[{ key: 'used', label: '已用', value: 3 }, { key: 'free', label: '剩余', value: 1 }]}
      />,
    );
    const path = view.container.querySelector('path')?.getAttribute('d') ?? '';
    // The arc's radii are in the path; the inner one must be close to the outer, not near zero.
    const radii = [...path.matchAll(/[Aa]\s*([\d.]+),([\d.]+)/g)].map((match) => Number(match[1]));
    expect(radii.length).toBeGreaterThan(0);
    const outer = Math.max(...radii);
    const inner = Math.min(...radii);
    expect(inner, `inner=${inner} outer=${outer}`).toBeGreaterThan(outer * 0.7);
  });

  it('lifts the hovered sector and shows its numbers', () => {
    const view = render(
      <PieChart
        label="悬停"
        emptyText="-"
        donut
        animate={false}
        size={160}
        slices={[{ key: 'a', label: '甲', value: 3 }, { key: 'b', label: '乙', value: 1 }]}
      />,
    );
    // No readout until the pointer arrives: a permanently visible card would cover
    // the ring it describes.
    expect(view.container.querySelector('[data-ai-pie-tooltip]')).toBeNull();

    const sectors = view.container.querySelectorAll('[class*="recharts-pie-sector"]');
    expect(sectors.length).toBe(2);
    fireEvent.mouseEnter(sectors[0]!);

    const tooltip = view.container.querySelector('[data-ai-pie-tooltip]');
    expect(tooltip).not.toBeNull();
    expect(tooltip?.textContent).toContain('甲');
    expect(view.container.querySelector('[data-ai-pie-tooltip-value="a"]')?.textContent).toContain('75%');
    // The legend row of the same slice is highlighted, so the two halves agree.
    expect(view.container.querySelector('[data-ai-slice="a"]')).toHaveAttribute('data-ai-slice-active', 'true');

    // Leaving the drawing clears it: a stuck highlight reads as a selection.
    fireEvent.mouseLeave(view.container.firstElementChild!.querySelector('div')!);
    expect(view.container.querySelector('[data-ai-pie-tooltip]')).toBeNull();
  });

  it('highlights from the legend too, so either side can point at a slice', () => {
    const view = render(
      <PieChart
        label="图例"
        emptyText="-"
        slices={[{ key: 'a', label: '甲', value: 1 }, { key: 'b', label: '乙', value: 1 }]}
      />,
    );
    fireEvent.mouseEnter(view.container.querySelector('[data-ai-slice="b"]')!);
    expect(view.container.querySelector('[data-ai-pie-tooltip-value="b"]')).not.toBeNull();
    expect(view.container.querySelector('[data-ai-slice="b"]')).toHaveAttribute('data-ai-slice-active', 'true');
    fireEvent.mouseLeave(view.container.querySelector('[data-ai-slice="b"]')!);
    expect(view.container.querySelector('[data-ai-pie-tooltip]')).toBeNull();
  });
});

describe('ProgressRing', () => {
  it('prints the percentage in the hole and exposes the numbers as handles', () => {
    render(<ProgressRing used={62} total={100} label="GPU 显存" labels={{ used: '已用', free: '剩余' }} />);
    expect(screen.getByText('62%')).toBeInTheDocument();
    const host = document.querySelector('[data-ai-progress-used]');
    expect(host).toHaveAttribute('data-ai-progress-used', '62');
    expect(host).toHaveAttribute('data-ai-progress-total', '100');
    expect(host).toHaveAttribute('data-ai-progress-percent', '62');
  });

  it('shows "-" when there is no capacity to compare against', () => {
    render(<ProgressRing used={5} label="无总量" labels={{ used: '已用', free: '剩余' }} />);
    expect(document.querySelector('[data-ai-id="progress-ring:value"]')).toHaveTextContent('-');
  });

  it('rounds to one decimal so a 33.33% does not print a wall of digits', () => {
    render(<ProgressRing used={1} total={3} label="三分之一" labels={{ used: '已用', free: '剩余' }} />);
    expect(document.querySelector('[data-ai-id="progress-ring:value"]')).toHaveTextContent('33.3%');
  });
});
