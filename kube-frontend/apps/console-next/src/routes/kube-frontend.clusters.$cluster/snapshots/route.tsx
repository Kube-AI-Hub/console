import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** Layout for the old console's `/snapshots` alias. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/snapshots')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
