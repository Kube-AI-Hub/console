import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { namespacesApi } from '@kube-ai-hub/api-client';
import { api as apiClient } from '@/api';

/**
 * 集群级跨项目页共用的「项目 → 企业空间」索引.
 *
 * A cluster-wide row carries the project it lives in, but not the workspace that
 * project belongs to — a Secret or a PVC has no idea which enterprise space owns
 * its namespace. The project console's URL needs both segments, so every cluster
 * page reads the namespace list once and indexes it by name.
 *
 * The query key is shared with the other cluster pages (cluster-pods,
 * cluster-workloads): switching between them reuses the same cached read instead
 * of asking the apiserver for the same namespaces on every navigation.
 */
export function useClusterProjectIndex(cluster: string): ReadonlyMap<string, string> {
  const namespaces = useQuery({
    queryKey: ['namespaces-for-workspace', cluster],
    queryFn: ({ signal }) => namespacesApi(apiClient).list({ cluster, namespace: '', page: 1, pageSize: 500, signal }),
  });

  return React.useMemo(() => {
    const map = new Map<string, string>();
    for (const namespace of namespaces.data?.items ?? []) {
      map.set(namespace.name, namespace.workspace || 'public');
    }
    return map;
  }, [namespaces.data]);
}

/** A cluster page's link into one object's own project console. */
export function projectObjectUrl(params: {
  cluster: string;
  workspace: string;
  namespace: string;
  page:
    | 'secrets'
    | 'configmaps'
    | 'serviceaccounts'
    | 'persistentvolumeclaims'
    | 'ingresses'
    | 'deployments'
    | 'statefulsets'
    | 'daemonsets'
    | 'jobs'
    | 'cronjobs'
    | 'services'
    | 'pods';
  name: string;
}): string {
  return (
    '/kube-frontend/' +
    encodeURIComponent(params.workspace) +
    '/clusters/' +
    encodeURIComponent(params.cluster) +
    '/projects/' +
    encodeURIComponent(params.namespace) +
    '/' +
    params.page +
    '/' +
    encodeURIComponent(params.name)
  );
}

/**
 * Row handle for a cluster-wide list.
 *
 * `name` is not unique across projects — kube-root-ca.crt exists in every
 * namespace — so the row key includes the project. A name-only key collides in
 * React and makes an automation locator match several rows.
 */
export function clusterProjectRowId(row: { namespace: string; name: string }): string {
  return row.namespace + '/' + row.name;
}
