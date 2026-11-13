import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/projects/:namespace/networkpolicies` — layout so the path owns exactly one page. */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/networkpolicies')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
