import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/clusters/$cluster/persistentvolumeclaims` — cluster-wide PVC list. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/persistentvolumeclaims')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
