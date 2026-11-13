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

