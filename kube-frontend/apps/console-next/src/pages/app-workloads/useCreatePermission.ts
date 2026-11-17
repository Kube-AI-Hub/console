import { useQuery } from '@tanstack/react-query';
import { accessReviewApi, type WorkloadKind } from '@kube-ai-hub/api-client';
import { api } from '@/api';
import { useT } from '@/i18n';

/**
 * Whether the reader may create the resources of this page.
 *
 * The check is a `SelfSubjectAccessReview` for the same verb/resource/namespace the
 * create POST will use, so the button's state and the write agree. It fails **open**:
 * a permission check that errors (an older BFF, a network blip) must not disable a
 * control the reader is allowed to use, so only an explicit `allowed: false` disables
 * the button.
 *
 * Every writable workload kind is checked: a project viewer sees the create entry
 * disabled with the reason instead of clicking into a form that 403s.
 */
export interface CreatePermission {
  disabled: boolean;
  /** Why it is disabled, for the visible explanation next to the button. */
  hint?: string;
}

const KIND_GROUP: Partial<Record<string, string>> = {
  deployments: 'apps',
  statefulsets: 'apps',
  daemonsets: 'apps',
  jobs: 'batch',
  cronjobs: 'batch',
  ingresses: 'networking.k8s.io',
};

const KIND_TITLE: Partial<Record<string, string>> = {
  deployments: 'workloads.deployments.title',
  statefulsets: 'workloads.statefulsets.title',
  daemonsets: 'workloads.daemonsets.title',
  jobs: 'workloads.jobs.title',
  cronjobs: 'workloads.cronjobs.title',
  services: 'workloads.services.title',
  ingresses: 'workloads.ingresses.title',
};

export function useCreatePermission(kind: WorkloadKind, cluster: string, namespace: string): CreatePermission {
  const t = useT();
  const checkable = Boolean(KIND_TITLE[kind]);
  const group = KIND_GROUP[kind];
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
        ...(group ? { group } : {}),
        namespace,
        signal,
      }),
  });

  if (query.data !== false) return { disabled: false };
  const resource = t(KIND_TITLE[kind] as 'workloads.services.title');
  return { disabled: true, hint: t('networkCreate.noPermission', { resource }) };
}
