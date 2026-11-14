import type { Client } from './client';
import { ApiError } from './errors';
import { gpusApi } from './gpu';
import { NODE_LIST_METRICS, toNodeMetrics } from './node-list';

export const NODE_INSIGHT_METRICS = [...NODE_LIST_METRICS,
  'node_disk_size_capacity', 'node_disk_size_usage', 'node_disk_size_utilisation',
] as const;
export type NodeInsightValues = Partial<Record<(typeof NODE_INSIGHT_METRICS)[number], number>>;
export interface RdmaPort {
  node: string; device: string; port: string; state: string; physicalState: number;
  linkLayer: string; speedBytes: number | undefined; hca: string; firmware: string;
  resourceReady: boolean; healthy: boolean;
}

/** Independent reads: a missing metric or hardware endpoint never hides the node. */
export function nodeInsightsApi(client: Client) {
  return {
    async instant(params: { cluster: string; node: string; signal?: AbortSignal }): Promise<NodeInsightValues> {
      const body = await client.request<Parameters<typeof toNodeMetrics>[0]>(
        `/kapis/monitoring.kubesphere.io/v1alpha3/nodes/${encodeURIComponent(params.node)}`, {
          query: { cluster: params.cluster, last: true, metrics_filter: NODE_INSIGHT_METRICS.map((key) => `${key}$`).join('|') },
          ...(params.signal ? { signal: params.signal } : {}),
        });
      return (toNodeMetrics(body ?? {})[params.node] ?? {}) as NodeInsightValues;
    },
    async cards(params: { cluster: string; node: string; signal?: AbortSignal }) {
      const data = await gpusApi(client).list({ cluster: params.cluster, nodeName: params.node, limit: -1,
        ...(params.signal ? { signal: params.signal } : {}) });
      // The upstream node-name filter is a contains match, not an exact identity.
      return data.items.filter((card) => card.node === params.node);
    },
    async ports(params: { cluster: string; node: string; signal?: AbortSignal }): Promise<RdmaPort[]> {
      if (params.cluster && params.cluster !== 'host') throw new ApiError({
        code: 'unsupported_cluster', message: 'RDMA inventory routing is only verified for host',
      }, 400);
      const body = await client.request<{ items?: Array<Record<string, unknown>>; totalItems?: number }>(
        '/kapis/rdma.kubesphere.io/v1alpha1/ports', {
          query: { nodeName: params.node, limit: -1 }, ...(params.signal ? { signal: params.signal } : {}),
        });
      if (!Number.isFinite(body?.totalItems)) throw new Error('RDMA inventory is not available');
      return (body.items ?? []).filter((port) => port.nodeName === params.node).map((port) => ({
        node: String(port.nodeName), device: String(port.device ?? ''), port: String(port.port ?? ''),
        state: String(port.stateName ?? 'unknown'), physicalState: Number(port.physState),
        linkLayer: String(port.linkLayerName ?? 'unknown'),
        speedBytes: port.linkSpeed !== undefined && Number.isFinite(Number(port.linkSpeed)) ? Number(port.linkSpeed) : undefined,
        hca: String(port.hcaType ?? ''), firmware: String(port.firmware ?? ''),
        resourceReady: port.rdmaAllocated === true, healthy: port.healthy === true,
      }));
    },
  };
}
