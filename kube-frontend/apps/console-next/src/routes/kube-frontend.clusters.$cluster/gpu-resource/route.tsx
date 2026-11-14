import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/clusters/$cluster/gpu-resource` — layout for the GPU trend page. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/gpu-resource')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
