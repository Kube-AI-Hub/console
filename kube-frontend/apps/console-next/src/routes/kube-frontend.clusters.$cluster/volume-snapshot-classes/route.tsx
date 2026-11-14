import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/clusters/$cluster/volume-snapshot-classes` — cluster snapshot classes. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/volume-snapshot-classes')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
