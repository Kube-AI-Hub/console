import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/clusters/$cluster/devops/$name` — layout so the project detail and its pipeline pages nest. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/devops/$name')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
