import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterSettingsPage } from '@/pages/cluster/ClusterSettingsPage';

/** `…/clusters/$cluster/settings` — 集群设置。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/settings/')({
  component: settingsRoute,
});

function settingsRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <ClusterSettingsPage cluster={cluster} />;
}
