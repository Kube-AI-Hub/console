import type { Client } from './client';
import type { KubeObject } from './resources';

/**
 * The cluster console's overview data.
 *
 * Two sources, and they answer different questions:
 *
 * - The `cluster` object (`cluster.kubesphere.io/v1alpha1`) describes **what the
 *   cluster is**: its provider, its Kubernetes and KubeSphere versions, whether it is
 *   ready, and — in `status.configz` — which optional modules the installation has
 *   enabled. This is register-once information that changes only when someone
 *   reinstalls something.
 * - The monitoring API describes **how busy it is**. Those numbers change every
 *   scrape and can be missing entirely when no monitoring backend is installed, which
 *   is a different answer from "zero".
 *
 * The old console's overview reads both and shows them side by side; the point of the
 * page is that an administrator can see "this cluster is healthy" and "these modules are
 * on" without opening two other pages.
 */

/** One `cluster.kubesphere.io` object, as far as this app reads it. */
export interface ClusterDetail {
  name: string;
  /** Whether the object is enabled for use, from `spec.enable`. */
  enabled: boolean;
  /** Free-text provider, e.g. a cloud name or `Kube AI Hub`. */
  provider: string;
  /** `direct` / `proxy` — how the platform reaches this cluster. */
  connectionType: string;
  /** API endpoint recorded in the spec; the cluster's own address. */
  kubernetesAPIEndpoint: string;
  /** From `status.kubernetesVersion`. */
  kubernetesVersion: string;
  /** From `status.kubeSphereVersion`. */
  kubeSphereVersion: string;
  /** Node count the controller reports. */
  nodeCount: number;
  /**
   * Healthy only when the controller's `Ready` condition says `True`.
   *
   * Reading the absence of a condition as "healthy" would call a cluster that has
   * never been reconciled fine.
   */
  ready: boolean;
  /** Why it is or is not ready — the condition message, which is the actionable part. */
  readyMessage: string;
  /** `status.configz`, sorted by key: which optional modules are installed. */
  modules: ClusterModule[];
  /** The description annotation, when the platform wrote one. */
  description: string;
}

export interface ClusterModule {
  key: string;
  enabled: boolean;
}

const DESCRIPTION_ANNOTATION = 'kubesphere.io/description';

interface KubeCluster extends KubeObject {
  spec?: {
    enable?: boolean;
    provider?: string;
    connection?: { type?: string; kubernetesAPIEndpoint?: string };
  };
  status?: {
    kubernetesVersion?: string;
    kubeSphereVersion?: string;
    nodeCount?: number;
    conditions?: Array<{ type?: string; status?: string; reason?: string; message?: string }>;
    configz?: Record<string, boolean>;
  };
}

export function toClusterDetail(cluster: KubeCluster): ClusterDetail {
  const readyCondition = (cluster.status?.conditions ?? []).find((c) => c.type === 'Ready');
  const configz = cluster.status?.configz ?? {};
  return {
    name: cluster.metadata?.name ?? '',
    enabled: cluster.spec?.enable !== false,
    provider: cluster.spec?.provider ?? '',
    connectionType: cluster.spec?.connection?.type ?? '',
    kubernetesAPIEndpoint: cluster.spec?.connection?.kubernetesAPIEndpoint ?? '',
    kubernetesVersion: cluster.status?.kubernetesVersion ?? '',
    kubeSphereVersion: cluster.status?.kubeSphereVersion ?? '',
    nodeCount: cluster.status?.nodeCount ?? 0,
    ready: readyCondition?.status === 'True',
    /*
     * Reason first: a condition that is False usually carries both, and `reason` is the
     * short machine-ish label while `message` is the sentence. The old console shows the
     * message; fall back to the reason rather than leaving the field empty.
     */
    readyMessage: readyCondition?.message ?? readyCondition?.reason ?? '',
    modules: Object.entries(configz)
      .map(([key, enabled]) => ({ key, enabled: enabled === true }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    description: cluster.metadata?.annotations?.[DESCRIPTION_ANNOTATION] ?? '',
  };
}

/* ------------------------------------------------------------------ *
 * Metrics.
 * ------------------------------------------------------------------ */

/**
 * One value from a KubeSphere monitoring response.
 *
 * The shape is Prometheus's, wrapped: `results[]` carries one entry per requested
 * metric, and each entry's `data.result` holds a sample with a `value` pair of
 * [timestamp, string]. The strings are Prometheus's own format (`0.0611`,
 * `1.234e+10`), so callers parse rather than assume.
 */
interface MonitoringResponse {
  results?: Array<{
    metric_name?: string;
    data?: { result?: Array<{ metric?: Record<string, string>; value?: [number, string] }> };
  }>;
}

/** The cluster-level numbers the overview shows. */
export interface ClusterUsage {
  /** Cores in use, sum across nodes. */
  cpuUsedCores: number;
  /** Cores available. */
  cpuTotalCores: number;
  /** Requested (allocated) cores, which is what scheduling acts on. */
  cpuAllocatedCores: number;
  memoryUsedBytes: number;
  memoryTotalBytes: number;
  memoryAllocatedBytes: number;
  podRunning: number;
  podCapacity: number;
  nodeReady: number;
  nodeTotal: number;
  /** GPU cards reserved by workloads, and how many the cluster has in total. */
  gpuAllocated: number;
  gpuTotal: number;
  /** Fraction 0–1 of GPU compute in use right now, when the cluster reports it. */
  gpuUtilisation: number | undefined;
}

/**
 * Cluster metrics, from the KubeSphere monitoring API.
 *
 * `monitoring.kubesphere.io` is used rather than `metrics.k8s.io`: many installations
 * (B200 among them) have no metrics-server exposed through the apiserver, but still run
 * a Prometheus backing the KubeSphere dashboard. Asking the wrong one returns 404 and
 * the overview would show a permanent "no metrics".
 */
export function clusterMetricsApi(client: Client) {
  const METRICS = [
    'cluster_cpu_usage',
    'cluster_cpu_total',
    'cluster_cpu_allocated',
    'cluster_memory_usage_wo_cache',
    'cluster_memory_total',
    'cluster_memory_allocated',
    'cluster_pod_running_count',
    'cluster_pod_quota',
    'cluster_node_total',
    'cluster_node_online',
    'cluster_gpu_utilization',
    'cluster_gpu_usage',
    'cluster_gpu_allocated',
    'cluster_gpu_total',
  ];

  return {
    async usage(params: { cluster: string; signal?: AbortSignal }): Promise<ClusterUsage> {
      /*
       * One request for every metric: the comma-separated filter is part of the
       * monitoring API, and a request per metric would be a dozen round trips for one
       * panel.
       */
      const body = await client.request<MonitoringResponse>(
        '/kapis/monitoring.kubesphere.io/v1alpha3/cluster',
        {
          query: { metrics_filter: METRICS.map((m) => `${m}$`).join('|'), cluster: params.cluster },
          ...(params.signal ? { signal: params.signal } : {}),
        },
      );
      const values = toMetricValues(body);
      return {
        cpuUsedCores: values.get('cluster_cpu_usage') ?? 0,
        cpuTotalCores: values.get('cluster_cpu_total') ?? 0,
        cpuAllocatedCores: values.get('cluster_cpu_allocated') ?? 0,
        memoryUsedBytes: values.get('cluster_memory_usage_wo_cache') ?? 0,
        memoryTotalBytes: values.get('cluster_memory_total') ?? 0,
        memoryAllocatedBytes: values.get('cluster_memory_allocated') ?? 0,
        podRunning: values.get('cluster_pod_running_count') ?? 0,
        podCapacity: values.get('cluster_pod_quota') ?? 0,
        nodeReady: values.get('cluster_node_online') ?? 0,
        nodeTotal: values.get('cluster_node_total') ?? 0,
        gpuAllocated: values.get('cluster_gpu_allocated') ?? 0,
        gpuTotal: values.get('cluster_gpu_total') ?? 0,
        gpuUtilisation: values.get('cluster_gpu_utilization'),
      };
    },
  };
}

/**
 * Flatten a monitoring response into metric name → number.
 *
 * A cluster-level metric is a single series, so the first sample is the answer. A
 * metric the backend does not have at all is **absent** from the map, not zero: the
 * caller distinguishes "GPU utilisation is 0%" from "this cluster has no GPUs".
 */
export function toMetricValues(body: MonitoringResponse | undefined): Map<string, number> {
  const out = new Map<string, number>();
  for (const result of body?.results ?? []) {
    const name = result.metric_name;
    const sample = result.data?.result?.[0]?.value?.[1];
    if (!name || sample === undefined) continue;
    const parsed = Number.parseFloat(sample);
    if (Number.isFinite(parsed)) out.set(name, parsed);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * The `cluster` object.
 * ------------------------------------------------------------------ */

export function clusterApi(client: Client) {
  return {
    /**
     * One cluster by name.
     *
     * Read through `kapis`, the same path the cluster list uses: on B200 the
     * `resources` proxy has been observed to omit recently created objects, and a
     * detail page that disagrees with the list is worse than a slow one.
     */
    async get(params: { cluster: string; signal?: AbortSignal }): Promise<ClusterDetail> {
      const body = await client.request<KubeCluster>(
        `/kapis/cluster.kubesphere.io/v1alpha1/clusters/${encodeURIComponent(params.cluster)}`,
        params.signal ? { signal: params.signal } : {},
      );
      return toClusterDetail(body ?? {});
    },
  };
}
/* ------------------------------------------------------------------ *
 * Kubernetes control-plane health.
 * ------------------------------------------------------------------ */

/**
 * How the control plane itself is doing.
 *
 * The old console's dashboard answers this with three numbers from the
 * `apiserver` and `scheduler` component metric groups. They are separate from cluster
 * usage because they describe a different failure mode: a cluster can have plenty of
 * free capacity and still be unable to schedule anything.
 */
export interface KubernetesStatus {
  /** Requests per second the API server is serving. */
  requestRate: number | undefined;
  /** Mean request latency in seconds, as Prometheus reports it. */
  requestLatencySeconds: number | undefined;
  /** Scheduling attempts that produced a binding. */
  scheduled: number | undefined;
  /** Scheduling attempts that found no node able to take the pod. */
  unschedulable: number | undefined;
}

export function componentMetricsApi(client: Client) {
  /** One component group, flattened to metric-name → sample list. */
  async function read(params: {
    component: string;
    metrics: string[];
    cluster: string;
    signal?: AbortSignal;
  }): Promise<Map<string, Array<{ labels: Record<string, string>; value: number }>>> {
    const body = await client.request<MonitoringResponse>(
      `/kapis/monitoring.kubesphere.io/v1alpha3/components/${encodeURIComponent(params.component)}`,
      {
        query: { metrics_filter: params.metrics.map((m) => `${m}$`).join('|'), cluster: params.cluster },
        ...(params.signal ? { signal: params.signal } : {}),
      },
    );
    const out = new Map<string, Array<{ labels: Record<string, string>; value: number }>>();
    for (const result of body?.results ?? []) {
      const name = result.metric_name;
      if (!name) continue;
      const samples: Array<{ labels: Record<string, string>; value: number }> = [];
      for (const sample of result.data?.result ?? []) {
        const raw = sample.value?.[1];
        if (raw === undefined) continue;
        const parsed = Number.parseFloat(raw);
        if (!Number.isFinite(parsed)) continue;
        samples.push({ labels: sample.metric ?? {}, value: parsed });
      }
      out.set(name, samples);
    }
    return out;
  }

  return {
    async kubernetesStatus(params: { cluster: string; signal?: AbortSignal }): Promise<KubernetesStatus> {
      /*
       * Two requests, not one: the API server and the scheduler are different metric
       * groups, and asking one component for the other's metrics returns an empty set
       * rather than an error.
       */
      const [api, scheduler] = await Promise.all([
        read({ component: 'apiserver', metrics: ['apiserver_request_latencies', 'apiserver_request_rate'], ...params }),
        read({ component: 'scheduler', metrics: ['scheduler_schedule_attempts'], ...params }),
      ]);
      const attempt = (result: string) =>
        scheduler.get('scheduler_schedule_attempts')?.find((sample) => sample.labels['result'] === result)?.value;
      return {
        requestRate: api.get('apiserver_request_rate')?.[0]?.value,
        requestLatencySeconds: api.get('apiserver_request_latencies')?.[0]?.value,
        scheduled: attempt('scheduled'),
        unschedulable: attempt('unschedulable'),
      };
    },
  };
}


/* ------------------------------------------------------------------ *
 * Writing the cluster object.
 * ------------------------------------------------------------------ */

/**
 * The editable half of a cluster object.
 *
 * Only the description for now. The old console's 集群设置 also edits group labels,
 * region/zone and the provider, but those are platform-installation fields: the
 * installer writes them, and offering them here would let a click silently disagree
 * with what the installer believes.
 *
 * Writes go to `/apis/cluster.kubesphere.io/v1alpha1`, not kapis: the kapis endpoint
 * answers 400 `wrong resource GroupVersionKind` to a patch (measured on B200), while the
 * native group accepts it.
 */
export function clusterWriteApi(client: Client) {
  return {
    /**
     * Set or clear the description annotation.
     *
     * A merge patch deletes a key when its value is `null` and **leaves it unchanged when
     * the key is absent** (RFC 7386). Clearing a description therefore has to send
     * `null` explicitly — sending an empty map does nothing, which is exactly how the
     * "saved but nothing changed" class of bug looked in the ConfigMap editor.
     */
    async setDescription(params: { cluster: string; description: string }): Promise<void> {
      const value = params.description.trim();
      await client.request(
        `/apis/cluster.kubesphere.io/v1alpha1/clusters/${encodeURIComponent(params.cluster)}`,
        {
          method: 'PATCH',
          contentType: 'application/merge-patch+json',
          body: { metadata: { annotations: { [DESCRIPTION_ANNOTATION]: value === '' ? null : value } } },
        },
      );
    },
  };
}


/* ------------------------------------------------------------------ *
 * Range queries (trends).
 * ------------------------------------------------------------------ */

/** One point in a series: epoch seconds and the value at that moment. */
export interface SeriesPoint {
  /** Epoch milliseconds, so a chart can label an axis without converting twice. */
  at: number;
  value: number;
}

export interface MetricSeries {
  /** Metric name as requested, e.g. `cluster_cpu_usage`. */
  name: string;
  points: SeriesPoint[];
}

/**
 * Time-series reads from the same monitoring API as the current values.
 *
 * The difference is `start`/`end`/`step`: the API answers `matrix` instead of
 * `vector`, and each sample carries an array of [timestamp, value] pairs. A trend
 * view that asked for `last` would plot a single point and call it a chart.
 */
export function rangeMetricsApi(client: Client) {
  return {
    async cluster(params: {
      cluster: string;
      metrics: string[];
      /** Epoch milliseconds. */
      start: number;
      end: number;
      /** Prometheus duration, e.g. `60s`. */
      step: string;
      scope?: 'cluster' | 'node' | 'namespace';
      node?: string;
      namespace?: string;
      signal?: AbortSignal;
    }): Promise<MetricSeries[]> {
      const body = await client.request<{
        results?: Array<{
          metric_name?: string;
          data?: {
            resultType?: string;
            result?: Array<{ metric?: Record<string, string>; values?: Array<[number, string]> }>;
          };
        }>;
      }>(`/kapis/monitoring.kubesphere.io/v1alpha3/${params.scope ?? 'cluster'}`, {
        query: {
          metrics_filter: params.metrics.map((metric) => `${metric}$`).join('|'),
          start: Math.round(params.start / 1000),
          end: Math.round(params.end / 1000),
          step: params.step,
          cluster: params.cluster,
          ...(params.node ? { node: params.node } : {}),
          ...(params.namespace ? { namespace: params.namespace } : {}),
        },
        ...(params.signal ? { signal: params.signal } : {}),
      });

      const out: MetricSeries[] = [];
      for (const result of body?.results ?? []) {
        const name = result.metric_name;
        // A range answer is `matrix`; a `vector` here means the backend ignored the
        // range parameters, and plotting it as one point is more honest than
        // pretending it is a trend.
        const series = result.data?.result ?? [];
        const points: SeriesPoint[] = [];
        for (const sample of series) {
          for (const [at, value] of sample.values ?? []) {
            const parsed = Number.parseFloat(value);
            if (!Number.isFinite(parsed)) continue;
            points.push({ at: at * 1000, value: parsed });
          }
        }
        if (!name || points.length === 0) continue;
        points.sort((a, b) => a.at - b.at);
        out.push({ name, points });
      }
      return out;
    },
  };
}

export type RangeMetricsApi = ReturnType<typeof rangeMetricsApi>;


/* ------------------------------------------------------------------ *
 * Node usage (ranking).
 * ------------------------------------------------------------------ */

/** One node's current utilisation, as the monitoring API reports it. */
export interface NodeUsage {
  name: string;
  /** CPU busy fraction 0–1, as the API reports it. */
  cpu: number;
  memory: number;
  disk: number;
  /** Containers running on the node. */
  pods: number;
}

/**
 * Current utilisation per node.
 *
 * The API reports these as **fractions** (`0.061`), not percentages — a value shown
 * as-is would read as "0.06%" on a node that is 6% busy. The multiplication to a
 * percentage happens in the mapper so no page can forget it.
 */
export function nodeUsageApi(client: Client) {
  const METRICS = [
    'node_cpu_utilisation',
    'node_memory_utilisation',
    'node_disk_size_utilisation',
    'node_pod_running_count',
  ];

  return {
    async list(params: { cluster: string; signal?: AbortSignal }): Promise<NodeUsage[]> {
      const body = await client.request<{
        results?: Array<{
          metric_name?: string;
          data?: { result?: Array<{ metric?: Record<string, string>; value?: [number, string] }> };
        }>;
      }>('/kapis/monitoring.kubesphere.io/v1alpha3/nodes', {
        query: {
          metrics_filter: METRICS.map((metric) => `${metric}$`).join('|'),
          cluster: params.cluster,
          limit: -1,
        },
        ...(params.signal ? { signal: params.signal } : {}),
      });

      const byNode = new Map<string, NodeUsage>();
      const entry = (node: string): NodeUsage => {
        const existing = byNode.get(node);
        if (existing) return existing;
        const created: NodeUsage = { name: node, cpu: 0, memory: 0, disk: 0, pods: 0 };
        byNode.set(node, created);
        return created;
      };

      for (const result of body?.results ?? []) {
        const metric = result.metric_name;
        for (const sample of result.data?.result ?? []) {
          const node = sample.metric?.['node'];
          const raw = sample.value?.[1];
          if (!node || raw === undefined) continue;
          const value = Number.parseFloat(raw);
          if (!Number.isFinite(value)) continue;
          const row = entry(node);
          if (metric === 'node_cpu_utilisation') row.cpu = value * 100;
          if (metric === 'node_memory_utilisation') row.memory = value * 100;
          if (metric === 'node_disk_size_utilisation') row.disk = value * 100;
          if (metric === 'node_pod_running_count') row.pods = value;
        }
      }

      return [...byNode.values()].sort((a, b) => a.name.localeCompare(b.name));
    },
  };
}

export type NodeUsageApi = ReturnType<typeof nodeUsageApi>;


/* ------------------------------------------------------------------ *
 * Custom resource definitions.
 * ------------------------------------------------------------------ */

/** One CRD, flattened to what the list shows. */
export interface CustomResourceSummary {
  /** `metadata.name`, the full `<plural>.<group>` form. */
  name: string;
  /** `spec.names.kind`, e.g. `RuleGroup`. */
  kind: string;
  group: string;
  /** Versions the CRD serves, storage version first. */
  versions: string[];
  /** `Cluster` or `Namespaced`. */
  scope: string;
  /** Whether users can create instances of it (deprecated CRDs cannot). */
  served: boolean;
  createdAt: string;
}

interface KubeCrd extends KubeObject {
  spec?: {
    group?: string;
    scope?: string;
    names?: { kind?: string; plural?: string; singular?: string };
    versions?: Array<{ name?: string; served?: boolean; storage?: boolean }>;
  };
}

export function toCustomResourceSummary(crd: KubeCrd): CustomResourceSummary {
  const versions = crd.spec?.versions ?? [];
  return {
    name: crd.metadata?.name ?? '',
    kind: crd.spec?.names?.kind ?? '',
    group: crd.spec?.group ?? '',
    /*
     * Storage version first, then the rest in declaration order: the storage version
     * is the one the API server round-trips through, so it is what a reader looking at
     * a mismatch wants to see first.
     */
    versions: [...versions]
      .sort((a, b) => Number(b.storage === true) - Number(a.storage === true))
      .map((version) => version.name ?? '')
      .filter(Boolean),
    scope: crd.spec?.scope ?? '',
    served: versions.some((version) => version.served !== false),
    createdAt: crd.metadata?.creationTimestamp ?? '',
  };
}

/**
 * CRD list.
 *
 * Read through the real apiextensions group rather than the resources proxy: this is
 * the authoritative list of what the cluster can serve, and the proxy has been seen to
 * lag on other resources. `served` is derived from the versions, because a CRD whose
 * every version is unserved still exists and still appears in the list.
 */
export function customResourcesApi(client: Client) {
  return {
    async list(params: { cluster: string; signal?: AbortSignal }): Promise<{
      items: CustomResourceSummary[];
      total: number;
    }> {
      const body = await client.request<{ items?: KubeCrd[] }>(
        '/apis/apiextensions.k8s.io/v1/customresourcedefinitions',
        {
          query: { limit: -1 },
          ...(params.signal ? { signal: params.signal } : {}),
        },
      );
      const items = (body?.items ?? []).map(toCustomResourceSummary);
      return { items, total: items.length };
    },
  };
}

export type CustomResourcesApi = ReturnType<typeof customResourcesApi>;

