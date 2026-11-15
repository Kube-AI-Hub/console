import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { DashboardPanelsPage } from '@/pages/cluster/DashboardPanelsPage';

/** `…/clusters/$cluster/custom-monitoring/$name` — one dashboard's panels, read only. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/custom-monitoring/$name')({
  component: Page,
});

function Page(): React.ReactElement {
  const { cluster, name } = Route.useParams();
  return <DashboardPanelsPage cluster={cluster} name={name} />;
}
