import { useQuery } from '@tanstack/react-query';
import { accessReviewApi } from '@kube-ai-hub/api-client';
import { api } from '@/api';

export type StrategyVerb = 'create' | 'delete';

/**
 * Whether the reader may write strategies in this project.
 *
 * The old console gated these with a module permission (grayscale-release / create,
 * delete). The new console asks the cluster directly, for the same verb/resource the
 * write will use, so the control's state and the request agree.
 *
 * It fails **open**: only an explicit allowed=false hides or disables a control. A
 * permission check that errors must not take a permitted write away from its reader.
 */
export function useStrategyPermission(verb: StrategyVerb, cluster: string, namespace: string, name?: string) {
  const query = useQuery({
    queryKey: ['canary-permission', verb, cluster, namespace, name ?? ''],
    enabled: Boolean(cluster) && Boolean(namespace),
    // A role change is rare; asking on every refetch would add a write-adjacent call to
    // every render.
    staleTime: 60_000,
    retry: false,
    queryFn: ({ signal }) =>
      accessReviewApi(api).allowed({
        verb,
        resource: 'strategies',
        group: 'servicemesh.kubesphere.io',
        namespace,
        ...(name ? { name } : {}),
        signal,
      }),
  });
  return { denied: query.data === false, pending: query.isPending };
}
