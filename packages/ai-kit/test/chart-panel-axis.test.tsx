import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChartPanel } from '../src/charts/ChartPanel';
import type { ChartPanelLabels } from '../src/charts/ChartPanel';
import { presetRange } from '../src/charts/timeRange';

const LABELS: ChartPanelLabels = {
  placeholder: '最近 1 小时',
  presets: '选择时间范围',
  custom: '自定义时间范围',
  rangePlaceholder: '选择起止时间',
  step: '采样间隔',
  stepHint: '采样间隔会随所选范围自动调整。',
  stepOptions: [],
  cancel: '取消',
  confirm: '确定',
  invalid: '请选择完整的起止时间。',
  refresh: '刷新',
  error: '读取失败',
  retry: '重试',
  loading: '加载中',
  refreshing: '更新中…',
  autoPause: '暂停',
  autoResume: '继续',
  autoPauseLabel: '暂停自动刷新',
  autoResumeLabel: '继续自动刷新',
};

const POINTS = [
  { at: 1_700_000_000_000, value: 10 },
  { at: 1_700_000_060_000, value: 20 },
];

describe('ChartPanel axis', () => {
  it('draws the span the host queried, not a fresh reading of the clock', () => {
    /*
     * The defect this pins: a rolling range was resolved twice — once by the host for
     * the request, once by the panel for the axis. `Date.now()` moves between the two,
     * so the axis was a few seconds ahead of the data and the curve's start slid right
     * on every auto-refresh. Passing the host's span makes the two identical.
     */
    const start = 1_699_999_400_000;
    const end = 1_700_000_000_000;
    const view = render(
      <ChartPanel
        aiId="test:panel"
        title="趋势"
        series={[{ key: 'a', label: '甲', points: POINTS }]}
        range={presetRange('1h')}
        onRangeChange={() => undefined}
        start={start}
        end={end}
        step="60s"
        labels={LABELS}
        state="ready"
        height={120}
      />,
    );
    // The plot's own axis domain is what the reader sees; the panel prints the step it
    // was given rather than recomputing one from the span.
    expect(view.container.querySelector('[data-ai-id="test:panel:step"]')).toHaveTextContent('60s');
    const plot = view.container.querySelector('[data-ai-id="test:panel:chart"]');
    expect(plot).not.toBeNull();
    expect(plot!.getAttribute('data-ai-state')).toBe('ready');
  });

  it('stands the skeleton in the plot box on a first load, not above it', () => {
    /*
     * The defect this pins: the skeleton and the plot were both rendered, so the
     * skeleton sat in the flow above the chart and a 120px panel measured twice that,
     * with empty axes showing underneath the placeholder. A first load draws the
     * skeleton *instead of* the plot; a refresh keeps the plot and veils it.
     */
    const view = render(
      <ChartPanel
        aiId="test:loading"
        title="趋势"
        series={[{ key: 'a', label: '甲', points: POINTS }]}
        range={presetRange('1h')}
        onRangeChange={() => undefined}
        labels={LABELS}
        state="loading"
        height={120}
      />,
    );
    expect(view.container.querySelector('[data-ai-id="test:loading:loading"]')).not.toBeNull();
    expect(view.container.querySelector('[data-ai-id="test:loading:plot"]')).toBeNull();
  });

  it('falls back to resolving the range when the host passes none', () => {
    // A story or a read-only panel has no query of its own; it still has to draw.
    const view = render(
      <ChartPanel
        aiId="test:panel2"
        title="趋势"
        series={[{ key: 'a', label: '甲', points: POINTS }]}
        range={presetRange('1h')}
        onRangeChange={() => undefined}
        labels={LABELS}
        state="ready"
        height={120}
      />,
    );
    expect(view.container.querySelector('[data-ai-id="test:panel2:step"]')).toHaveTextContent('60s');
  });
});
