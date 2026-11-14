import type { Client } from './client';
import { baseOf, type KubeObject, type ResourceBase } from './resources';
import { toProjectGateway, type ProjectGateway } from './storage';

export interface ClusterGateway extends ResourceBase, ProjectGateway {
  scope: 'cluster' | 'project';
}

export function toClusterGateway(item: KubeObject): ClusterGateway {
  return {
    ...baseOf(item),
    ...toProjectGateway(item),
    scope: item.metadata?.name === 'kubesphere-router-kubesphere-system' && item.metadata?.namespace === 'kubesphere-system' ? 'cluster' : 'project',
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
