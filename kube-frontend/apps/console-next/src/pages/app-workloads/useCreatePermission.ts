import { useQuery } from '@tanstack/react-query';
import { accessReviewApi, type WorkloadKind } from '@kube-ai-hub/api-client';
import { api } from '@/api';
import { useT } from '@/i18n';

/**
 * Whether the reader may create the network resources of this page.
 *
 * The check is a `SelfSubjectAccessReview` for the same verb/resource/namespace the
 * create POST will use, so the button's state and the write agree. It fails **open**:
 * a permission check that errors (an older BFF, a network blip) must not disable a
 * control the reader is allowed to use, so only an explicit `allowed: false` disables
 * the button. The check only runs for Service and Ingress lists; other kinds keep
 * their single create entry untouched.
 */
export interface CreatePermission {
  disabled: boolean;
  /** Why it is disabled, for the visible explanation next to the button. */
  hint?: string;
}

export function useCreatePermission(kind: WorkloadKind, cluster: string, namespace: string): CreatePermission {
  const t = useT();
  const checkable = kind === 'services' || kind === 'ingresses';
  const query = useQuery({
    queryKey: ['can-create', kind, cluster, namespace],
    enabled: checkable && Boolean(cluster) && Boolean(namespace),
    // One minute: a role change is rare, and asking on every list refetch would add a
    // write-adjacent call to every page render.
    staleTime: 60_000,
    retry: false,
    queryFn: ({ signal }) =>
      accessReviewApi(api).allowed({
        verb: 'create',
        resource: kind,
        ...(kind === 'ingresses' ? { group: 'networking.k8s.io' } : {}),
        namespace,
        signal,
      }),
  });

  if (query.data !== false) return { disabled: false };
  const resource = kind === 'services' ? t('workloads.services.title') : t('workloads.ingresses.title');
  return { disabled: true, hint: t('networkCreate.noPermission', { resource }) };
}
