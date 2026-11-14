import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/projects/:namespace/custom-monitoring` — layout so the path owns exactly one page. */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/custom-monitoring')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
