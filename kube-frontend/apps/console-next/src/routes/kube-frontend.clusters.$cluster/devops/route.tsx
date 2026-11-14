import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/clusters/$cluster/devops` — layout for the DevOps area. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/devops')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
