import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/clusters/$cluster/services` — cluster-wide services list. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/services')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
