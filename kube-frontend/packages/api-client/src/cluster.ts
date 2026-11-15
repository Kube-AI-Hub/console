import type { Client } from './client';
import type { KubeObject } from './resources';

/**
 * The cluster console's overview data.
 *
 * Two sources, and they answer different questions:
 *
 * - The `cluster` object (`cluster.kubesphere.io/v1alpha1`) describes **what the
 *   cluster is**: its provider, its Kubernetes and Kube AI Hub versions, whether it is
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
  /** `public` or `private`; private is the platform default when the label is absent. */
  visibility: string;
  /** `kubesphere.io/alias-name`; the list shows it instead of the name when set. */
  alias: string;
  /** `cluster.kubesphere.io/group` label, e.g. `production`. */
  group: string;
}

export interface ClusterModule {
  key: string;
  enabled: boolean;
}

const DESCRIPTION_ANNOTATION = 'kubesphere.io/description';
const ALIAS_ANNOTATION = 'kubesphere.io/alias-name';
/** The platform's preset tags. The label carries the value, not a free-text tag. */
const GROUP_LABEL = 'cluster.kubesphere.io/group';
/** Public clusters are visible to every enterprise space; private ones only to those granted. */
const VISIBILITY_LABEL = 'cluster.kubesphere.io/visibility';
/** Preset tags the old console offers in 编辑信息. */
export const CLUSTER_GROUPS = ['production', 'development', 'testing'] as const;
export type ClusterGroup = (typeof CLUSTER_GROUPS)[number];
/** Providers the old console offers; the field also accepts anything typed. */
export const CLUSTER_PROVIDERS = [
  'Kube AI Hub',
  'Aliyun ACK',
  'Azure Kubernetes Service',
  'Amazon EKS',
  'Google GKE',
  'Tencent TKE',
  'Huawei CCE',
  'Bare Metal',
] as const;

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
    visibility: cluster.metadata?.labels?.[VISIBILITY_LABEL] ?? 'private',
    alias: cluster.metadata?.annotations?.[ALIAS_ANNOTATION] ?? '',
    group: cluster.metadata?.labels?.[GROUP_LABEL] ?? '',
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
  cpuUsedCores: number | undefined;
  /** Cores available. */
  cpuTotalCores: number | undefined;
  /** Requested (allocated) cores, which is what scheduling acts on. */
  cpuAllocatedCores: number | undefined;
  memoryUsedBytes: number | undefined;
  memoryTotalBytes: number | undefined;
  memoryAllocatedBytes: number | undefined;
  podRunning: number | undefined;
  podCapacity: number | undefined;
  nodeReady: number | undefined;
  nodeTotal: number | undefined;
  /** GPU cards reserved by workloads, and how many the cluster has in total. */
  gpuAllocated: number | undefined;
  gpuTotal: number | undefined;
  gpuUsed: number | undefined;
  gpuMemoryUsedBytes: number | undefined;
  gpuMemoryTotalBytes: number | undefined;
  diskUsedBytes: number | undefined;
  diskTotalBytes: number | undefined;
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
    'cluster_gpu_memory_usage',
    'cluster_gpu_memory_total',
    'cluster_disk_size_usage',
    'cluster_disk_size_capacity',
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
        cpuUsedCores: values.get('cluster_cpu_usage'),
        cpuTotalCores: values.get('cluster_cpu_total'),
        cpuAllocatedCores: values.get('cluster_cpu_allocated'),
        memoryUsedBytes: values.get('cluster_memory_usage_wo_cache'),
        memoryTotalBytes: values.get('cluster_memory_total'),
        memoryAllocatedBytes: values.get('cluster_memory_allocated'),
        podRunning: values.get('cluster_pod_running_count'),
        podCapacity: values.get('cluster_pod_quota'),
        nodeReady: values.get('cluster_node_online'),
        nodeTotal: values.get('cluster_node_total'),
        gpuAllocated: values.get('cluster_gpu_allocated'),
        gpuTotal: values.get('cluster_gpu_total'),
        gpuUsed: values.get('cluster_gpu_usage'),
        gpuMemoryUsedBytes: values.get('cluster_gpu_memory_usage'),
        gpuMemoryTotalBytes: values.get('cluster_gpu_memory_total'),
        diskUsedBytes: values.get('cluster_disk_size_usage'),
        diskTotalBytes: values.get('cluster_disk_size_capacity'),
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
  error: number | undefined;
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
        error: attempt('error'),
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

    /**
     * The 编辑信息 fields: alias, tag, provider, description.
     *
     * Every field is a merge patch against the object, and empty means "delete this key":
     * an absent key leaves the old value alone (RFC 7386), so clearing an alias by simply
     * not sending it is a no-op that looks saved. The three editable metadata slots use
     * `null` to remove the entry; `spec.provider` is a plain string, so an empty string
     * is the correct way to clear it.
     */
    async updateBasicInfo(params: {
      cluster: string;
      alias: string;
      group: string;
      provider: string;
      description: string;
    }): Promise<void> {
      const trimmed = {
        alias: params.alias.trim(),
        group: params.group.trim(),
        provider: params.provider.trim(),
        description: params.description.trim(),
      };
      await client.request(
        `/apis/cluster.kubesphere.io/v1alpha1/clusters/${encodeURIComponent(params.cluster)}`,
        {
          method: 'PATCH',
          contentType: 'application/merge-patch+json',
          body: {
            metadata: {
              annotations: {
                [ALIAS_ANNOTATION]: trimmed.alias === '' ? null : trimmed.alias,
                [DESCRIPTION_ANNOTATION]: trimmed.description === '' ? null : trimmed.description,
              },
              labels: { [GROUP_LABEL]: trimmed.group === '' ? null : trimmed.group },
            },
            spec: { provider: trimmed.provider },
          },
        },
      );
    },

    /**
     * Set the cluster's visibility.
     *
     * A label, not a CR: the platform reads `cluster.kubesphere.io/visibility` to decide whether
     * enterprise space can see the cluster. Merge patch on that one key, because the same
     * object carries the workspace label and the role label.
     */
    async setVisibility(params: { cluster: string; visibility: 'public' | 'private' }): Promise<void> {
      await client.request(`/apis/cluster.kubesphere.io/v1alpha1/clusters/${encodeURIComponent(params.cluster)}`, {
        method: 'PATCH',
        contentType: 'application/merge-patch+json',
        body: { metadata: { labels: { [VISIBILITY_LABEL]: params.visibility } } },
      });
    },

    /**
     * Remove a member cluster from the platform — the old console's 「移除集群」.
     *
     * Deletes the `Cluster` object only. The member cluster itself and the resources on
     * it are untouched: the platform stops managing it, which is what "remove" means here
     * and what the old console's warning says. The host cluster cannot be removed (every
     * other page would lose its cluster), which the UI enforces before reaching this call.
     */
    async remove(params: { cluster: string }): Promise<void> {
      await client.request(`/apis/cluster.kubesphere.io/v1alpha1/clusters/${encodeURIComponent(params.cluster)}`, {
        method: 'DELETE',
      });
    },

    /**
     * Replace a direct-connected cluster's kubeconfig.
     *
     * `PUT /kapis/cluster.kubesphere.io/v1alpha1/clusters/<name>/kubeconfig`, base64 in the
     * body — the same shape the old console sends (and the only write that kapis accepts;
     * the collection itself takes writes through the native group).
     *
     * A proxy-connected cluster has no kubeconfig to replace: the agent dials out, so the
     * UI hides this action rather than offering one that cannot succeed.
     */
    async updateKubeconfig(params: { cluster: string; kubeconfig: string }): Promise<void> {
      const kubeconfig = params.kubeconfig.trim();
      if (!kubeconfig) throw new Error('kubeconfig is required');
      await client.request(`/kapis/cluster.kubesphere.io/v1alpha1/clusters/${encodeURIComponent(params.cluster)}/kubeconfig`, {
        method: 'PUT',
        body: { kubeconfig: btoa(unescape(encodeURIComponent(kubeconfig))) },
      });
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

/** Arguments every range read shares. */
interface RangeQuery {
  cluster: string;
  metrics: string[];
  /** Epoch milliseconds. */
  start: number;
  end: number;
  /** Prometheus duration, e.g. `60s`. */
  step: string;
  signal?: AbortSignal;
}

/**
 * The workload kinds that have **workload-level** monitoring metrics.
 *
 * The API turns the path kind segment into a label selector
 * workload=~"<Kind>:(<filter>)"; the documented values are the singular
 * deployment / statefulset / daemonset, and anything else falls through to "every
 * kind" (promql.go makeWorkloadMetricExpr). The app speaks the plural resource
 * names, so that mapping lives here rather than being re-derived by each caller.
 */
export const METRIC_WORKLOAD_KINDS = ['deployments', 'statefulsets', 'daemonsets'] as const;
export type MetricWorkloadKind = (typeof METRIC_WORKLOAD_KINDS)[number];

const WORKLOAD_KIND_SEGMENT: Record<MetricWorkloadKind, string> = {
  deployments: 'deployment',
  statefulsets: 'statefulset',
  daemonsets: 'daemonset',
};

/**
 * Escape a workload name for the API's `resources_filter`.
 *
 * The server embeds the filter into workload=~"<Kind>:(<filter>)", so anchors in
 * the filter can never match: they would have to sit after the server's own
 * `<Kind>:` prefix. Escaping the name is enough to keep regex metacharacters in a
 * resource name — a dot, say — from matching a different workload.
 */
function escapeResourceFilter(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Time-series reads from the monitoring API (range queries).
 *
 * Three scopes matter to the console so far: the cluster/node/namespace one used by
 * the monitoring pages, one workload's series for the detail monitor tab, and one
 * pod's series for the same tab. All three share the request and the matrix→points
 * parsing; only the path and the extra selector differ.
 */
export function rangeMetricsApi(client: Client) {
  async function query(
    pathname: string,
    params: RangeQuery,
    extra: Record<string, string | number | undefined> = {},
    expectedLabels: Record<string, string> = {},
  ): Promise<MetricSeries[]> {
    const body = await client.request<{
      results?: Array<{
        metric_name?: string;
        data?: {
          resultType?: string;
          result?: Array<{ metric?: Record<string, string>; values?: Array<[number, string]> }>;
        };
      }>;
    }>(pathname, {
      query: {
        metrics_filter: params.metrics.map((metric) => `${metric}$`).join('|'),
        start: Math.round(params.start / 1000),
        end: Math.round(params.end / 1000),
        step: params.step,
        cluster: params.cluster,
        ...extra,
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
        if (!Object.entries(expectedLabels).every(([key, value]) => sample.metric?.[key] === value)) continue;
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
  }

  return {
    async gpuCard(params: RangeQuery & { node: string; uuid: string }): Promise<MetricSeries[]> {
      const pathname = `/kapis/monitoring.kubesphere.io/v1alpha3/nodes/${encodeURIComponent(params.node)}`;
      return query(pathname, params, { gpu_uuid: params.uuid }, { node: params.node, uuid: params.uuid });
    },
    async cluster(
      params: RangeQuery & {
        scope?: 'cluster' | 'node' | 'namespace';
        node?: string;
        namespace?: string;
      },
    ): Promise<MetricSeries[]> {
      const scope = params.scope === 'node' && params.node ? `nodes/${encodeURIComponent(params.node)}` : (params.scope ?? 'cluster');
      return query(`/kapis/monitoring.kubesphere.io/v1alpha3/${scope}`, params, {
        ...(params.node ? { node: params.node } : {}),
        ...(params.namespace ? { namespace: params.namespace } : {}),
      });
    },

    /**
     * One workload's CPU/memory series.
     *
     * The numbers are the `namespace:workload_*_usage:sum` recording rules, i.e. the
     * server has already summed the workload's pods — which is what the detail page
     * means by "aggregated over its pods". Summing pod series here would download a
     * series per pod only to add them up again.
     */
    async workload(
      params: RangeQuery & { namespace: string; kind: MetricWorkloadKind; workload: string },
    ): Promise<MetricSeries[]> {
      const pathname = `/kapis/monitoring.kubesphere.io/v1alpha3/namespaces/${encodeURIComponent(
        params.namespace,
      )}/workloads/${WORKLOAD_KIND_SEGMENT[params.kind]}`;
      return query(pathname, params, { resources_filter: escapeResourceFilter(params.workload) });
    },

    /** One pod's CPU/memory series. */
    async pod(params: RangeQuery & { namespace: string; pod: string }): Promise<MetricSeries[]> {
      const pathname = `/kapis/monitoring.kubesphere.io/v1alpha3/namespaces/${encodeURIComponent(
        params.namespace,
      )}/pods/${encodeURIComponent(params.pod)}`;
      return query(pathname, params);
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
  /** Whether any version is still served (an unserved CRD cannot be created). */
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
     * Storage version first, then the rest in declaration order: the storage version is
     * the one the API server round-trips through, so it is what a reader looking at a
     * version mismatch wants to see first.
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

/** One instance (custom resource) of a CRD. */
export interface CustomResourceInstance {
  name: string;
  namespace: string;
  createdAt: string;
}

/** A CRD's definition, as the detail view needs it. */
export interface CustomResourceDetail extends CustomResourceSummary {
  /** Plural name used in the URL path. */
  plural: string;
  /** Version used for reads: the storage version, else the first served one. */
  readVersion: string;
}

interface KubeCrdFull extends KubeCrd {
  spec?: KubeCrd["spec"] & { names?: { kind?: string; plural?: string } };
}

function toCustomResourceDetail(crd: KubeCrdFull): CustomResourceDetail {
  const summary = toCustomResourceSummary(crd);
  const versions = crd.spec?.versions ?? [];
  /*
   * Reads go through one version. The storage version is the one the API server
   * round-trips, so it is the safest choice; falling back to the first served version
   * covers CRDs where nothing is marked storage (a transient state during an upgrade).
   */
  const storage = versions.find((version) => version.storage === true)?.name;
  const served = versions.find((version) => version.served !== false)?.name;
  return {
    ...summary,
    plural: crd.spec?.names?.plural ?? '',
    readVersion: storage ?? served ?? '',
  };
}

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

    async get(params: { name: string; cluster: string; signal?: AbortSignal }): Promise<CustomResourceDetail> {
      const body = await client.request<KubeCrdFull>(
        `/apis/apiextensions.k8s.io/v1/customresourcedefinitions/${encodeURIComponent(params.name)}`,
        params.signal ? { signal: params.signal } : {},
      );
      return toCustomResourceDetail(body ?? {});
    },

    /**
     * Instances of one CRD.
     *
     * The path is built from the definition itself (`/apis/<group>/<version>/<plural>`):
     * a custom resource has no fixed endpoint, so this is the only way to list them.
     * A CRD whose group or plural is missing cannot be read at all — that is reported as
     * an empty list rather than a malformed request.
     */
    async instances(params: {
      crd: CustomResourceDetail;
      cluster: string;
      signal?: AbortSignal;
    }): Promise<{ items: CustomResourceInstance[]; total: number }> {
      const { group, readVersion, plural } = params.crd;
      if (!group || !readVersion || !plural) return { items: [], total: 0 };
      const body = await client.request<{ items?: Array<KubeObject> }>(
        `/apis/${encodeURIComponent(group)}/${encodeURIComponent(readVersion)}/${encodeURIComponent(plural)}`,
        {
          query: { limit: -1 },
          ...(params.signal ? { signal: params.signal } : {}),
        },
      );
      const items = (body?.items ?? []).map((item) => ({
        name: item.metadata?.name ?? '',
        namespace: item.metadata?.namespace ?? '',
        createdAt: item.metadata?.creationTimestamp ?? '',
      }));
      return { items, total: items.length };
    },
  };
}

export type CustomResourcesApi = ReturnType<typeof customResourcesApi>;

/** One row of the platform's cluster list. */
export interface ClusterSummary {
  name: string;
  /** Whether the object is enabled for use. */
  enabled: boolean;
  provider: string;
  kubernetesVersion: string;
  kubeSphereVersion: string;
  nodeCount: number;
  ready: boolean;
  /** Why it is or is not ready — the actionable half of the status. */
  readyMessage: string;
  /** Where the platform reaches the cluster's API server. */
  endpoint: string;
  createdAt: string;
  /** Shown instead of the name when set (the old console's `showNameAndAlias`). */
  alias: string;
  /** Preset tag from the `cluster.kubesphere.io/group` label. */
  group: string;
  /** `direct` / `proxy` — how the platform reaches this cluster. */
  connectionType: string;
  /** The description annotation; editable from the list's 编辑信息. */
  description: string;
  /**
   * True for the cluster that hosts the platform itself.
   *
   * Read from the `cluster-role.kubesphere.io/host` label — the marker the federation
   * writes and the old console filters on. Not inferred from the name: a member cluster
   * may legitimately be called `host`.
   */
  isHost: boolean;
}

/** A cluster object flattened for the list. */
export function toClusterSummary(cluster: KubeCluster): ClusterSummary {
  const detail = toClusterDetail(cluster);
  return {
    name: detail.name,
    enabled: detail.enabled,
    provider: detail.provider,
    kubernetesVersion: detail.kubernetesVersion,
    kubeSphereVersion: detail.kubeSphereVersion,
    nodeCount: detail.nodeCount,
    ready: detail.ready,
    readyMessage: detail.readyMessage,
    endpoint: detail.kubernetesAPIEndpoint,
    createdAt: cluster.metadata?.creationTimestamp ?? '',
    alias: detail.alias,
    group: detail.group,
    connectionType: detail.connectionType,
    description: detail.description,
    isHost: cluster.metadata?.labels?.['cluster-role.kubesphere.io/host'] !== undefined,
  };
}

/**
 * The platform's cluster list.
 *
 * Read through kapis, like the cluster detail page: the `resources` proxy has been
 * observed to omit recently created objects, and a list that disagrees with the
 * detail page is worse than a slow one.
 */
/**
 * Import an existing cluster by its kubeconfig.
 *
 * This is the "import" half of the old console's 添加集群 (`cluster.add`), which also
 * offers provisioning a new cluster through KubeKey. Provisioning needs the kubekey API
 * and a set of hosts; importing needs only the kubeconfig a member cluster is joined
 * with, so only that is offered here.
 *
 * The console encodes the kubeconfig with `btoa` before sending it: the field is
 * base64 in the object, and sending the YAML as-is produces a cluster that never
 * connects back. `spec.joinFederation` is what makes the member cluster appear in the
 * platform's federation.
 */
/** How the platform reaches a member cluster. */
export type ClusterConnectionMode = 'direct' | 'proxy';

/** The object body 添加集群 posts, shared by validation and creation. */
export function clusterImportBody(params: {
  name: string;
  mode: ClusterConnectionMode;
  kubeconfig?: string;
  provider?: string;
  /** Friendly name; the old console's basic-information step collects it up front. */
  alias?: string;
  description?: string;
}): Record<string, unknown> {
  const connection: Record<string, unknown> = { type: params.mode };
  if (params.mode === 'direct') {
    const kubeconfig = (params.kubeconfig ?? '').trim();
    if (!kubeconfig) throw new Error('kubeconfig is required for a direct connection');
    // Base64 in the object: the field is not YAML, and sending YAML produces a cluster
    // that never connects back (the old console's `safeBtoa` exists for this).
    connection['kubeconfig'] = btoa(unescape(encodeURIComponent(kubeconfig)));
  }
  // Proxy mode carries **no** kubeconfig key at all: the agent dials out, and a stale
  // kubeconfig left in the spec would be read as a direct connection.
  /*
   * Alias and description travel as annotations, which is where the platform reads them
   * from afterwards (the list, the switcher, 编辑信息). Setting them now rather than after
   * creation keeps the two entry points from disagreeing: a cluster created without an
   * alias and renamed a second later is the same object either way.
   */
  const annotations: Record<string, string> = {};
  if (params.alias?.trim()) annotations[ALIAS_ANNOTATION] = params.alias.trim();
  if (params.description?.trim()) annotations[DESCRIPTION_ANNOTATION] = params.description.trim();

  return {
    apiVersion: 'cluster.kubesphere.io/v1alpha1',
    kind: 'Cluster',
    metadata: {
      name: params.name.trim(),
      ...(Object.keys(annotations).length ? { annotations } : {}),
    },
    spec: {
      provider: params.provider?.trim() ?? '',
      connection,
      joinFederation: true,
    },
  };
}

/**
 * Import an existing cluster, either directly or through the agent.
 *
 * This is the import half of the old console's 添加集群 (`cluster.add`): provisioning a
 * brand-new cluster with KubeKey needs the kubekey API and a host inventory, which this
 * installation does not have.
 *
 * The two modes differ in one visible way: a direct connection must carry a kubeconfig
 * and the platform verifies it before the object is created; a proxy connection carries
 * none, because the member cluster installs an agent that dials out.
 */
export function clusterImportApi(client: Client) {
  return {
    async import(params: {
      name: string;
      mode: ClusterConnectionMode;
      kubeconfig?: string;
      provider?: string;
      alias?: string;
      description?: string;
    }): Promise<void> {
      await client.request('/apis/cluster.kubesphere.io/v1alpha1/clusters', {
        method: 'POST',
        body: clusterImportBody(params),
      });
    },

    /**
     * Ask the platform whether it can reach the cluster this object describes.
     *
     * The old console runs this before creating a direct cluster, so a wrong kubeconfig
     * is reported instead of producing a cluster that never becomes ready. A proxy
     * cluster has nothing to reach yet and skips it.
     */
    async validate(params: {
      name: string;
      mode: ClusterConnectionMode;
      kubeconfig?: string;
      provider?: string;
      alias?: string;
      description?: string;
    }): Promise<void> {
      await client.request('/kapis/cluster.kubesphere.io/v1alpha1/clusters/validation', {
        method: 'POST',
        body: clusterImportBody(params),
      });
    },
  };
}

/**
 * Whether the installation runs as a federation of clusters.
 *
 * The old console reads `ksConfig.multicluster`, injected by its server. This app has no
 * server-rendered config, so it asks the same endpoint the old server asked:
 * `/kapis/config.kubesphere.io/v1alpha2/configs/configz`. It decides whether the cluster
 * switcher appears and whether `/clusters` may redirect a single-cluster installation.
 */
export function platformConfigApi(client: Client) {
  return {
    async configz(params: { signal?: AbortSignal } = {}): Promise<{ multicluster: boolean }> {
      const body = await client.request<Record<string, unknown>>(
        '/kapis/config.kubesphere.io/v1alpha2/configs/configz',
        params.signal ? { signal: params.signal } : {},
      );
      return { multicluster: body?.['multicluster'] === true };
    },
  };
}

/**
 * The agent manifests a proxy-mode member cluster has to apply.
 *
 * Only meaningful for `connection.type: proxy` before the cluster is ready: without it
 * the reader has created a cluster and has no idea what to do next. The endpoint returns
 * a YAML document assembled by ks-apiserver.
 */
export function clusterAgentApi(client: Client) {
  return {
    async deployment(params: { cluster: string; signal?: AbortSignal }): Promise<string> {
      const body = await client.request<string | Record<string, unknown>>(
        `/kapis/cluster.kubesphere.io/v1alpha1/clusters/${encodeURIComponent(params.cluster)}/agent/deployment`,
        params.signal ? { signal: params.signal } : {},
      );
      return typeof body === 'string' ? body : JSON.stringify(body, null, 2);
    },
  };
}

export function clustersApi(client: Client) {
  return {
    async list(params: { signal?: AbortSignal } = {}): Promise<{ items: ClusterSummary[]; total: number }> {
      const body = await client.request<{ items?: KubeCluster[] }>(
        '/kapis/cluster.kubesphere.io/v1alpha1/clusters',
        params.signal ? { signal: params.signal } : {},
      );
      const items = (body?.items ?? []).map(toClusterSummary);
      return { items, total: items.length };
    },
  };
}

export type ClustersApi = ReturnType<typeof clustersApi>;

/**
 * The platform and Kubernetes versions.
 *
 * `/kapis/version` is the only endpoint that answers this on both a real KubeSphere
 * install and the local BFF harness; the fields are strings worth showing verbatim
 * (`v0.0.0` on the harness is the harness stating it, not a bug to hide).
 */
export interface PlatformVersion {
  /** The console product version, e.g. `v3.4.1`; may be `v0.0.0` on a local harness. */
  consoleVersion: string;
  /** The Kubernetes server version, e.g. `v1.37.0`. */
  kubernetesVersion: string;
}

export function versionApi(client: Client) {
  return {
    async get(params: { signal?: AbortSignal } = {}): Promise<PlatformVersion> {
      const body = await client.request<{
        gitVersion?: string;
        kubernetes?: { gitVersion?: string };
      }>('/kapis/version', params.signal ? { signal: params.signal } : {});
      return {
        consoleVersion: String(body?.gitVersion ?? ''),
        kubernetesVersion: String(body?.kubernetes?.gitVersion ?? ''),
      };
    },
  };
}

/**
 * 事件查询 (event search).
 *
 * The core events collection cannot answer the two questions this page asks: how many
 * events happened in a window (a total), and which ones match a filter (server-side).
 * `tenant.kubesphere.io/v1alpha2/events` does both: `operation=histogram` returns bucketed
 * counts with a total, `operation=query` returns records with a total and `from`/`size`.
 *
 * Both calls accept the same filter keys, so the histogram and the list always describe the
 * same selection — a histogram of everything next to a filtered list would be a lie.
 */
export interface EventHistogramBucket {
  /** Bucket start, epoch milliseconds. */
  time: number;
  count: number;
}

export interface EventHistogram {
  total: number;
  buckets: EventHistogramBucket[];
}

/** The filters the API understands; empty strings are dropped before the call. */
export interface EventQueryFilters {
  message?: string;
  workspace?: string;
  namespace?: string;
  kind?: string;
  name?: string;
  reason?: string;
  type?: string;
}

export interface EventRecord {
  /** `@timestamp` of the record, ISO 8601. */
  timestamp: string;
  type: string;
  reason: string;
  message: string;
  count: number;
  objectKind: string;
  objectName: string;
  namespace: string;
  /** `lastTimestamp`, falling back to `eventTime`/`firstTimestamp`. */
  lastTimestamp: string;
}

export interface EventQueryPage {
  total: number;
  records: EventRecord[];
}

/** The API's filter keys, which are not the field names a form would use. */
const EVENT_FILTER_KEYS: Record<keyof EventQueryFilters, string> = {
  message: 'message_search',
  workspace: 'workspace_filter',
  namespace: 'involved_object_namespace_filter',
  kind: 'involved_object_kind_filter',
  name: 'involved_object_name_filter',
  reason: 'reason_filter',
  type: 'type_filter',
};

export function eventSearchApi(client: Client) {
  function filterQuery(filters: EventQueryFilters): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(filters)) {
      const trimmed = String(value ?? '').trim();
      if (trimmed) out[EVENT_FILTER_KEYS[key as keyof EventQueryFilters]] = trimmed;
    }
    return out;
  }

  return {
    /** Bucketed event counts for `[start, end)`, plus the total in that window. */
    async histogram(
      params: { start: number; end: number; interval?: string; filters?: EventQueryFilters; signal?: AbortSignal },
    ): Promise<EventHistogram> {
      const body = await client.request<{ histogram?: { total?: number; buckets?: Array<{ time?: number; count?: number }> } }>(
        '/kapis/tenant.kubesphere.io/v1alpha2/events',
        {
          query: {
            operation: 'histogram',
            start_time: Math.round(params.start / 1000),
            end_time: Math.round(params.end / 1000),
            interval: params.interval ?? '30m',
            ...filterQuery(params.filters ?? {}),
          },
          ...(params.signal ? { signal: params.signal } : {}),
        },
      );
      const histogram = body?.histogram ?? {};
      return {
        total: Number(histogram.total ?? 0),
        buckets: (histogram.buckets ?? [])
          .map((bucket) => ({ time: Number(bucket.time ?? 0), count: Number(bucket.count ?? 0) }))
          .filter((bucket) => bucket.time > 0),
      };
    },

    /** One page of records for the same filters. */
    async query(
      params: {
        from: number;
        size: number;
        filters?: EventQueryFilters;
        /** Optional `[start, end)` in epoch milliseconds; omit for the whole retained history. */
        start?: number;
        end?: number;
        signal?: AbortSignal;
      },
    ): Promise<EventQueryPage> {
      const body = await client.request<{
        query?: {
          total?: number;
          records?: Array<{
            '@timestamp'?: string;
            type?: string;
            reason?: string;
            message?: string;
            count?: number;
            lastTimestamp?: string;
            eventTime?: string;
            firstTimestamp?: string;
            involvedObject?: { kind?: string; name?: string; namespace?: string };
          }>;
        };
      }>('/kapis/tenant.kubesphere.io/v1alpha2/events', {
        query: {
          operation: 'query',
          from: params.from,
          size: params.size,
          ...(params.start === undefined ? {} : { start_time: Math.round(params.start / 1000) }),
          ...(params.end === undefined ? {} : { end_time: Math.round(params.end / 1000) }),
          ...filterQuery(params.filters ?? {}),
        },
        ...(params.signal ? { signal: params.signal } : {}),
      });
      const page = body?.query ?? {};
      return {
        total: Number(page.total ?? 0),
        records: (page.records ?? []).map((record) => {
          const object = record.involvedObject ?? {};
          return {
            timestamp: String(record['@timestamp'] ?? ''),
            type: String(record.type ?? ''),
            reason: String(record.reason ?? ''),
            message: String(record.message ?? ''),
            count: Number(record.count ?? 0),
            objectKind: String(object.kind ?? ''),
            objectName: String(object.name ?? ''),
            namespace: String(object.namespace ?? ''),
            lastTimestamp: String(record.lastTimestamp ?? record.eventTime ?? record.firstTimestamp ?? ''),
          };
        }),
      };
    },
  };
}
