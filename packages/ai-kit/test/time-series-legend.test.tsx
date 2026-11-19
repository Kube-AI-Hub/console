import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TimeSeriesChart } from '../src/charts/TimeSeriesChart';
import type { TimeSeries } from '../src/charts/TimeSeriesChart';

const SERIES: TimeSeries[] = [
  { key: 'a', label: '甲', points: [{ at: 0, value: 1 }, { at: 100, value: 2 }] },
  { key: 'b', label: '乙', points: [{ at: 0, value: 3 }, { at: 100, value: 4 }] },
];

/*
 * The drawing library does not paint in jsdom (no layout, no `path` elements), so
 * "the line disappeared" cannot be asserted from the DOM. The legend's own state is
 * the observable contract the reader acts on, and `data-ai-legend-hidden` is what an
 * automation reads; both are asserted here. The actual plot is verified in Storybook.
 */
function legendButton(container: HTMLElement, key: string): HTMLElement {
  const button = container.querySelector<HTMLElement>(`[data-ai-legend="${key}"]`);
  if (!button) throw new Error(`legend entry ${key} not rendered`);
  return button;
}

function isHidden(container: HTMLElement, key: string): boolean {
  return legendButton(container, key).getAttribute('data-ai-legend-hidden') === 'true';
}

describe('TimeSeriesChart legend', () => {
  it('toggles a line on its own when the host supplies no callback', () => {
    // The defect this pins: the legend was a button with `aria-pressed` that called
    // `onToggleSeries?.()` — a host that only passed `hidden` got a control that
    // announced itself as pressable and did nothing.
    const view = render(
      <TimeSeriesChart label="趋势" emptyText="无数据" start={0} end={100} series={SERIES} animate={false} />,
    );
    expect(isHidden(view.container, 'a')).toBe(false);
    expect(legendButton(view.container, 'a')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(legendButton(view.container, 'a'));

    expect(isHidden(view.container, 'a')).toBe(true);
    expect(legendButton(view.container, 'a')).toHaveAttribute('aria-pressed', 'false');
    // The entry stays, so the line can be brought back.
    expect(legendButton(view.container, 'a').textContent).toContain('甲');

    fireEvent.click(legendButton(view.container, 'a'));
    expect(isHidden(view.container, 'a')).toBe(false);
    expect(legendButton(view.container, 'a')).toHaveAttribute('aria-pressed', 'true');
  });

  it('defers to the host callback when one is given', () => {
    // A page that persists the choice must own it: a local toggle on top of a
    // controlled prop would fight the next render.
    const onToggleSeries = vi.fn();
    const view = render(
      <TimeSeriesChart
        label="趋势"
        emptyText="无数据"
        start={0}
        end={100}
        series={SERIES}
        animate={false}
        onToggleSeries={onToggleSeries}
      />,
    );
    fireEvent.click(legendButton(view.container, 'b'));
    expect(onToggleSeries).toHaveBeenCalledWith('b');
    // Nothing changed locally: the host decides, and it has not re-rendered yet.
    expect(isHidden(view.container, 'b')).toBe(false);
  });

  it('starts from the `hidden` prop and lets the reader bring that line back', () => {
    const view = render(
      <TimeSeriesChart
        label="趋势"
        emptyText="无数据"
        start={0}
        end={100}
        series={[{ ...SERIES[0]! }, { ...SERIES[1]!, hidden: true }]}
        animate={false}
      />,
    );
    expect(isHidden(view.container, 'b')).toBe(true);
    expect(legendButton(view.container, 'b')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(legendButton(view.container, 'b'));
    expect(isHidden(view.container, 'b')).toBe(false);
  });

  it('drops a local toggle when the series identity changes', () => {
    // A hidden key from the previous metric would otherwise hide an unrelated line
    // that happens to share its name.
    const view = render(
      <TimeSeriesChart label="趋势" emptyText="无数据" start={0} end={100} series={SERIES} animate={false} />,
    );
    fireEvent.click(legendButton(view.container, 'a'));
    expect(isHidden(view.container, 'a')).toBe(true);

    view.rerender(
      <TimeSeriesChart
        label="趋势"
        emptyText="无数据"
        start={0}
        end={100}
        animate={false}
        series={[
          { key: 'a', label: '甲·新', points: [{ at: 0, value: 5 }] },
          { key: 'c', label: '丙', points: [{ at: 0, value: 6 }] },
        ]}
      />,
    );
    expect(isHidden(view.container, 'a')).toBe(false);
    expect(legendButton(view.container, 'a').textContent).toContain('甲·新');
  });

  it('refuses to hide the last line that has data', () => {
    /*
     * The defect this pins: hiding the final visible series left nothing to draw, so
     * the chart collapsed into its empty state — "hide the last line" looked like the
     * data had vanished. A single-series chart (the overview's usage plot) was one
     * click away from a blank panel.
     */
    const view = render(
      <TimeSeriesChart
        label="单序列"
        emptyText="无数据"
        start={0}
        end={100}
        animate={false}
        series={[{ key: 'only', label: '唯一', points: [{ at: 0, value: 1 }, { at: 100, value: 2 }] }]}
      />,
    );
    fireEvent.click(legendButton(view.container, 'only'));
    // Still drawn, still pressed: the click was refused rather than blanking the plot.
    expect(isHidden(view.container, 'only')).toBe(false);
    expect(legendButton(view.container, 'only')).toHaveAttribute('aria-pressed', 'true');
    expect(view.container.querySelector('[data-ai-state="empty"]')).toBeNull();
  });

  it('still lets a series with no points be toggled off', () => {
    // "Hide an empty line" is a legitimate click; it cannot blank the plot because
    // that line was never drawn.
    const view = render(
      <TimeSeriesChart
        label="空序列"
        emptyText="无数据"
        start={0}
        end={100}
        animate={false}
        series={[
          { key: 'a', label: '甲', points: [{ at: 0, value: 1 }] },
          { key: 'empty', label: '空', points: [] },
        ]}
      />,
    );
    fireEvent.click(legendButton(view.container, 'empty'));
    expect(isHidden(view.container, 'empty')).toBe(true);
    expect(isHidden(view.container, 'a')).toBe(false);
  });
});

describe('TimeSeriesChart refresh', () => {
  it('keeps the plot mounted while a refresh runs, and veils it only when asked', () => {
    /*
     * A refresh must not replace the chart: the reader is watching the line they were
     * reading. The veil is the manual-refresh affordance (the resource lists' gesture);
     * an auto tick passes `refreshing={false}` and the line animates instead.
     */
    const view = render(
      <TimeSeriesChart label="趋势" emptyText="无数据" start={0} end={100} series={SERIES} animate={false} />,
    );
    expect(view.container.querySelector('[data-ai-chart-refreshing]')).toBeNull();

    view.rerender(
      <TimeSeriesChart label="趋势" emptyText="无数据" start={0} end={100} series={SERIES} animate={false} refreshing />,
    );
    expect(view.container.querySelector('[data-ai-chart-refreshing]')).not.toBeNull();
    // The drawing is still there behind the veil.
    expect(view.container.querySelector('[data-ai-state="ready"]')).not.toBeNull();

    view.rerender(
      <TimeSeriesChart label="趋势" emptyText="无数据" start={0} end={100} series={SERIES} animate={false} />,
    );
    expect(view.container.querySelector('[data-ai-chart-refreshing]')).toBeNull();
  });

  it('holds a fixed plot height so data arriving cannot move the page', () => {
    const view = render(
      <TimeSeriesChart label="高度" emptyText="无数据" start={0} end={100} series={SERIES} animate={false} height={260} />,
    );
    const box = view.container.querySelector<HTMLElement>('[data-ai-series-count]');
    expect(box).not.toBeNull();
    expect(box!.style.height).toBe('260px');
  });
});
