import { useQuery } from '@tanstack/react-query';
import { clusterScoped,
  nodesApi,
  quantityToNumber,
  resourceApi,
  namespacesApi,
  usagePercent,
  type NodeSummary,
  type NamespaceSummary,
  type ResourceListParams,
} from '@kube-ai-hub/api-client';
import type { LocaleKey } from '@kube-ai-hub/locales';
import { api } from '@/api';

/** Cluster-console pages this area exposes so far. */
export type ClusterKind = 'nodes' | 'namespaces';

export function clusterKey(kind: ClusterKind, params: Omit<ResourceListParams, 'signal'>) {
  return ['cluster', kind, params.cluster, params.page, params.pageSize, params.sortBy, params.order, params.keyword] as const;
}

/**
 * One list query for both kinds.
 *
 * The branch sits inside the query function, not at the hook level: React needs the
 * same hooks in the same order on every render, so `kind === … ? useA() : useB()`
 * would be a latent rules-of-hooks bug.
 */
/**
 * Node usage, merged onto the node list.
 *
 * `metrics.k8s.io` provides current usage and `nodes` provides capacity; the list shows
 * a percentage of the two. Metrics may be unavailable (no metrics-server) — the caller
 * then renders `-` rather than a zero, which would read as "idle" instead of "unknown".
 */
export function useNodeUsage(cluster = 'host', enabled = true) {
  return useQuery({
    queryKey: ['node-metrics', cluster],
    enabled,
    staleTime: 30_000,
    retry: false,
    queryFn: async ({ signal }) => {
      const body = await api.request<{ items?: Array<{ metadata?: { name?: string }; usage?: Record<string, string> }> }>(
        clusterScoped('/apis/metrics.k8s.io/v1beta1', cluster, 'nodes'),
        { signal },
      );
      const out: Record<string, { cpu?: string; memory?: string }> = {};
      for (const item of body?.items ?? []) {
        const name = item.metadata?.name;
        if (!name) continue;
        // Build the entry conditionally: with `exactOptionalPropertyTypes` an explicit
        // `undefined` is not the same as a missing key.
        const entry: { cpu?: string; memory?: string } = {};
        const cpu = item.usage?.['cpu'];
        const memory = item.usage?.['memory'];
        if (cpu !== undefined) entry.cpu = cpu;
        if (memory !== undefined) entry.memory = memory;
        out[name] = entry;
      }
      return out;
    },
  });
}

/**
 * Per-project Pod usage, aggregated from one metrics call.
 *
 * `metrics.k8s.io/pods` returns every pod in the cluster; grouping by namespace gives
 * the project rows without a request per project. The numbers are sums, not
 * percentages: a project has no fixed capacity to divide by.
 */
export interface ProjectUsage {
  /**
   * Distinct from `NamespaceSummary.cpu`, which holds a quota, not a measurement.
   * Reusing the same key made the spread below keep the namespace's own empty value.
   */
  cpuUsed: string;
  memoryUsed: string;
  podCount: number;
}

export function useProjectPods(cluster = 'host', enabled = true) {
  return useQuery({
    queryKey: ['project-pods', cluster],
    enabled,
    staleTime: 30_000,
    retry: false,
    queryFn: async ({ signal }) => {
      /*
       * A pod's usage sits under `containers[]`, not at the top level — unlike a node,
       * where `usage` is a sibling of `metadata`. Reading the node shape here returns
       * zeros for every project while the pod count stays correct, which is exactly how
       * this looked before it was fixed.
       */
      const body = await api.request<{
        items?: Array<{ metadata?: { namespace?: string }; containers?: Array<{ usage?: Record<string, string> }> }>;
      }>(clusterScoped('/apis/metrics.k8s.io/v1beta1', cluster, 'pods'), { signal });
      const out: Record<string, { cpuCores: number; memoryBytes: number; podCount: number }> = {};
      for (const item of body?.items ?? []) {
        const namespace = item.metadata?.namespace;
        if (!namespace) continue;
        const entry = out[namespace] ?? { cpuCores: 0, memoryBytes: 0, podCount: 0 };
        for (const container of item.containers ?? []) {
          entry.cpuCores += quantityToNumber(container.usage?.['cpu'] ?? '0');
          entry.memoryBytes += quantityToNumber(container.usage?.['memory'] ?? '0');
        }
        entry.podCount += 1;
        out[namespace] = entry;
      }
      return out;
    },
  });
}

/** Attach aggregated usage to project rows; rows without pods report zeros. */
export function withProjectUsage(
  rows: NamespaceSummary[],
  /**
   * `undefined` until the metrics list has arrived.
   *
   * Without this the rows carried `0` / `0` / `0` before the read finished, which says
   * "this project uses nothing and runs no pods" — a claim the data does not support.
   * A project with genuinely no pods is absent *within* a loaded map, which is a
   * different answer and still reports zeros.
   */
  usage: Record<string, { cpuCores: number; memoryBytes: number; podCount: number }> | undefined,
): Array<NamespaceSummary & Partial<ProjectUsage>> {
  if (!usage) return rows;
  return rows.map((row) => {
    const entry = usage[row.name] ?? { cpuCores: 0, memoryBytes: 0, podCount: 0 };
    return {
      ...row,
      cpuUsed: formatCores(entry.cpuCores),
      memoryUsed: formatBytes(entry.memoryBytes),
      podCount: entry.podCount,
    };
  });
}

/** Cores with one decimal: `1.2`, `0.4`. */
function formatCores(cores: number): string {
  if (cores <= 0) return '0';
  return cores < 1 ? cores.toFixed(2) : cores.toFixed(1);
}

/** Binary units, matching how Kubernetes reports memory. */
function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0';
  const units = ['B', 'Ki', 'Mi', 'Gi', 'Ti'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index >= 2 ? 1 : 0)}${units[index]}`;
}

/** Merge usage onto node rows; returns rows untouched when metrics are missing. */
export function withNodeUsage(rows: NodeSummary[], usage: Record<string, { cpu?: string; memory?: string }>): NodeSummary[] {
  return rows.map((row) => {
    const entry = usage[row.name];
    if (!entry) return row;
    const cpuUsage = entry.cpu ?? '';
    const memoryUsage = entry.memory ?? '';
    const cpuPercent = cpuUsage ? usagePercent(cpuUsage, row.cpu) : undefined;
    const memoryPercent = memoryUsage ? usagePercent(memoryUsage, row.memory) : undefined;
    return {
      ...row,
      cpuUsage,
      memoryUsage,
      ...(cpuPercent !== undefined ? { cpuPercent } : {}),
      ...(memoryPercent !== undefined ? { memoryPercent } : {}),
    };
  });
}

export function useClusterList(kind: ClusterKind, params: Omit<ResourceListParams, 'signal'>) {
  return useQuery({
    queryKey: clusterKey(kind, params),
    queryFn: async ({ signal }) => {
      const client = kind === 'nodes' ? nodesApi(api) : namespacesApi(api);
      const result = (await client.list({ ...params, signal })) as unknown as {
        items: Array<NodeSummary | NamespaceSummary>;
        total: number;
      };
      return result;
    },
  });
}

export interface ClusterDescriptor {
  titleKey: LocaleKey;
  descriptionKey: LocaleKey;
  emptyTitleKey: LocaleKey;
  emptyDescriptionKey: LocaleKey;
}

export const CLUSTER_DESCRIPTORS: Record<ClusterKind, ClusterDescriptor> = {
  nodes: {
    titleKey: 'cluster.nodes.title',
    descriptionKey: 'cluster.nodes.description',
    emptyTitleKey: 'cluster.nodes.emptyTitle',
    emptyDescriptionKey: 'cluster.nodes.emptyDescription',
  },
  namespaces: {
    titleKey: 'cluster.projects.title',
    descriptionKey: 'cluster.projects.description',
    emptyTitleKey: 'cluster.projects.emptyTitle',
    emptyDescriptionKey: 'cluster.projects.emptyDescription',
  },
};

export { resourceApi };
