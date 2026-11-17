import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { RuleGroupDetailPage } from '@/pages/monitoring/RuleGroupDetailPage';

/**
 * `…/clusters/:cluster/alerting-policies/:name` — one cluster alerting policy.
 *
 * The cluster page has two tabs; a policy's collection is decided by whether it is a
 * custom cluster policy (clusterrulegroups) or an installer-owned global one
 * (globalrulegroups). The row already knows which, so it passes `scope` as a search
 * parameter, exactly like the project page's detail route. It defaults to `cluster`
 * for a hand-written URL: that is the collection this page's create button writes to.
 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/alerting-policies/$name')({
  validateSearch: (search: Record<string, unknown>): { scope: 'cluster' | 'global' } => ({
    scope: search.scope === 'global' ? 'global' : 'cluster',
  }),
  component: clusterAlertingPolicyDetailRoute,
});

function clusterAlertingPolicyDetailRoute(): React.ReactElement {
  const { cluster, name } = Route.useParams();
  const { scope } = Route.useSearch();
  return <RuleGroupDetailPage cluster={cluster} name={name} scope={scope} from="cluster" />;
}
