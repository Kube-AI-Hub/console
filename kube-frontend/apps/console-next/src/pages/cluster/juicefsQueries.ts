import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { rangeMetricsApi, type MetricSeries } from '@kube-ai-hub/api-client';
import type { Translate } from '@kube-ai-hub/locales';
import { api as apiClient } from '@/api';

/**
 * JuiceFS shared storage: the data layer.
 *
 * The volume inventory and the cluster totals come from the platform's JuiceFS
 * API (kapis group juicefs.kubesphere.io/v1alpha1), which joins each
 * PersistentVolume with what the client reports: kubelet's statfs numbers, the
 * PV quota, and the nodes that currently mount the volume. The performance
 * series come from the standard monitoring API.
 *
 * Neither read is a plain Kubernetes collection: the join is done server-side,
 * which is why this module exists instead of a resourceApi call.
 */

export interface JuiceFSVolume {
  name: string;
  /** The JuiceFS directory this volume backs, e.g. model-cache/public. */
  path: string;
  /** Set when the directory lives inside another volume. */
  parent: string;
  storageClass: string;
  claimName: string;
  claimNamespace: string;
  capacityBytes: number;
  usedBytes: number;
  inodes: number;
  inodesUsed: number;
  mountedNodes: string[];
  accessModes: string[];
  metricsEnabled: boolean;
  /** The client's reported capacity disagrees with the PV quota by more than 1%. */
  quotaDrift: boolean;
}

export interface JuiceFSSummary {
  volumeCount: number;
  capacityBytes: number;
  usedBytes: number;
  /** 0-1: the fullest volume's usage, which is what "nearly full" means here. */
  maxUsageRatio: number;
  metricsEnabled: boolean;
  /** Nodes that run a JuiceFS client for this cluster. */
  storageNodes: string[];
}

/** A volume row joined with the PV that backs it: phase and creation time. */
export interface JuiceFSVolumeRow extends JuiceFSVolume {
  phase: string;
  createdAt: string;
}

export const JUICEFS_GROUP = 'juicefs.kubesphere.io/v1alpha1';

/**
 * One JuiceFS API path.
 *
 * The group is served only on host ks-apiserver. A member cluster is addressed
 * with `?cluster=`, not `/kapis/clusters/<id>/`, which would proxy to a member
 * ks-apiserver that does not serve juicefs.kubesphere.io.
 */
export function juicefsApiPath(_cluster: string, suffix: string): string {
  return '/kapis/' + JUICEFS_GROUP + suffix;
}

export function juicefsQuery(cluster: string): Record<string, string> | undefined {
  return cluster ? { cluster } : undefined;
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

function textList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry)) : [];
}

function toVolume(item: Record<string, unknown>): JuiceFSVolume {
  return {
    name: text(item['name']),
    path: text(item['path']),
    parent: text(item['parent']),
    storageClass: text(item['storageClass']),
    claimName: text(item['claimName']),
    claimNamespace: text(item['claimNamespace']),
    capacityBytes: number(item['capacityBytes']),
    usedBytes: number(item['usedBytes']),
    inodes: number(item['inodes']),
    inodesUsed: number(item['inodesUsed']),
    mountedNodes: textList(item['mountedNodes']),
    accessModes: textList(item['accessModes']),
    metricsEnabled: item['metricsEnabled'] === true,
    quotaDrift: item['quotaDrift'] === true,
  };
}

/** The volumes and the cluster totals, as the JuiceFS API reports them. */
export function useJuiceFSVolumes(cluster: string) {
  return useQuery({
    queryKey: ['juicefs-volumes', cluster],
    queryFn: async ({ signal }) => {
      const body = await apiClient.request<{ items?: Array<Record<string, unknown>> }>(juicefsApiPath(cluster, '/volumes'), {
        query: juicefsQuery(cluster),
        signal,
      });
      return (body?.items ?? []).map(toVolume);
    },
  });
}

export function useJuiceFSSummary(cluster: string) {
  return useQuery({
    queryKey: ['juicefs-summary', cluster],
    queryFn: async ({ signal }) => {
      const body = await apiClient.request<Record<string, unknown>>(juicefsApiPath(cluster, '/summary'), {
        query: juicefsQuery(cluster),
        signal,
      });
      const value = body ?? {};
      return {
        volumeCount: number(value['volumeCount']),
        capacityBytes: number(value['capacityBytes']),
        usedBytes: number(value['usedBytes']),
        maxUsageRatio: number(value['maxUsageRatio']),
        metricsEnabled: value['metricsEnabled'] === true,
        storageNodes: textList(value['storageNodes']),
      } satisfies JuiceFSSummary;
    },
  });
}

/**
 * PV phase and creation time, indexed by name.
 *
 * The JuiceFS API identifies a volume by the name of the PV that backs it and
 * does not repeat the PV's own metadata, so the list joins one cluster-scoped
 * read. A separate query key is deliberate: the persistent-volume page caches a
 * different shape under its own key, and sharing it would hand one of the two
 * pages the other's rows.
 */
export function useJuiceFSPersistentVolumes(cluster: string) {
  return useQuery({
    queryKey: ['juicefs-persistentvolumes', cluster],
    queryFn: async ({ signal }) => {
      const path =
        cluster && cluster !== 'host'
          ? '/kapis/resources.kubesphere.io/v1alpha3/clusters/' + encodeURIComponent(cluster) + '/persistentvolumes'
          : '/kapis/resources.kubesphere.io/v1alpha3/persistentvolumes';
      const body = await apiClient.request<{
        items?: Array<{ metadata?: { name?: string; creationTimestamp?: string }; status?: { phase?: string } }>;
      }>(path, { query: { limit: -1 }, signal });
      const index = new Map<string, { phase: string; createdAt: string }>();
      for (const item of body?.items ?? []) {
        const name = item.metadata?.name;
        if (!name) continue;
        index.set(name, { phase: text(item.status?.phase), createdAt: text(item.metadata?.creationTimestamp) });
      }
      return index;
    },
  });
}

/* ---------------- Performance ---------------- */

export type PerformanceKind = 'throughput' | 'ratio' | 'seconds' | 'perSecond' | 'count';

/**
 * The client metrics the performance tab shows.
 *
 * The names are the ones the platform registers for JuiceFS; the unit of each is
 * not in the payload, so it is declared here. Two of them bit the old console:
 * throughput is bytes (a bandwidth conversion would be 8x off), and latency is
 * seconds, not milliseconds.
 *
 * juicefs_cpu_usage is deliberately absent: the series is a cumulative counter
 * (about 32000 after a day), not a rate, and plotting it as a gauge would show a
 * number that only ever grows.
 */
export const PERFORMANCE_METRICS = [
  { metric: 'juicefs_read_bytes', labelKey: 'cluster.juicefs.metric.read', kind: 'throughput' },
  { metric: 'juicefs_written_bytes', labelKey: 'cluster.juicefs.metric.write', kind: 'throughput' },
  { metric: 'juicefs_cache_hit_ratio', labelKey: 'cluster.juicefs.metric.cacheHit', kind: 'ratio' },
  { metric: 'juicefs_cache_read_latency', labelKey: 'cluster.juicefs.metric.cacheReadLatency', kind: 'seconds' },
  { metric: 'juicefs_fuse_latency', labelKey: 'cluster.juicefs.metric.fuseLatency', kind: 'seconds' },
  { metric: 'juicefs_fuse_ops', labelKey: 'cluster.juicefs.metric.fuseOps', kind: 'perSecond' },
  { metric: 'juicefs_meta_latency', labelKey: 'cluster.juicefs.metric.metaLatency', kind: 'seconds' },
  { metric: 'juicefs_object_errors', labelKey: 'cluster.juicefs.metric.objectErrors', kind: 'perSecond' },
  { metric: 'juicefs_object_uploading', labelKey: 'cluster.juicefs.metric.objectUploading', kind: 'count' },
] as const;

export type PerformanceRange = '1h' | '6h' | '24h';

/**
 * Windows the tab offers.
 *
 * The step is chosen so each window stays near 60 points; asking for a day at
 * 60-second resolution would be 1440 points per metric over the wire and would
 * render as a smear.
 */
export const PERFORMANCE_RANGES: Record<PerformanceRange, { ms: number; step: string }> = {
  '1h': { ms: 60 * 60 * 1000, step: '60s' },
  '6h': { ms: 6 * 60 * 60 * 1000, step: '5m' },
  '24h': { ms: 24 * 60 * 60 * 1000, step: '15m' },
};

export const PERFORMANCE_METRIC_NAMES = PERFORMANCE_METRICS.map((entry) => entry.metric);

export function useJuiceFSPerformance(cluster: string, range: PerformanceRange, enabled: boolean) {
  const window = PERFORMANCE_RANGES[range];
  /*
   * Resolved once per window selection, not per render: end: Date.now() in the
   * query key would change on every paint and refetch forever.
   */
  const interval = React.useMemo(() => {
    const end = Math.floor(Date.now() / 1000) * 1000;
    return { start: end - window.ms, end };
  }, [range, window.ms]);

  return useQuery({
    queryKey: ['juicefs-performance', cluster, range, interval.start, interval.end],
    enabled,
    // A trend window is historical; refetching every 30 seconds would re-download
    // the window to add one point.
    staleTime: 60_000,
    retry: false,
    queryFn: ({ signal }): Promise<MetricSeries[]> =>
      rangeMetricsApi(apiClient).cluster({
        cluster,
        metrics: PERFORMANCE_METRIC_NAMES,
        start: interval.start,
        end: interval.end,
        step: window.step,
        signal,
      }),
  });
}

/* ---------------- Formatting (pure, shared by the tabs) ---------------- */

/** Binary units: every number on this page is bytes from statfs or a quota. */
export function formatBytes(bytes: number, precision = 1): string {
  const value = Number(bytes) || 0;
  if (value <= 0) return '0';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  let index = 0;
  let scaled = value;
  while (scaled >= 1024 && index < units.length - 1) {
    scaled /= 1024;
    index += 1;
  }
  return scaled.toFixed(index >= 3 ? precision : 0) + ' ' + units[index];
}

/** Used capacity as a 0-100 percentage; an unknown capacity is 0, not NaN. */
export function usagePercent(used: number, capacity: number): number {
  if (!capacity || capacity <= 0) return 0;
  return Math.min(100, Math.max(0, (Number(used) / Number(capacity)) * 100));
}

/** The tone a usage bar takes at a percentage: the same bands everywhere. */
export function usageLevel(percent: number): 'safe' | 'warning' | 'error' {
  if (percent >= 90) return 'error';
  if (percent >= 80) return 'warning';
  return 'safe';
}

/** The bar fill class for a usage level, kept next to the bands. */
export function usageBarClass(percent: number): string {
  switch (usageLevel(percent)) {
    case 'error':
      return 'bg-ai-danger';
    case 'warning':
      return 'bg-ai-warning';
    default:
      return 'bg-ai-accent';
  }
}

/**
 * One metric value in the unit the metric actually uses.
 *
 * The API carries no unit, so the mapping lives with the metric list above.
 * Cache hit ratio is shown as the API reports it (the old console's chart did the
 * same); the others are rates, so the label says per second rather than implying
 * an absolute count.
 */
export function formatMetricValue(kind: PerformanceKind, value: number, t: Translate): string {
  switch (kind) {
    case 'throughput':
      // A zero rate is '0 B/s', not '0/s': the unit matters more than the digit.
      return (value > 0 ? formatBytes(value) : '0 B') + '/s';
    case 'ratio':
      return value.toFixed(1) + ' %';
    case 'seconds':
      return (value * 1000).toFixed(2) + ' ms';
    case 'perSecond':
      return value.toFixed(2) + ' ' + t('cluster.juicefs.perSecond');
    case 'count':
      return String(Math.round(value));
  }
}
