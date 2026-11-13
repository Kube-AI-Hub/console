import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/clusters/$cluster/overview` — layout so the path owns exactly one page. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/overview')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
