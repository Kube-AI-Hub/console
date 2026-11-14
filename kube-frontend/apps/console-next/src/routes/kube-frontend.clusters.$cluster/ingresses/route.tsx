import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/clusters/$cluster/ingresses` — cluster-wide ingresses list. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/ingresses')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
