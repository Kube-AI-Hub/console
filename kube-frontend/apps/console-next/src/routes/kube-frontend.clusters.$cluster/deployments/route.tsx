import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/clusters/$cluster/deployments` — cluster-wide deployments list. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/deployments')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
