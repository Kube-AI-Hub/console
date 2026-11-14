import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/clusters/$cluster/volume-snapshots` — cluster-wide volume snapshots. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/volume-snapshots')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
