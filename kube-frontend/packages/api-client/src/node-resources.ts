import type { Client } from './client';
import { clusterScoped, corePath } from './paths';
import { toWorkloadSummary } from './workloads';
import type { KubeObject } from './resources';

/**
 * Read the collection that honours `spec.nodeName` / `involvedObject` field selectors.
 *
 * On the host cluster that is the core group (`/api/v1/...`). The core group has no member-cluster
 * form -- `/api/v1/clusters/xc/pods` answers 404 -- so a member read goes through the kapis
 * resources proxy, which accepts the same shape and the same field selector (`corePath`).
 */
export function nodeResourcesApi(client: Client) {
  const path = (cluster: string, resource: string) => corePath(cluster, resource);
  return {
    async pods(params: { cluster: string; node: string; signal?: AbortSignal }) {
      const pods: KubeObject[] = [];
      let continuation = '';
      do {
        const body = await client.request<{ items?: KubeObject[]; metadata?: { continue?: string } }>(path(params.cluster, 'pods'), {
          query: { fieldSelector: `spec.nodeName=${params.node}`, limit: 500, ...(continuation ? { continue: continuation } : {}) },
          ...(params.signal ? { signal: params.signal } : {}),
        });
        pods.push(...(body.items ?? []));
        continuation = body.metadata?.continue ?? '';
      } while (continuation);
      return pods.map((pod) => toWorkloadSummary('pods', pod));
    },
    async events(params: { cluster: string; node: string; signal?: AbortSignal }) {
      /*
       * Events come from the `events.k8s.io/v1` group, not the core group.
       *
       * Measured on A100: `/api/v1/clusters/xc/events` answers 404 and the kapis resources proxy does
       * not serve `events` at all (`/kapis/resources.kubesphere.io/v1alpha3/events` is 404 on the host
       * too), while `/apis/clusters/xc/events.k8s.io/v1/events` answers 200. That group is also
       * served on the host, so one path works for both clusters.
       *
       * Its field selectors are named `regarding.*` rather than the core group's
       * `involvedObject.*`; sending the old names would return an empty list instead of an error.
       */
      const body = await client.request<{ items?: Array<Record<string, unknown>> }>(
        clusterScoped('/apis/events.k8s.io/v1', params.cluster, 'events'), {
        query: { fieldSelector: `regarding.kind=Node,regarding.name=${params.node}` },
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
