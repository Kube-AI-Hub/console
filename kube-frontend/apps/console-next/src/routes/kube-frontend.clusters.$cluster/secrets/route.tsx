import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/clusters/$cluster/secrets` — cluster-wide secrets list. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/secrets')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
