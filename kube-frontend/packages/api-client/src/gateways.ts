import type { Client } from './client';
import { baseOf, type KubeObject, type ResourceBase } from './resources';
import { toProjectGateway, type ProjectGateway } from './storage';

export interface ClusterGateway extends ResourceBase, ProjectGateway {
  scope: 'cluster' | 'project';
}

/**
 * Whether a Gateway object belongs to the cluster gateway rather than a project.
 *
 * The cluster gateway used to live in `kubesphere-system`; the current operator
 * creates it in `kubesphere-controls-system` (the Gateway installs the nginx
 * release there). Both namespaces are cluster-owned, while a project gateway
 * lives in the project's own namespace — so namespace, not name, is what tells
 * the two apart now.
 */
export function isClusterGatewayNamespace(namespace: string | undefined): boolean {
  return namespace === 'kubesphere-system' || namespace === 'kubesphere-controls-system';
}

export function toClusterGateway(item: KubeObject): ClusterGateway {
  return {
    ...baseOf(item),
    ...toProjectGateway(item),
    scope: isClusterGatewayNamespace(item.metadata?.namespace) ? 'cluster' : 'project',
  };
}

export function clusterGatewaysApi(client: Client) {
  return {
    async list({ cluster, signal }: { cluster: string; signal?: AbortSignal }): Promise<ClusterGateway[]> {
      const prefix = cluster && cluster !== 'host' ? `clusters/${encodeURIComponent(cluster)}/` : '';
      const response = await client.request<{ items?: KubeObject[] }>(
        `/apis/gateway.kubesphere.io/v1alpha1/${prefix}gateways`,
        { ...(signal ? { signal } : {}) },
      );
      return (response?.items ?? []).map(toClusterGateway);
    },
  };
}
