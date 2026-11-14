import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterEventsPage } from '@/pages/cluster/ClusterEventsPage';

/** `…/clusters/$cluster/events` — 资源事件查询。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/events/')({
  component: eventsRoute,
});

function eventsRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <ClusterEventsPage cluster={cluster} />;
}
