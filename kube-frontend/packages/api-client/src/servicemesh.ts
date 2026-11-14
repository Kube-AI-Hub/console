import type { Client } from './client';
import { baseOf, type KubeObject, type ResourceBase } from './resources';

/**
 * Gray release (canary / blue-green / traffic mirroring).
 *
 * A gray release is a KubeSphere `Strategy` custom resource in the servicemesh API
 * group: the controller turns it into Istio VirtualServices. The object carries both
 * the intent (`spec.type`, versions) and the controller's progress
 * (`status.conditions`), which is why the list derives a status instead of showing a
 * `phase` that does not exist on the CRD.
 *
 * Both endpoints answer 200 on this cluster; the page reads the **native** CRD endpoint
 * (`/apis/servicemesh.kubesphere.io/...`) because it returns the object verbatim and
 * needs no second request for status. The kapis proxy (`/kapis/servicemesh...`) works
 * too but returns the same items in the resource-proxy envelope.
 */

const SERVICE_MESH_VERSION = 'servicemesh.kubesphere.io/v1alpha2';

/** What the strategy asks the mesh to do. */
export type StrategyType = 'Canary' | 'Bluegreen' | 'Mirror' | (string & {});

/**
 * Derived from `status.conditions` (types `Complete` / `Failed`), falling back to
 * `completionTime`; `unknown` is a real state (the controller has not reported yet),
 * not an error.
 */
export type StrategyStatus = 'completed' | 'failed' | 'progressing' | 'unknown';

/** One row of the gray-release list. */
export interface StrategySummary extends ResourceBase {
  /** `spec.type`: Canary / Bluegreen / Mirror. */
  type: StrategyType;
  /**
   * The Istio host the strategy routes, i.e. the service being released.
   *
   * `spec.template.spec.hosts[0]` is the authoritative source; a strategy created
   * without a template falls back to the selector's `app` label and then to the
   * VirtualService name, so the column does not read "-" for an object that does have
   * a target somewhere.
   */
  targetService: string;
  status: StrategyStatus;
  /** Condition message/reason, shown as the badge's tooltip when present. */
  statusDetail: string;
}

export interface KubeStrategy extends KubeObject {
  spec?: Record<string, unknown>;
  status?: Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

/** First non-empty string in a list of candidates. */
function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

/**
 * The service a strategy targets.
 *
 * Istio's `hosts` entry is the host the VirtualService serves — for a KubeSphere
 * release that is the service's name — so it is the first choice. The selector and the
 * template metadata are fallbacks for a partially-created object.
 */
export function targetServiceOf(item: KubeStrategy): string {
  const spec = item.spec ?? {};
  const template = asRecord(spec['template']);
  const templateSpec = asRecord(template?.['spec']);
  const hosts = Array.isArray(templateSpec?.['hosts']) ? (templateSpec['hosts'] as unknown[]) : [];
  const selector = asRecord(spec['selector']);
  const matchLabels = asRecord(selector?.['matchLabels']);
  const templateMetadata = asRecord(template?.['metadata']);
  const templateLabels = asRecord(templateMetadata?.['labels']);
  return firstString(
    hosts[0],
    matchLabels?.['app'],
    templateLabels?.['app'],
    templateMetadata?.['name'],
    item.metadata?.name,
  );
}

/** Read the controller's verdict out of `status.conditions`. */
export function strategyStatusOf(item: KubeStrategy): { status: StrategyStatus; detail: string } {
  const status = item.status ?? {};
  const conditions = Array.isArray(status['conditions']) ? (status['conditions'] as Array<Record<string, unknown>>) : [];
  const failed = conditions.find(
    (condition) => String(condition['type'] ?? '') === 'Failed' && String(condition['status'] ?? '') === 'True',
  );
  if (failed) {
    return { status: 'failed', detail: firstString(failed['message'], failed['reason']) };
  }
  const complete = conditions.find(
    (condition) => String(condition['type'] ?? '') === 'Complete' && String(condition['status'] ?? '') === 'True',
  );
  if (complete) {
    return { status: 'completed', detail: firstString(complete['message'], complete['reason']) };
  }
  // A recorded completion time without a condition still means the controller finished.
  if (typeof status['completionTime'] === 'string' && status['completionTime']) {
    return { status: 'completed', detail: '' };
  }
  if (conditions.length > 0) {
    const latest = conditions[conditions.length - 1] ?? {};
    return { status: 'progressing', detail: firstString(latest['message'], latest['reason']) };
  }
  return { status: 'unknown', detail: '' };
}

export function toStrategySummary(item: KubeStrategy): StrategySummary {
  const status = strategyStatusOf(item);
  return {
    ...baseOf(item),
    type: firstString(item.spec?.['type']) || 'unknown',
    targetService: targetServiceOf(item),
    status: status.status,
    statusDetail: status.detail,
  };
}

/**
 * List path for one project.
 *
 * Host cluster writes/reads through the plain group path; a member cluster needs the
 * `clusters/<id>` segment, the same shape every other native kube write in this app
 * uses. Only the host cluster is verified on this installation.
 */
function strategiesPath(cluster: string, namespace: string): string {
  const clusterSegment = cluster && cluster !== 'host' ? `clusters/${encodeURIComponent(cluster)}/` : '';
  return `/apis/${SERVICE_MESH_VERSION}/${clusterSegment}namespaces/${encodeURIComponent(namespace)}/strategies`;
}

export function strategiesApi(client: Client) {
  return {
    /**
     * Every strategy of one project.
     *
     * The CRD list is not paginated (the controller writes a handful per project), so
     * the page filters and pages locally; asking for a page would be a parameter the
     * server ignores.
     */
    async list(params: { cluster: string; namespace: string; signal?: AbortSignal }): Promise<{ items: StrategySummary[] }> {
      const body = await client.request<{ items?: KubeStrategy[] }>(strategiesPath(params.cluster, params.namespace), {
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return { items: (body?.items ?? []).map(toStrategySummary) };
    },
  };
}
