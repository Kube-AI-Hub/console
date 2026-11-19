/**
 * Data for the cluster monitor's「系统组件」section: APIServer, Scheduler, etcd.
 *
 * The three components share one shape: a component endpoint answers a set of metric
 * names, and each metric is a *family* of series whose identity lives in a label
 * (`verb`, `result`, `quantile`). This module turns that response into per-card lines;
 * the identity merge is done by label, never by array position — the old console took
 * the i-th returned series and paired it with the i-th legend entry, which silently
 * relabels every verb as soon as the backend returns a different set.
 */

import { useQuery } from '@tanstack/react-query';
import { rangeMetricsApi, type ComponentMetricName, type ComponentMetricSeries, type SeriesPoint } from '@kube-ai-hub/api-client';
import type { LocaleKey, Translate } from '@kube-ai-hub/locales';
import { api } from '@/api';
import type { ComponentValueKind } from './monitorFormat';

/** The three component sub-groups, in the order the page renders them. */
export const COMPONENT_GROUPS = ['apiserver', 'scheduler', 'etcd'] as const;

/** Sub-group titles, typed so the page never passes a dynamic key to `t()`. */
export const COMPONENT_TITLES: Record<ComponentMetricName, LocaleKey> = {
  apiserver: 'cluster.monitor.components.apiserver',
  scheduler: 'cluster.monitor.components.scheduler',
  etcd: 'cluster.monitor.components.etcd',
};

export type ComponentIdentity = 'verb' | 'result' | 'quantile';

export interface ComponentChartSpec {
  key: string;
  title: LocaleKey;
  metrics: string[];
  /** Label that distinguishes the lines of a multi-series metric. */
  identity?: ComponentIdentity;
  /** Label for metrics without identity, e.g. the average line or a single series. */
  metricLabels?: Record<string, LocaleKey>;
  kind: ComponentValueKind;
}

/** One line of a component card. `key` is the identity, unique inside the card. */
export interface ComponentLine {
  key: string;
  label: string;
  points: SeriesPoint[];
}

export interface ComponentChart {
  key: string;
  title: LocaleKey;
  kind: ComponentValueKind;
  lines: ComponentLine[];
  /** At least one line has finite samples. False means the card shows the empty state. */
  hasData: boolean;
}

const APISERVER_CHARTS: ComponentChartSpec[] = [
  {
    key: 'requestRate',
    title: 'cluster.monitor.component.requestRate',
    metrics: ['apiserver_request_rate'],
    metricLabels: { apiserver_request_rate: 'cluster.monitor.component.requestRate' },
    kind: 'perSecond',
  },
  {
    key: 'requestRateByVerb',
    title: 'cluster.monitor.component.requestRateByVerb',
    metrics: ['apiserver_request_by_verb_rate'],
    identity: 'verb',
    kind: 'perSecond',
  },
  {
    key: 'requestLatency',
    title: 'cluster.monitor.component.requestLatency',
    // Verb series first, total average last: the order the old console's legend used and
    // the one that reads best (the aggregate is the reference line, not the first thing).
    metrics: ['apiserver_request_by_verb_latencies', 'apiserver_request_latencies'],
    identity: 'verb',
    metricLabels: { apiserver_request_latencies: 'cluster.monitor.series.average' },
    kind: 'milliseconds',
  },
];

const SCHEDULER_CHARTS: ComponentChartSpec[] = [
  {
    key: 'scheduleAttempts',
    title: 'cluster.monitor.component.scheduleAttempts',
    metrics: ['scheduler_schedule_attempts'],
    identity: 'result',
    kind: 'count',
  },
  {
    key: 'scheduleAttemptRate',
    title: 'cluster.monitor.component.scheduleAttemptRate',
    metrics: ['scheduler_schedule_attempt_rate'],
    identity: 'result',
    kind: 'perSecond',
  },
  {
    key: 'scheduleLatency',
    title: 'cluster.monitor.component.scheduleLatency',
    metrics: ['scheduler_e2e_scheduling_latency_quantile', 'scheduler_e2e_scheduling_latency'],
    identity: 'quantile',
    metricLabels: { scheduler_e2e_scheduling_latency: 'cluster.monitor.series.average' },
    kind: 'milliseconds',
  },
];

const ETCD_CHARTS: ComponentChartSpec[] = [
  {
    key: 'dbSize',
    title: 'cluster.monitor.component.dbSize',
    metrics: ['etcd_mvcc_db_size'],
    kind: 'bytes',
  },
  {
    key: 'walFsync',
    title: 'cluster.monitor.component.walFsync',
    metrics: ['etcd_disk_wal_fsync_duration_quantile', 'etcd_disk_wal_fsync_duration'],
    identity: 'quantile',
    metricLabels: { etcd_disk_wal_fsync_duration: 'cluster.monitor.series.average' },
    kind: 'milliseconds',
  },
  {
    key: 'backendCommit',
    title: 'cluster.monitor.component.backendCommit',
    metrics: ['etcd_disk_backend_commit_duration_quantile', 'etcd_disk_backend_commit_duration'],
    identity: 'quantile',
    metricLabels: { etcd_disk_backend_commit_duration: 'cluster.monitor.series.average' },
    kind: 'milliseconds',
  },
  {
    key: 'proposals',
    title: 'cluster.monitor.component.proposals',
    metrics: [
      'etcd_server_proposals_committed_rate',
      'etcd_server_proposals_applied_rate',
      'etcd_server_proposals_failed_rate',
    ],
    metricLabels: {
      etcd_server_proposals_committed_rate: 'cluster.monitor.series.committed',
      etcd_server_proposals_applied_rate: 'cluster.monitor.series.applied',
      etcd_server_proposals_failed_rate: 'cluster.monitor.series.failed',
    },
    kind: 'perSecond',
  },
  {
    // A count, not a rate: the old console drew it inside the RAFT_PROPOSAL per-second
    // chart, which mixed two units on one axis (GOT-…-MONITOR-04).
    key: 'proposalsPending',
    title: 'cluster.monitor.component.proposalsPending',
    metrics: ['etcd_server_proposals_pending_count'],
    metricLabels: { etcd_server_proposals_pending_count: 'cluster.monitor.series.pending' },
    kind: 'count',
  },
  {
    key: 'clientTraffic',
    title: 'cluster.monitor.component.clientTraffic',
    metrics: ['etcd_network_client_grpc_received_bytes', 'etcd_network_client_grpc_sent_bytes'],
    metricLabels: {
      etcd_network_client_grpc_received_bytes: 'cluster.monitor.series.received',
      etcd_network_client_grpc_sent_bytes: 'cluster.monitor.series.sent',
    },
    kind: 'bytesPerSecond',
  },
  {
    key: 'grpcMessages',
    title: 'cluster.monitor.component.grpcMessages',
    metrics: ['etcd_grpc_server_msg_received_rate', 'etcd_grpc_server_msg_sent_rate'],
    metricLabels: {
      etcd_grpc_server_msg_received_rate: 'cluster.monitor.series.received',
      etcd_grpc_server_msg_sent_rate: 'cluster.monitor.series.sent',
    },
    kind: 'perSecond',
  },
];

export const COMPONENT_CHARTS: Record<ComponentMetricName, ComponentChartSpec[]> = {
  apiserver: APISERVER_CHARTS,
  scheduler: SCHEDULER_CHARTS,
  etcd: ETCD_CHARTS,
};

/** Every metric one component request must carry, de-duplicated and in card order. */
export const COMPONENT_METRICS: Record<ComponentMetricName, string[]> = {
  apiserver: [...new Set(APISERVER_CHARTS.flatMap((chart) => chart.metrics))],
  scheduler: [...new Set(SCHEDULER_CHARTS.flatMap((chart) => chart.metrics))],
  etcd: [...new Set(ETCD_CHARTS.flatMap((chart) => chart.metrics))],
};

/** Presentation order per identity; identities not listed keep alphabetical order. */
const IDENTITY_ORDER: Record<ComponentIdentity, string[]> = {
  verb: [],
  result: ['scheduled', 'error', 'unschedulable'],
  quantile: ['0.99', '0.9', '0.5'],
};

function compareIdentity(identity: ComponentIdentity, a: string, b: string): number {
  const order = IDENTITY_ORDER[identity];
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  if (ia !== -1 || ib !== -1) return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib);
  if (identity === 'quantile') return Number.parseFloat(b) - Number.parseFloat(a);
  return a.localeCompare(b);
}

const QUANTILE_LABELS: Record<string, LocaleKey> = {
  '0.99': 'cluster.monitor.series.p99',
  '0.9': 'cluster.monitor.series.p90',
  '0.5': 'cluster.monitor.series.p50',
};

function identityLabel(identity: ComponentIdentity, value: string, t: Translate): string {
  if (identity === 'quantile') {
    const key = QUANTILE_LABELS[value];
    return key ? t(key) : value;
  }
  return value;
}

/**
 * Map one component's returned series onto its cards.
 *
 * Every returned series is keyed by its identity label value, so two verbs never share a
 * line and a missing identity is never inferred from position. A metric with no identity
 * (the total average, a single series) becomes one line labelled by `metricLabels`.
 */
export function toComponentCharts(
  component: ComponentMetricName,
  series: ComponentMetricSeries[],
  t: Translate,
): ComponentChart[] {
  return COMPONENT_CHARTS[component].map((spec) => {
    const lines: ComponentLine[] = [];
    for (const metric of spec.metrics) {
      const matching = series.filter((entry) => entry.metric === metric);
      const identity = spec.identity;
      if (identity) {
        const keyed = matching.filter((entry) => (entry.labels[identity] ?? '') !== '');
        if (keyed.length > 0) {
          keyed.sort((a, b) => compareIdentity(identity, a.labels[identity]!, b.labels[identity]!));
          for (const entry of keyed) {
            const value = entry.labels[identity]!;
            lines.push({ key: identity + ':' + value, label: identityLabel(identity, value, t), points: entry.points });
          }
          continue;
        }
      }
      const first = matching[0];
      if (!first) continue;
      lines.push({ key: metric, label: t(spec.metricLabels?.[metric] ?? spec.title), points: first.points });
    }
    return {
      key: spec.key,
      title: spec.title,
      kind: spec.kind,
      lines,
      hasData: lines.some((line) => line.points.length > 0),
    };
  });
}

export interface ComponentMetricsParams {
  cluster: string;
  component: ComponentMetricName;
  /** Active window key; part of the cache key so two windows never share samples. */
  rangeKey: string;
  /** Epoch milliseconds. */
  start: number;
  end: number;
  step: string;
}

/**
 * One component's series for the page's current window.
 *
 * The query key carries the scope (`cluster`, `component`), the window and the exact
 * range: switching a member cluster or a time window must not serve the previous
 * cluster's samples from the cache.
 */
export function useComponentMetrics(params: ComponentMetricsParams) {
  const metrics = COMPONENT_METRICS[params.component];
  return useQuery({
    queryKey: [
      'cluster-monitor-component',
      params.cluster,
      params.component,
      params.rangeKey,
      params.start,
      params.end,
      params.step,
      metrics,
    ],
    queryFn: ({ signal }) =>
      rangeMetricsApi(api).component({
        cluster: params.cluster,
        component: params.component,
        metrics,
        start: params.start,
        end: params.end,
        step: params.step,
        signal,
      }),
    // A window is historical: refetching it every 30 seconds would re-download the whole
    // window to add one point. The auto-refresh control moves the range, which refetches.
    staleTime: 60_000,
    /*
     * Keep the previous window's points while the new one loads: a rolling window
     * moves on every refresh, so the key changes and the query would otherwise report
     * `pending` with no data — the plot blinked out and back instead of updating.
     */
    placeholderData: (previous) => previous,
    retry: false,
  });
}
