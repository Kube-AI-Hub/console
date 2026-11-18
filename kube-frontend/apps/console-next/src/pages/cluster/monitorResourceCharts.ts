import type { MetricSeries } from '@kube-ai-hub/api-client';
import type { LocaleKey, Translate } from '@kube-ai-hub/locales';
import type { TrendSeries } from '@kube-ai-hub/ui';
import { formatBytes, formatBytesPerSecond } from './monitorFormat';

/**
 * The physical-resource tab's chart catalogue and its pure mapping functions.
 *
 * The old console rendered about thirty separate cards in one flat column. The same
 * facts are kept here, grouped the way the old panel grouped them (GPU, host, disk,
 * network, RDMA), but several facts that used to be one card each are now one chart
 * with one line per series: load 1/5/15 on one scale, disk read/write on one scale,
 * pod states on one scale. A set of separate sparklines makes the reader compare
 * shapes by eye; one multi-line chart makes the comparison the chart's job.
 *
 * Everything in this module is pure so the grouping, the identity merge and the unit
 * formatting can be asserted without mounting a chart. The component renders from
 * these specs; it never invents a metric or a label of its own.
 */

/** The groups, in the order the old console's physical-resource page showed them. */
export const RESOURCE_GROUPS = ['gpu', 'host', 'disk', 'network', 'rdma'] as const;

export type ResourceGroup = (typeof RESOURCE_GROUPS)[number];

/** Group headings; the host translates them. */
export const RESOURCE_GROUP_TITLE_KEYS: Record<ResourceGroup, LocaleKey> = {
  gpu: 'cluster.monitor.group.gpu',
  host: 'cluster.monitor.group.host',
  disk: 'cluster.monitor.group.disk',
  network: 'cluster.monitor.group.network',
  rdma: 'cluster.monitor.group.rdma',
};

/**
 * How one chart prints its numbers.
 *
 * A unit is part of the data contract: a rate printed as a count, or a 0..1 ratio
 * printed as 0.37%, still looks like a number. The chart's `formatValue` and the
 * legend's current value both go through {@link formatResourceValue}.
 */
export type ResourceChartKind = 'percent' | 'count' | 'decimal' | 'bytes' | 'rate' | 'linkRate';

/** One line of a chart. `scale` converts a ratio the API reports as 0..1 into a percentage. */
export interface ResourceSeriesSpec {
  key: string;
  labelKey: LocaleKey;
  metric: string;
  scale?: number;
}

/** One chart: a title, a unit and one or more metric-backed lines. */
export interface ResourceChartSpec {
  /** Chart key, e.g. `gpuMemory`; the page renders `cluster-monitor:resource:chart:<group>:<key>`. */
  key: string;
  group: ResourceGroup;
  titleKey: LocaleKey;
  kind: ResourceChartKind;
  series: readonly ResourceSeriesSpec[];
}

/**
 * The 18 charts of the physical-resource tab.
 *
 * Metric names follow the old console's cluster monitor and the monitoring backend we
 * measured against; the identity of each line is a label in this file, never the array
 * position of the response.
 */
export const RESOURCE_CHARTS: readonly ResourceChartSpec[] = [
  // --- GPU ---------------------------------------------------------------
  {
    key: 'gpuMemory',
    group: 'gpu',
    titleKey: 'cluster.monitor.gpuMemory',
    kind: 'percent',
    series: [{ key: 'gpuMemory', labelKey: 'cluster.monitor.gpuMemory', metric: 'cluster_gpu_memory_utilisation', scale: 100 }],
  },
  {
    key: 'gpuUtilization',
    group: 'gpu',
    titleKey: 'cluster.monitor.gpuUtilization',
    kind: 'percent',
    series: [{ key: 'gpuUtilization', labelKey: 'cluster.monitor.gpuUtilization', metric: 'cluster_gpu_utilization', scale: 100 }],
  },
  {
    key: 'gpuAllocated',
    group: 'gpu',
    titleKey: 'cluster.monitor.gpuAllocated',
    kind: 'count',
    series: [{ key: 'gpuAllocated', labelKey: 'cluster.monitor.gpuAllocated', metric: 'cluster_gpu_allocated' }],
  },
  // --- Host resources -----------------------------------------------------
  {
    key: 'cpu',
    group: 'host',
    titleKey: 'cluster.monitor.cpu',
    kind: 'percent',
    series: [{ key: 'cpu', labelKey: 'cluster.monitor.cpu', metric: 'cluster_cpu_utilisation', scale: 100 }],
  },
  {
    key: 'memory',
    group: 'host',
    titleKey: 'cluster.monitor.memory',
    kind: 'percent',
    series: [{ key: 'memory', labelKey: 'cluster.monitor.memory', metric: 'cluster_memory_utilisation', scale: 100 }],
  },
  {
    key: 'load',
    group: 'host',
    titleKey: 'cluster.monitor.resource.load',
    kind: 'decimal',
    series: [
      { key: 'load1', labelKey: 'cluster.monitor.load1', metric: 'cluster_load1' },
      { key: 'load5', labelKey: 'cluster.monitor.load5', metric: 'cluster_load5' },
      { key: 'load15', labelKey: 'cluster.monitor.load15', metric: 'cluster_load15' },
    ],
  },
  {
    key: 'diskUsage',
    group: 'host',
    titleKey: 'cluster.monitor.disk',
    kind: 'bytes',
    series: [{ key: 'diskUsage', labelKey: 'cluster.monitor.disk', metric: 'cluster_disk_size_usage' }],
  },
  {
    key: 'inode',
    group: 'host',
    titleKey: 'cluster.monitor.inode',
    kind: 'percent',
    series: [{ key: 'inode', labelKey: 'cluster.monitor.inode', metric: 'cluster_disk_inode_utilisation', scale: 100 }],
  },
  {
    key: 'pods',
    group: 'host',
    titleKey: 'cluster.monitor.resource.podStatus',
    kind: 'count',
    series: [
      { key: 'running', labelKey: 'cluster.monitor.series.running', metric: 'cluster_pod_running_count' },
      { key: 'completed', labelKey: 'cluster.monitor.series.completed', metric: 'cluster_pod_succeeded_count' },
      { key: 'abnormal', labelKey: 'cluster.monitor.series.abnormal', metric: 'cluster_pod_abnormal_count' },
    ],
  },
  // --- Disk I/O -----------------------------------------------------------
  {
    key: 'throughput',
    group: 'disk',
    titleKey: 'cluster.monitor.resource.diskThroughput',
    kind: 'rate',
    series: [
      { key: 'read', labelKey: 'cluster.monitor.series.read', metric: 'cluster_disk_read_throughput' },
      { key: 'write', labelKey: 'cluster.monitor.series.write', metric: 'cluster_disk_write_throughput' },
    ],
  },
  {
    key: 'iops',
    group: 'disk',
    titleKey: 'cluster.monitor.resource.iops',
    kind: 'decimal',
    series: [
      { key: 'read', labelKey: 'cluster.monitor.series.read', metric: 'cluster_disk_read_iops' },
      { key: 'write', labelKey: 'cluster.monitor.series.write', metric: 'cluster_disk_write_iops' },
    ],
  },
  // --- Network ------------------------------------------------------------
  {
    key: 'traffic',
    group: 'network',
    titleKey: 'cluster.monitor.resource.networkTraffic',
    kind: 'rate',
    series: [
      { key: 'tx', labelKey: 'cluster.monitor.series.tx', metric: 'cluster_net_bytes_transmitted' },
      { key: 'rx', labelKey: 'cluster.monitor.series.rx', metric: 'cluster_net_bytes_received' },
    ],
  },
  // --- RDMA / InfiniBand ---------------------------------------------------
  {
    key: 'health',
    group: 'rdma',
    titleKey: 'cluster.monitor.rdmaHealth',
    kind: 'percent',
    series: [{ key: 'health', labelKey: 'cluster.monitor.rdmaHealth', metric: 'cluster_ib_health', scale: 100 }],
  },
  {
    key: 'ports',
    group: 'rdma',
    titleKey: 'cluster.monitor.rdmaPorts',
    kind: 'count',
    series: [
      { key: 'portUp', labelKey: 'cluster.monitor.series.portUp', metric: 'cluster_ib_port_up' },
      { key: 'portTotal', labelKey: 'cluster.monitor.series.portTotal', metric: 'cluster_ib_port_total' },
    ],
  },
  {
    key: 'throughput',
    group: 'rdma',
    titleKey: 'cluster.monitor.resource.rdmaThroughput',
    kind: 'rate',
    series: [
      { key: 'tx', labelKey: 'cluster.monitor.series.tx', metric: 'cluster_ib_tx_bytes' },
      { key: 'rx', labelKey: 'cluster.monitor.series.rx', metric: 'cluster_ib_rx_bytes' },
    ],
  },
  {
    key: 'linkSpeed',
    group: 'rdma',
    titleKey: 'cluster.monitor.rdmaLinkSpeed',
    kind: 'linkRate',
    series: [{ key: 'linkSpeed', labelKey: 'cluster.monitor.rdmaLinkSpeed', metric: 'cluster_ib_link_speed' }],
  },
  {
    key: 'errors',
    group: 'rdma',
    titleKey: 'cluster.monitor.resource.rdmaErrors',
    kind: 'count',
    series: [
      { key: 'rxErrors', labelKey: 'cluster.monitor.rdmaRxErrors', metric: 'cluster_ib_rx_errors' },
      { key: 'retrans', labelKey: 'cluster.monitor.rdmaRetrans', metric: 'cluster_ib_retrans' },
      { key: 'discards', labelKey: 'cluster.monitor.rdmaDiscards', metric: 'cluster_ib_discards' },
    ],
  },
  {
    key: 'linkDowned',
    group: 'rdma',
    titleKey: 'cluster.monitor.rdmaLinkDowned',
    kind: 'count',
    series: [{ key: 'linkDowned', labelKey: 'cluster.monitor.rdmaLinkDowned', metric: 'cluster_ib_link_downed' }],
  },
];

/**
 * Every metric one physical-resource request must carry.
 *
 * The tab asks once for all of them: one request per chart would multiply the load and
 * let two charts disagree about the same instant. Order is the spec order so the query
 * key is stable, and duplicates are removed.
 */
export const RESOURCE_METRICS: readonly string[] = Array.from(
  new Set(RESOURCE_CHARTS.flatMap((chart) => chart.series.map((line) => line.metric))),
);

/** One chart with its data merged by metric name. */
export interface ResourceChart {
  spec: ResourceChartSpec;
  series: TrendSeries[];
  /** At least one line has samples. False means the chart renders its empty explanation. */
  hasData: boolean;
}

/** Series of a range response, keyed by metric name. */
export function seriesByName(series: readonly MetricSeries[]): ReadonlyMap<string, MetricSeries> {
  const map = new Map<string, MetricSeries>();
  for (const entry of series) map.set(entry.name, entry);
  return map;
}

/**
 * Merge a range response onto the chart catalogue.
 *
 * A metric the backend did not return is skipped, not drawn as zeros: a missing RDMA
 * series means "this cluster has no RDMA monitoring", and a line at 0 would claim the
 * fabric is idle. A chart whose every metric is missing becomes `hasData: false` and
 * renders the empty explanation instead of an empty plot.
 */
export function toResourceCharts(series: readonly MetricSeries[], t: Translate): ResourceChart[] {
  const byName = seriesByName(series);
  return RESOURCE_CHARTS.map((spec) => {
    const lines: TrendSeries[] = [];
    for (const line of spec.series) {
      const found = byName.get(line.metric);
      if (!found || found.points.length === 0) continue;
      const scale = line.scale ?? 1;
      lines.push({
        key: line.key,
        label: t(line.labelKey),
        points: scale === 1
          ? found.points
          : found.points.map((point) => ({ at: point.at, value: point.value * scale })),
      });
    }
    return { spec, series: lines, hasData: lines.some((line) => line.points.length > 0) };
  });
}

/** The charts of one group, in catalogue order. */
export function chartsInGroup(charts: readonly ResourceChart[], group: ResourceGroup): ResourceChart[] {
  return charts.filter((chart) => chart.spec.group === group);
}

/** Print one resource value with its unit. Shared by the axis, the readout and the legend. */
export function formatResourceValue(value: number, kind: ResourceChartKind): string {
  if (!Number.isFinite(value)) return '-';
  switch (kind) {
    case 'percent': {
      /*
       * One decimal matters where the axis range is tiny (a GPU at 0–1% draws
       * 1% / 0.5% / 0%, not 1% / 1% / 0%).
       */
      const rounded = Math.round(value * 10) / 10;
      return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
    }
    case 'count':
      return String(Math.round(value));
    case 'decimal':
      return value.toFixed(2);
    case 'bytes':
      return formatBytes(value);
    case 'rate':
      return `${formatBytesPerSecond(value)}/s`;
    case 'linkRate':
      return `${(value / 1e9).toFixed(1)} Gb/s`;
  }
}
