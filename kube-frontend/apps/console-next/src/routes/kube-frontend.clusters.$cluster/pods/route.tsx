import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/clusters/$cluster/workloads/pods` — cluster-wide pod list. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/pods')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
