import type { Client } from './client';
import { clusterScoped } from './paths';

export interface KubectlTarget {
  namespace: string;
  pod: string;
  container: string;
}

/** Resolve the account-owned tool Pod; never create a cluster-admin Pod in the browser. */
export function kubectlApi(client: Client) {
  return {
    async kubeconfig(params: { cluster: string; username: string; signal?: AbortSignal }): Promise<string> {
      if (!params.username) throw new Error('A signed-in user is required');
      // `clusters/<id>` goes before the group: see `clusterScoped`.
      const body = await client.request<string>(
        clusterScoped('/kapis/resources.kubesphere.io/v1alpha2', params.cluster, `users/${encodeURIComponent(params.username)}/kubeconfig`),
        { responseType: 'text', ...(params.signal ? { signal: params.signal } : {}) },
      );
      if (typeof body !== 'string' || !body.trim()) throw new Error('No kubeconfig is available');
      return body;
    },
    async target(params: { cluster: string; username: string; signal?: AbortSignal }): Promise<KubectlTarget> {
      if (!params.username) throw new Error('A signed-in user is required');
      const body = await client.request<KubectlTarget>(
        clusterScoped('/kapis/resources.kubesphere.io/v1alpha2', params.cluster, `users/${encodeURIComponent(params.username)}/kubectl`),
        { ...(params.signal ? { signal: params.signal } : {}) },
      );
      if (!body?.namespace || !body.pod || !body.container) throw new Error('No ready kubectl Pod is available');
      return { namespace: body.namespace, pod: body.pod, container: body.container };
    },
  };
}
