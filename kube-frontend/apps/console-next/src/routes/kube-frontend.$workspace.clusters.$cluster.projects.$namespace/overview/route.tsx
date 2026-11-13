import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** Project overview page folder; the path owns exactly one page. */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/overview')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
