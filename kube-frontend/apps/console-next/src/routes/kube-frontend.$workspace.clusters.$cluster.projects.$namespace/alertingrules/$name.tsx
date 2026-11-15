import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import type { RuleGroupScope } from '@kube-ai-hub/api-client';
import { RuleGroupDetailPage } from '@/pages/monitoring/RuleGroupDetailPage';

/**
 * `…/projects/:namespace/alertingrules/:name` — one policy's rules and alert messages.
 *
 * `scope` is a search parameter: the list merges global, cluster and project rule
 * groups, and the same name can exist in two collections. It defaults to `project`
 * so a hand-written URL still resolves to the project's own policies.
 */
export const Route = createFileRoute(
  '/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/alertingrules/$name',
)({
  validateSearch: (search: Record<string, unknown>): { scope: RuleGroupScope } => {
    const scope = search.scope;
    return { scope: scope === 'global' || scope === 'cluster' || scope === 'project' ? scope : 'project' };
  },
  component: alertingRuleDetailRoute,
});

function alertingRuleDetailRoute(): React.ReactElement {
  const { cluster, namespace, name } = Route.useParams();
  const { scope } = Route.useSearch();
  return <RuleGroupDetailPage cluster={cluster} namespace={namespace} name={name} scope={scope} />;
}
