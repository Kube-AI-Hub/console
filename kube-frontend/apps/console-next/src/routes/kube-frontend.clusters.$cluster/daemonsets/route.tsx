import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/clusters/$cluster/daemonsets` — cluster-wide daemonsets list. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/daemonsets')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
