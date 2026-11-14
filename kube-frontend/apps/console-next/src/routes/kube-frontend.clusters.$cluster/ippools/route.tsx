import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/clusters/$cluster/ippools` — layout so the path owns the list and the detail. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/ippools')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
