import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterAlertingPoliciesPage } from '@/pages/cluster/ClusterAlertingPoliciesPage';

/** `…/clusters/$cluster/alerting-policies` — 告警策略。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/alerting-policies/')({
  component: clusterAlertingRoute,
});

function clusterAlertingRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <ClusterAlertingPoliciesPage cluster={cluster} />;
}
