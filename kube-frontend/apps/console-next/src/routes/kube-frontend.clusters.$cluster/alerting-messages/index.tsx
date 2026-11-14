import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterAlertingMessagesPage } from '@/pages/cluster/ClusterAlertingMessagesPage';

/** `…/clusters/$cluster/alerting-messages` — 告警消息。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/alerting-messages/')({
  component: clusterAlertingRoute,
});

function clusterAlertingRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <ClusterAlertingMessagesPage cluster={cluster} />;
}
