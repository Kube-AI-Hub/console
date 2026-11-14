import type { Client } from './client';
import { toWorkloadSummary } from './workloads';
import type { KubeObject } from './resources';

/** Read the native collection so spec.nodeName filtering cannot be ignored by kapis. */
export function nodeResourcesApi(client: Client) {
  const prefix = (cluster: string) => `/api/v1/${cluster && cluster !== 'host' ? `clusters/${encodeURIComponent(cluster)}/` : ''}`;
  return {
    async pods(params: { cluster: string; node: string; signal?: AbortSignal }) {
      const pods: KubeObject[] = [];
      let continuation = '';
      do {
        const body = await client.request<{ items?: KubeObject[]; metadata?: { continue?: string } }>(`${prefix(params.cluster)}pods`, {
          query: { fieldSelector: `spec.nodeName=${params.node}`, limit: 500, ...(continuation ? { continue: continuation } : {}) },
          ...(params.signal ? { signal: params.signal } : {}),
        });
        pods.push(...(body.items ?? []));
        continuation = body.metadata?.continue ?? '';
      } while (continuation);
      return pods.map((pod) => toWorkloadSummary('pods', pod));
    },
    async events(params: { cluster: string; node: string; signal?: AbortSignal }) {
      const body = await client.request<{ items?: Array<Record<string, unknown>> }>(`${prefix(params.cluster)}events`, {
        query: { fieldSelector: `involvedObject.kind=Node,involvedObject.name=${params.node}` },
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return (body.items ?? []).map((event) => ({
        name: String((event.metadata as Record<string, unknown> | undefined)?.name ?? ''),
        type: String(event.type ?? ''), reason: String(event.reason ?? ''), message: String(event.message ?? ''),
        count: Number(event.count ?? 1),
        lastSeen: String(event.lastTimestamp ?? event.eventTime ?? event.firstTimestamp ?? ''),
      })).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
    },
  };
}
