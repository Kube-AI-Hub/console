import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/clusters/$cluster/edgenodes` — its own area because edge nodes are excluded from the node list. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/edgenodes')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
