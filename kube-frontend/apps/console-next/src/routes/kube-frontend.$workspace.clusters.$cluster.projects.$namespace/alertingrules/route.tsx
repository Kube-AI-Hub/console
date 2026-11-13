import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/projects/:namespace/alertingrules` — layout so the path owns exactly one page. */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/alertingrules')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
