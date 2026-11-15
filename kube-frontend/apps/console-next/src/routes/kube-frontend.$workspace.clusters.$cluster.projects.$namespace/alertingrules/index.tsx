import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { MonitoringListPage } from '@/pages/monitoring/MonitoringListPage';

/** `…/projects/:namespace/alertingrules` — the alertingrules list. */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/alertingrules/')({
  component: alertingrulesRoute,
});

function alertingrulesRoute(): React.ReactElement {
  const { workspace, cluster, namespace } = Route.useParams();
  return <MonitoringListPage kind="alertingrules" workspace={workspace} cluster={cluster} namespace={namespace} />;
}
