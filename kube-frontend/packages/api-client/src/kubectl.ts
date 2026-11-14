import type { Client } from './client';

export interface KubectlTarget {
  namespace: string;
  pod: string;
  container: string;
}

/** Resolve the account-owned tool Pod; never create a cluster-admin Pod in the browser. */
export function kubectlApi(client: Client) {
  return {
    async target(params: { cluster: string; username: string; signal?: AbortSignal }): Promise<KubectlTarget> {
      if (!params.username) throw new Error('A signed-in user is required');
      const prefix = params.cluster && params.cluster !== 'host' ? `clusters/${encodeURIComponent(params.cluster)}/` : '';
      const body = await client.request<KubectlTarget>(
        `/kapis/resources.kubesphere.io/v1alpha2/${prefix}users/${encodeURIComponent(params.username)}/kubectl`,
        { ...(params.signal ? { signal: params.signal } : {}) },
      );
      if (!body?.namespace || !body.pod || !body.container) throw new Error('No ready kubectl Pod is available');
      return { namespace: body.namespace, pod: body.pod, container: body.container };
    },
  };
}
