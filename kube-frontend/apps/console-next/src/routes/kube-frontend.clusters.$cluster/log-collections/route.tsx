import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/clusters/$cluster/log-collections` — layout for the log collection page. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/log-collections')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
