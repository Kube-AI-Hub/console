import { useQuery } from '@tanstack/react-query';
import { accessReviewApi } from '@kube-ai-hub/api-client';
import { api } from '@/api';

/**
 * Whether the reader may write alerting policies, asked per resource.
 *
 * The three rule-group resources are separate resources in the API, so one answer
 * cannot cover them: a project `rulegroups` write is namespaced, while
 * `clusterrulegroups` and `globalrulegroups` are cluster-scoped and usually
 * installer-owned. Asking `SelfSubjectAccessReview` with the same verb/resource/
 * namespace the write will use is the only client-side check that agrees with the
 * server.
 *
 * The check **fails open**: only an explicit `allowed: false` hides a control. A
 * failed review (older BFF, network blip) must not take away an action the reader
 * is entitled to, and the write itself would reject with 403 if it were not.
 */
const GROUP = 'alerting.kubesphere.io';

const RESOURCES = {
  project: 'rulegroups',
  cluster: 'clusterrulegroups',
  global: 'globalrulegroups',
} as const;

export type AlertingPolicyScope = keyof typeof RESOURCES;

export interface RuleGroupPermissions {
  /** Create is only ever offered inside one project. */
  create: boolean;
  update: Record<AlertingPolicyScope, boolean>;
  deleteProject: boolean;
  /** True while the reviews are in flight; callers keep entries enabled meanwhile. */
  loading: boolean;
}

const ALLOW_ALL: RuleGroupPermissions = {
  create: true,
  update: { project: true, cluster: true, global: true },
  deleteProject: true,
  loading: false,
};

export function useRuleGroupPermissions(params: { cluster: string; namespace: string }): RuleGroupPermissions {
  const query = useQuery({
    queryKey: ['alerting-permissions', params.cluster, params.namespace],
    // A role change is rare and these are write-adjacent calls: one minute avoids a
    // review on every list refetch while still noticing a grant within a page visit.
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const review = accessReviewApi(api);
      const [create, updateProject, deleteProject, updateCluster, updateGlobal] = await Promise.all([
        review.allowed({ verb: 'create', resource: RESOURCES.project, group: GROUP, namespace: params.namespace }),
        review.allowed({ verb: 'update', resource: RESOURCES.project, group: GROUP, namespace: params.namespace }),
        review.allowed({ verb: 'delete', resource: RESOURCES.project, group: GROUP, namespace: params.namespace }),
        review.allowed({ verb: 'update', resource: RESOURCES.cluster, group: GROUP }),
        review.allowed({ verb: 'update', resource: RESOURCES.global, group: GROUP }),
      ]);
      return {
        create,
        update: { project: updateProject, cluster: updateCluster, global: updateGlobal },
        deleteProject,
      };
    },
  });

  if (!query.data) return ALLOW_ALL;
  return {
    create: query.data.create,
    update: query.data.update,
    deleteProject: query.data.deleteProject,
    loading: query.isPending,
  };
}
