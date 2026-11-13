import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/clusters/$cluster/members` — layout so the path owns exactly one page. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/members')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
