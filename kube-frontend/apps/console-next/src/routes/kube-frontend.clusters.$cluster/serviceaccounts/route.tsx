import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/clusters/$cluster/serviceaccounts` — cluster-wide serviceaccounts list. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/serviceaccounts')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
