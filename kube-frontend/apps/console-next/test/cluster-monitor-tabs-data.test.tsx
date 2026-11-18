import { describe, expect, it } from 'vitest';
import type { MetricSeries, NodeRankRow } from '@kube-ai-hub/api-client';
import type { LocaleKey, Translate } from '@kube-ai-hub/locales';
import {
  NODE_USAGE_EXPORT_FILENAME,
  buildNodeUsageExport,
  collectRankRows,
} from '@/pages/cluster/NodeRankingPanel';
import {
  RESOURCE_CHARTS,
  RESOURCE_GROUPS,
  RESOURCE_METRICS,
  chartsInGroup,
  formatResourceValue,
  toResourceCharts,
  type ResourceChart,
} from '@/pages/cluster/monitorResourceCharts';

/**
 * Data-layer tests for the physical-resource, API Server, scheduler and ranking tabs.
 *
 * The chart components are thin renderers over these pure functions; the facts worth
 * asserting are the ones that are easy to get silently wrong: which metric feeds which
 * line, that a 0..1 ratio is scaled once, that a missing metric stays missing instead of
 * plotting zeros, and that the ranking export pages through every row.
 */

/** Identity translation: assertions name the locale key the chart should have used. */
const t: Translate = ((key: LocaleKey) => key) as unknown as Translate;

function row(name: string, values: NodeRankRow['values'] = {}): NodeRankRow {
  return { name, values };
}

function metric(name: string, values: number[]): MetricSeries {
  return { name, points: values.map((value, index) => ({ at: 1_000 + index * 1_000, value })) };
}

describe('physical-resource chart catalogue', () => {
  it('groups the eighteen charts the contract names, in group order', () => {
    const counts = Object.fromEntries(
      RESOURCE_GROUPS.map((group) => [group, RESOURCE_CHARTS.filter((chart) => chart.group === group).length]),
    );
    expect(RESOURCE_CHARTS).toHaveLength(18);
    expect(counts).toEqual({ gpu: 3, host: 6, disk: 2, network: 1, rdma: 6 });
  });

  it('keeps chart keys unique inside a group and every metric in one deduplicated request', () => {
    for (const group of RESOURCE_GROUPS) {
      const keys = RESOURCE_CHARTS.filter((chart) => chart.group === group).map((chart) => chart.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
    const expected = [...new Set(RESOURCE_CHARTS.flatMap((chart) => chart.series.map((line) => line.metric)))];
    expect(RESOURCE_METRICS).toEqual(expected);
    // RDMA needs a cluster that reports it; the request still asks for all of it.
    expect(RESOURCE_METRICS).toContain('cluster_ib_rx_errors');
  });

  it('merges the multi-line charts onto one chart and scales ratios once', () => {
    const charts = toResourceCharts(
      [
        metric('cluster_load1', [1.5]),
        metric('cluster_load5', [1.25]),
        metric('cluster_load15', [1.1]),
        metric('cluster_pod_running_count', [42]),
        metric('cluster_pod_succeeded_count', [7]),
        metric('cluster_pod_abnormal_count', [2]),
        metric('cluster_gpu_memory_utilisation', [0.42]),
        metric('cluster_gpu_utilization', [0.9]),
      ],
      t,
    );
    const find = (key: string): ResourceChart => {
      const chart = charts.find((entry) => entry.spec.key === key);
      if (!chart) throw new Error('missing chart ' + key);
      return chart;
    };

    const load = find('load');
    expect(load.series.map((line) => line.key)).toEqual(['load1', 'load5', 'load15']);
    expect(load.series.map((line) => line.label)).toEqual([
      'cluster.monitor.load1',
      'cluster.monitor.load5',
      'cluster.monitor.load15',
    ]);
    expect(load.series[0]!.points[0]!.value).toBe(1.5);

    const pods = find('pods');
    expect(pods.series.map((line) => line.key)).toEqual(['running', 'completed', 'abnormal']);

    // 0.42 as reported by the API is 42%, not 0.42%.
    expect(find('gpuMemory').series[0]!.points[0]!.value).toBeCloseTo(42);
    // A chart whose metrics were not returned is empty, never a zero line.
    expect(find('gpuAllocated').hasData).toBe(false);
    expect(find('gpuAllocated').series).toHaveLength(0);
  });

  it('renders every RDMA chart empty when the cluster reports no RDMA series', () => {
    const charts = toResourceCharts([metric('cluster_cpu_utilisation', [0.5])], t);
    const rdma = chartsInGroup(charts, 'rdma');
    expect(rdma).toHaveLength(6);
    expect(rdma.every((chart) => !chart.hasData)).toBe(true);
    expect(rdma.every((chart) => chart.series.length === 0)).toBe(true);
    // The host group still has its one reported chart, so the tab is not globally empty.
    expect(chartsInGroup(charts, 'host').some((chart) => chart.hasData)).toBe(true);
  });

  it('prints each unit the way the chart and its legend must agree on', () => {
    expect(formatResourceValue(42.4, 'percent')).toBe('42.4%');
    expect(formatResourceValue(42, 'percent')).toBe('42%');
    expect(formatResourceValue(3.14159, 'decimal')).toBe('3.14');
    expect(formatResourceValue(3.6, 'count')).toBe('4');
    expect(formatResourceValue(1536, 'bytes')).toBe('1.5 KiB');
    expect(formatResourceValue(1024, 'rate')).toBe('1.0 KiB/s');
    expect(formatResourceValue(400_000_000_000, 'linkRate')).toBe('400.0 Gb/s');
    expect(formatResourceValue(Number.NaN, 'percent')).toBe('-');
  });
});

describe('ranking export', () => {
  it('writes the document shape the AC names, with copied values', () => {
    const source = [row('node-a', { node_cpu_utilisation: 0.5, node_pod_running_count: 12 }), row('node-b')];
    const payload = buildNodeUsageExport({
      cluster: 'host',
      metric: 'node_cpu_utilisation',
      order: 'desc',
      generatedAt: '2026-11-18T00:00:00.000Z',
      items: source,
    });
    expect(NODE_USAGE_EXPORT_FILENAME).toBe('node.usage.rank.json');
    expect(payload).toEqual({
      cluster: 'host',
      metric: 'node_cpu_utilisation',
      order: 'desc',
      generatedAt: '2026-11-18T00:00:00.000Z',
      items: [
        { name: 'node-a', values: { node_cpu_utilisation: 0.5, node_pod_running_count: 12 } },
        { name: 'node-b', values: {} },
      ],
    });
    // The export is a snapshot: a later render mutating the row must not rewrite it.
    source[0]!.values.node_cpu_utilisation = 0.99;
    expect(payload.items[0]!.values.node_cpu_utilisation).toBe(0.5);
  });

  it('pages through every rank row instead of exporting the visible page', async () => {
    const calls: number[] = [];
    const rows = await collectRankRows(async (page) => {
      calls.push(page);
      if (page === 1) return { items: [row('n1')], total: 3 };
      if (page === 2) return { items: [row('n2'), row('n3')], total: 3 };
      return { items: [], total: 3 };
    });
    expect(calls).toEqual([1, 2]);
    expect(rows.map((entry) => entry.name)).toEqual(['n1', 'n2', 'n3']);
  });

  it('stops when a backend repeats a page, rather than spinning', async () => {
    const rows = await collectRankRows(async () => ({ items: [row('n1')], total: 5 }));
    expect(rows.map((entry) => entry.name)).toEqual(['n1']);
  });

  it('deduplicates a row that appears on two pages', async () => {
    const rows = await collectRankRows(async (page) =>
      page === 1 ? { items: [row('n1')], total: 2 } : { items: [row('n1'), row('n2')], total: 2 },
    );
    expect(rows.map((entry) => entry.name)).toEqual(['n1', 'n2']);
  });
});
