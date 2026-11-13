import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/projects/:namespace/alerts` — layout so the path owns exactly one page. */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/alerts')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
