import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/clusters/$cluster/jobs` — cluster-wide jobs list. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/jobs')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
