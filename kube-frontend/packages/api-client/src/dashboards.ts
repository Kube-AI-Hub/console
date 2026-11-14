import type { Client } from './client';
import { baseOf, type KubeObject, type ResourceBase } from './resources';

/**
 * 自定义监控仪表板.
 *
 * KubeSphere stores these as two CRDs in the monitoring group, and the **version matters**:
 * they are `monitoring.kubesphere.io/v1alpha2`, not `v1alpha3`. Probing `v1alpha3` answers 404,
 * which is how the migration plan came to record custom monitoring as "the dashboards API does
 * not exist" — a true sentence about the wrong version.
 *
 * - `clusterdashboards` — cluster scope, one object per dashboard;
 * - `dashboards` — project scope, namespaced.
 *
 * The object is Grafana-shaped: `spec.panels[]` carries `targets[]` with PromQL expressions.
 * Rendering those panels is the panel editor's job and is not migrated here (see the page's
 * comment); the list only needs identity, so the mapping stays small.
 */
const MONITORING = '/apis/monitoring.kubesphere.io/v1alpha2';

export interface DashboardSummary extends ResourceBase {
  /** `spec.title` — what the old console shows instead of the object name. */
  title: string;
  /** How many panels the dashboard declares. */
  panels: number;
  /** `spec.description`. */
  summary: string;
  /** Whether the old console would let an editor change its panels. */
  editable: boolean;
}

export type DashboardDetail = DashboardSummary;

function toDashboard(item: KubeObject): DashboardSummary {
  const spec = (item.spec ?? {}) as Record<string, unknown>;
  return {
    ...baseOf(item),
    title: String(spec['title'] ?? ''),
    panels: Array.isArray(spec['panels']) ? spec['panels'].length : 0,
    summary: String(spec['description'] ?? ''),
    editable: spec['editable'] === true,
  };
}

/** `clusterdashboards` and `dashboards` differ only in scope, so one factory serves both. */
function dashboardsApi(client: Client, resource: 'clusterdashboards' | 'dashboards', namespaced: boolean) {
  const collection = (namespace: string) =>
    namespaced ? `${MONITORING}/namespaces/${encodeURIComponent(namespace)}/${resource}` : `${MONITORING}/${resource}`;

  return {
    async list(params: { namespace?: string; signal?: AbortSignal } = {}): Promise<DashboardSummary[]> {
      // The endpoint returns a bare list with no paging: dashboards are few, and the old
      // console reads them all too.
      const response = await client.request<{ items?: KubeObject[] }>(collection(params.namespace ?? ''), {
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return (response?.items ?? []).map(toDashboard);
    },

    async get(params: { name: string; namespace?: string; signal?: AbortSignal }): Promise<KubeObject | null> {
      try {
        return await client.request<KubeObject>(`${collection(params.namespace ?? '')}/${encodeURIComponent(params.name)}`, {
          ...(params.signal ? { signal: params.signal } : {}),
        });
      } catch {
        return null;
      }
    },

    /**
     * Replace a dashboard from YAML.
     *
     * PUT with the whole object: the dashboard is edited as a document here, and a merge
     * patch would leave panels the editor deleted in place.
     */
    async save(params: { name: string; body: Record<string, unknown>; namespace?: string }): Promise<void> {
      await client.request(`${collection(params.namespace ?? '')}/${encodeURIComponent(params.name)}`, {
        method: 'PUT',
        body: params.body,
      });
    },

    async remove(params: { name: string; namespace?: string }): Promise<void> {
      await client.request(`${collection(params.namespace ?? '')}/${encodeURIComponent(params.name)}`, {
        method: 'DELETE',
      });
    },
  };
}

export function clusterDashboardsApi(client: Client) {
  return dashboardsApi(client, 'clusterdashboards', false);
}

export function projectDashboardsApi(client: Client) {
  return dashboardsApi(client, 'dashboards', true);
}
