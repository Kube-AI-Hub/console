import type { Client } from './client';

/**
 * Workspace-scope monitoring reads for the workspace overview.
 *
 * Two aggregates, both probed against the B200 deployment:
 *
 * - the workspace's own usage is a **vector** (one sample per metric), unlike the project
 *   overview which reads a range and takes the latest point;
 * - the project ranking is the namespace ranking, which the API does not scope by workspace,
 *   so the caller filters the samples by the `workspace` label each one carries.
 *
 * A metric the backend does not have is absent from `results`, never a zero — the caller decides
 * what an absent value means for its row.
 */
export const WORKSPACE_USAGE_METRICS = [
  'workspace_cpu_usage',
  'workspace_memory_usage_wo_cache',
  'workspace_pod_count',
  'workspace_net_bytes_received',
  'workspace_net_bytes_transmitted',
] as const;
export type WorkspaceUsageMetric = (typeof WORKSPACE_USAGE_METRICS)[number];

export const WORKSPACE_PROJECT_RANK_METRICS = ['namespace_cpu_usage', 'namespace_memory_usage_wo_cache'] as const;
export type WorkspaceProjectRankMetric = (typeof WORKSPACE_PROJECT_RANK_METRICS)[number];

export interface WorkspaceProjectRankRow {
  /** Project (namespace) name. */
  name: string;
  /** CPU cores or bytes, depending on the requested metric. */
  value: number;
}

export function workspaceUsageApi(client: Client) {
  return {
    /** Current usage of the workspace, keyed by metric name. Missing metrics are absent. */
    async usage(params: { workspace: string; signal?: AbortSignal }): Promise<Partial<Record<WorkspaceUsageMetric, number>>> {
      const body = await client.request<{
        results?: Array<{
          metric_name?: string;
          data?: { result?: Array<{ value?: [number, string] }> };
        }>;
      }>(`/kapis/monitoring.kubesphere.io/v1alpha3/workspaces/${encodeURIComponent(params.workspace)}`, {
        query: {
          metrics_filter: WORKSPACE_USAGE_METRICS.map((metric) => `${metric}$`).join('|'),
          step: '60s',
        },
        ...(params.signal ? { signal: params.signal } : {}),
      });
      const usage: Partial<Record<WorkspaceUsageMetric, number>> = {};
      for (const result of body?.results ?? []) {
        const name = result.metric_name as WorkspaceUsageMetric | undefined;
        if (!name || !WORKSPACE_USAGE_METRICS.includes(name)) continue;
        const raw = result.data?.result?.[0]?.value?.[1];
        if (raw === undefined || raw.trim() === '') continue;
        const value = Number.parseFloat(raw);
        if (Number.isFinite(value)) usage[name] = value;
      }
      return usage;
    },

    /**
     * Top projects of one workspace by `metric`, descending.
     *
     * The ranking endpoint is cluster-wide; the workspace scope comes from the `workspace` label
     * on each sample. A sample without that label cannot be attributed to a workspace and is
     * skipped rather than guessed at.
     */
    async projectRanking(params: {
      workspace: string;
      metric: WorkspaceProjectRankMetric;
      limit?: number;
      signal?: AbortSignal;
    }): Promise<{ items: WorkspaceProjectRankRow[] }> {
      if (!WORKSPACE_PROJECT_RANK_METRICS.includes(params.metric)) throw new Error('Unsupported project ranking metric');
      const body = await client.request<{
        results?: Array<{
          metric_name?: string;
          data?: { result?: Array<{ metric?: { namespace?: string; workspace?: string }; value?: [number, string] }> };
        }>;
      }>('/kapis/monitoring.kubesphere.io/v1alpha3/namespaces', {
        query: {
          sort_metric: params.metric,
          sort_type: 'desc',
          page: 1,
          limit: params.limit ?? 5,
          metrics_filter: WORKSPACE_PROJECT_RANK_METRICS.map((metric) => `${metric}$`).join('|'),
        },
        ...(params.signal ? { signal: params.signal } : {}),
      });
      const ordered = body.results?.find((result) => result.metric_name === params.metric)?.data?.result ?? [];
      const items: WorkspaceProjectRankRow[] = [];
      for (const sample of ordered) {
        const name = sample.metric?.namespace?.trim();
        const owner = sample.metric?.workspace?.trim();
        const raw = sample.value?.[1];
        if (!name || owner !== params.workspace) continue;
        if (raw === undefined || raw.trim() === '') continue;
        const value = Number.parseFloat(raw);
        if (Number.isFinite(value)) items.push({ name, value });
      }
      return { items };
    },
  };
}

/**
 * Workspace ↔ cluster placement.
 *
 * A private cluster is usable only by the workspaces whose `spec.placement` includes it. The old
 * console edits that placement directly with a JSON patch per workspace, and this API does the
 * same rather than inventing a KubeSphere-specific endpoint (there is none for this direction).
 *
 * `spec.placement.clusterSelector` (an empty selector means "every cluster") takes precedence over
 * `clusters`: a workspace that selects by label is already entitled, and adding an explicit entry
 * to it would be noise.
 */
export interface WorkspacePlacement {
  name: string;
  alias: string;
  /** Explicitly listed clusters. */
  clusters: string[];
  /** True when the workspace selects clusters by label instead of listing them. */
  selectorAll: boolean;
}

export function workspacePlacementApi(client: Client) {
  return {
    async list(params: { signal?: AbortSignal } = {}): Promise<WorkspacePlacement[]> {
      const body = await client.request<{
        items?: Array<{
          metadata?: { name?: string; annotations?: Record<string, string> };
          spec?: { placement?: { clusters?: Array<{ name?: string }>; clusterSelector?: Record<string, unknown> | null } };
        }>;
      }>('/kapis/tenant.kubesphere.io/v1alpha2/workspaces', {
        query: { limit: -1 },
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return (body?.items ?? [])
        .map((item) => {
          const placement = item.spec?.placement ?? {};
          const selector = placement.clusterSelector;
          return {
            name: item.metadata?.name ?? '',
            alias: item.metadata?.annotations?.['kubesphere.io/alias-name'] ?? item.metadata?.name ?? '',
            clusters: (placement.clusters ?? []).map((entry) => entry?.name ?? '').filter(Boolean),
            selectorAll: selector !== null && selector !== undefined,
          };
        })
        .filter((item) => item.name);
    },

    /** Entitle a workspace to this cluster. */
    async addCluster(params: { workspace: WorkspacePlacement; cluster: string }): Promise<void> {
      const path = `/kapis/tenant.kubesphere.io/v1alpha2/workspaces/${encodeURIComponent(params.workspace.name)}`;
      const operations = params.workspace.clusters.length
        ? [{ op: 'add', path: '/spec/placement/clusters/-', value: { name: params.cluster } }]
        : [{ op: 'add', path: '/spec/placement', value: { clusters: [{ name: params.cluster }] } }];
      await client.request(path, { method: 'PATCH', body: operations, contentType: 'application/json-patch+json' });
    },

    /** Remove this cluster from a workspace's placement. */
    async removeCluster(params: { workspace: WorkspacePlacement; cluster: string }): Promise<void> {
      const index = params.workspace.clusters.indexOf(params.cluster);
      if (index < 0) return;
      const path = `/kapis/tenant.kubesphere.io/v1alpha2/workspaces/${encodeURIComponent(params.workspace.name)}`;
      await client.request(path, {
        method: 'PATCH',
        // This aggregated API validates that every op carries `value`, even `remove` (probed: 500
        // "operation, missing value field"). The value is ignored, the field must be present.
        body: [{ op: 'remove', path: `/spec/placement/clusters/${index}`, value: { name: params.cluster } }],
        contentType: 'application/json-patch+json',
      });
    },
  };
}
