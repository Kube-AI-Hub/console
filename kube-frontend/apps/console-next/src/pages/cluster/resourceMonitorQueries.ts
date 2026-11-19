import { useQuery } from '@tanstack/react-query';
import { resolveRange, type TimeRange } from '@kube-ai-hub/ui/charts';
import { api } from '@/api';

/**
 * Data for 应用资源监控: pod usage over a time window, aggregated per pod or per workload.
 *
 * The monitoring API has a cluster-wide `/pods` collection but no cluster-wide
 * `/workloads` collection (the usable workloads endpoint is namespaced). The
 * workload tab therefore aggregates pod usage by the pod's owner. A Deployment's
 * pods are owned by a ReplicaSet, so a cluster-wide ReplicaSet read resolves that
 * one hop back to the Deployment; StatefulSet and DaemonSet pods already name their
 * workload directly.
 *
 * Everything is a **range** query: the range selector changes the window and each
 * row is the mean over it. An instant sample would make the selector meaningless.
 */

/**
 * The presets this page offers.
 *
 * The window arithmetic itself lives in ai-kit (`charts/timeRange`), shared with the
 * other monitoring surfaces: two copies would sample the same hour differently
 * depending on which page asked.
 */
export const RESOURCE_RANGES = [
  { key: '1h', ms: 3_600_000, step: '60s' },
  { key: '6h', ms: 6 * 3_600_000, step: '5m' },
  { key: '24h', ms: 24 * 3_600_000, step: '15m' },
  { key: '7d', ms: 7 * 24 * 3_600_000, step: '2h' },
] as const;

export type ResourceRangeKey = (typeof RESOURCE_RANGES)[number]['key'];

/** One pod's average usage over the selected window. */
export interface PodUsage {
  namespace: string;
  pod: string;
  /** `ReplicaSet` / `StatefulSet` / `DaemonSet` / `Node` / empty for a bare pod. */
  ownerKind: string;
  ownerName: string;
  /** Average CPU in cores. */
  cpu: number;
  /** Average memory in bytes. */
  memory: number;
}

/** One row of either tab: a workload or a pod, with its usage. */
export interface ResourceUsageRow {
  key: string;
  name: string;
  namespace: string;
  /** `Deployment` / `StatefulSet` / `DaemonSet` / `Pod` / `ReplicaSet` (unresolved). */
  kind: string;
  /** Average CPU in cores. */
  cpu: number;
  /** Average memory in bytes. */
  memory: number;
}

interface MonitoringRangeBody {
  results?: Array<{
    metric_name?: string;
    data?: {
      resultType?: string;
      result?: Array<{ metric?: Record<string, string>; values?: Array<[number, string]> }>;
    };
  }>;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Pod CPU and memory, averaged over one window.
 *
 * `limit: -1` asks for every pod on the cluster: a ranking that only saw the first
 * page of pods would quietly omit the busiest ones. The response is a matrix (one
 * series per pod), which is what makes the range selector honest.
 */
export function usePodUsage(cluster: string, range: TimeRange) {
  const resolved = resolveRange(range);
  const rangeKey = range.kind === 'relative' ? range.key : 'custom';
  return useQuery({
    queryKey: ['resource-monitor-pods', cluster, rangeKey, resolved.start, resolved.end],
    queryFn: async ({ signal }): Promise<PodUsage[]> => {
      const end = Math.floor(resolved.end / 1000);
      const start = Math.floor(resolved.start / 1000);
      const body = await api.request<MonitoringRangeBody>('/kapis/monitoring.kubesphere.io/v1alpha3/pods', {
        query: {
          cluster,
          limit: -1,
          metrics_filter: 'pod_cpu_usage$|pod_memory_usage_wo_cache$',
          start,
          end,
          step: resolved.step,
        },
        signal,
      });

      const byPod = new Map<string, PodUsage>();
      const entry = (namespace: string, pod: string): PodUsage => {
        const key = namespace + '/' + pod;
        const existing = byPod.get(key);
        if (existing) return existing;
        const created: PodUsage = { namespace, pod, ownerKind: '', ownerName: '', cpu: 0, memory: 0 };
        byPod.set(key, created);
        return created;
      };

      for (const result of body?.results ?? []) {
        const metric = result.metric_name;
        if (metric !== 'pod_cpu_usage' && metric !== 'pod_memory_usage_wo_cache') continue;
        for (const series of result.data?.result ?? []) {
          const labels = series.metric ?? {};
          const namespace = labels['namespace'] ?? '';
          const pod = labels['pod'] ?? '';
          if (!namespace || !pod) continue;
          const samples: number[] = [];
          for (const [, raw] of series.values ?? []) {
            const parsed = Number.parseFloat(raw);
            if (Number.isFinite(parsed)) samples.push(parsed);
          }
          if (samples.length === 0) continue;
          const row = entry(namespace, pod);
          if (!row.ownerKind) {
            row.ownerKind = labels['owner_kind'] ?? '';
            row.ownerName = labels['owner_name'] ?? '';
          }
          if (metric === 'pod_cpu_usage') row.cpu = mean(samples);
          else row.memory = mean(samples);
        }
      }

      return [...byPod.values()];
    },
    // A window average is historical; refetching it every few seconds would download
    // the whole window again to change the last point.
    staleTime: 60_000,
    retry: false,
  });
}

interface KubeReplicaSet {
  metadata?: {
    name?: string;
    namespace?: string;
    ownerReferences?: Array<{ kind?: string; name?: string }>;
  };
}

/**
 * ReplicaSet name → Deployment name, for the one ownership hop a pod's labels skip.
 *
 * The pods metrics label a Deployment pod with its ReplicaSet, and the kapis
 * resources proxy does not serve `replicasets`; the plain kube API does, and one
 * cluster-wide read is cheaper than a request per project.
 */
export function useReplicaSetOwners(cluster: string, enabled: boolean) {
  return useQuery({
    queryKey: ['resource-monitor-owners', cluster],
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async ({ signal }): Promise<ReadonlyMap<string, string>> => {
      const body = await api.request<{ items?: KubeReplicaSet[] }>('/apis/apps/v1/replicasets', { signal });
      const owners = new Map<string, string>();
      for (const item of body?.items ?? []) {
        const namespace = item.metadata?.namespace ?? '';
        const name = item.metadata?.name ?? '';
        const deployment = item.metadata?.ownerReferences?.find((owner) => owner.kind === 'Deployment')?.name;
        if (namespace && name && deployment) owners.set(namespace + '/' + name, deployment);
      }
      return owners;
    },
  });
}

/**
 * Aggregate pods into workload rows.
 *
 * Static mirror pods (`owner_kind: Node`) are skipped: they duplicate what the
 * kubelet already reports and are not a workload anyone deploys. A bare pod becomes
 * its own row, because it is a real consumer of CPU and memory and dropping it would
 * make the ranking understate the project.
 */
export function toWorkloadRows(pods: PodUsage[], owners: ReadonlyMap<string, string>): ResourceUsageRow[] {
  const rows = new Map<string, ResourceUsageRow>();
  for (const pod of pods) {
    let kind = pod.ownerKind;
    let name = pod.ownerName;
    if (kind === 'Node') continue;
    if (kind === 'ReplicaSet') {
      const deployment = owners.get(pod.namespace + '/' + name);
      if (deployment) {
        kind = 'Deployment';
        name = deployment;
      }
    }
    if (!kind || !name) {
      kind = 'Pod';
      name = pod.pod;
    }
    const key = kind + ':' + pod.namespace + '/' + name;
    const existing = rows.get(key);
    if (existing) {
      existing.cpu += pod.cpu;
      existing.memory += pod.memory;
      continue;
    }
    rows.set(key, { key, name, namespace: pod.namespace, kind, cpu: pod.cpu, memory: pod.memory });
  }
  return [...rows.values()];
}

export function toPodRows(pods: PodUsage[]): ResourceUsageRow[] {
  return pods.map((pod) => ({
    key: 'Pod:' + pod.namespace + '/' + pod.pod,
    name: pod.pod,
    namespace: pod.namespace,
    kind: 'Pod',
    cpu: pod.cpu,
    memory: pod.memory,
  }));
}
