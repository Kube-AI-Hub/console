import type { Client } from './client';
import { baseOf, resourceApi, type KubeObject, type ResourceBase } from './resources';

/**
 * 集群级网络：Pod IP 池。
 *
 * Two findings made this page possible, and both contradict what the migration plan had
 * recorded as "the network module is off, so nothing here can be built":
 *
 * - `configz.network` is indeed `false`, but that flag gates the *menu*, not the API. The
 *   `network.kubesphere.io` group is served and `ippools` reads back 200.
 * - `ippools` is also readable through the generic kapis resources proxy, which is what
 *   gives paging and keyword search without a bespoke query.
 *
 * So the page reads from kapis (`/kapis/resources.kubesphere.io/v1alpha3/ippools`) like
 * every other cross-namespace list here.
 */
export interface IpPoolSummary extends ResourceBase {
  /** The pool's whole segment, e.g. `192.168.0.0/24`. */
  cidr: string;
  /** The allocatable slice inside `cidr`; empty when the pool uses the whole segment. */
  rangeStart: string;
  rangeEnd: string;
  /** Addresses handed out, and the pool's total capacity, straight from `status`. */
  used: number;
  capacity: number;
  /** The workspace label; empty for a pool that belongs to no one. */
  workspace: string;
  /** `ippool.network.kubesphere.io/default` — the pool new pods draw from by default. */
  isDefault: boolean;
  /** A disabled pool keeps its allocations but hands out nothing new. */
  disabled: boolean;
}

export interface IpPoolDetail extends IpPoolSummary {
  /** workspace → addresses allocated to it; `status.workspaces` on the object. */
  workspaceUsage: { workspace: string; allocations: number }[];
  /** The IP block size, when the pool is subdivided. */
  blockSize: number;
  gateway: string;
}

const IPPOOL_LABELS = {
  default: 'ippool.network.kubesphere.io/default',
  workspace: 'kubesphere.io/workspace',
} as const;

export function toIpPoolSummary(item: KubeObject): IpPoolSummary {
  const spec = (item.spec ?? {}) as Record<string, unknown>;
  const status = (item.status ?? {}) as Record<string, unknown>;
  const labels = item.metadata?.labels ?? {};
  return {
    ...baseOf(item),
    cidr: String(spec['cidr'] ?? ''),
    rangeStart: String(spec['rangeStart'] ?? ''),
    rangeEnd: String(spec['rangeEnd'] ?? ''),
    used: Number(status['allocated'] ?? status['used'] ?? 0),
    capacity: Number(status['capacity'] ?? 0),
    workspace: labels[IPPOOL_LABELS.workspace] ?? '',
    isDefault: labels[IPPOOL_LABELS.default] !== undefined,
    disabled: spec['disabled'] === true,
  };
}

/** `status.workspaces` is a map of workspace → `{allocations}`, not a list. */
function workspaceUsageOf(item: KubeObject): { workspace: string; allocations: number }[] {
  const status = (item.status ?? {}) as Record<string, unknown>;
  const workspaces = (status['workspaces'] ?? {}) as Record<string, { allocations?: number } | number>;
  return Object.entries(workspaces)
    .map(([workspace, value]) => ({
      workspace,
      allocations: typeof value === 'number' ? value : Number(value?.allocations ?? 0),
    }))
    .sort((a, b) => b.allocations - a.allocations);
}

export function toIpPoolDetail(item: KubeObject): IpPoolDetail {
  const spec = (item.spec ?? {}) as Record<string, unknown>;
  return {
    ...toIpPoolSummary(item),
    workspaceUsage: workspaceUsageOf(item),
    blockSize: Number(spec['blockSize'] ?? 0),
    gateway: String(spec['gateway'] ?? ''),
  };
}

export function ipPoolsApi(client: Client) {
  return {
    ...resourceApi<KubeObject, IpPoolSummary, IpPoolDetail>(client, {
      resource: 'ippools',
      toSummary: toIpPoolSummary,
      toDetail: toIpPoolDetail,
    }),
  };
}
