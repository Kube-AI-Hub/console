import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `/kube-frontend/access/clusterroles` — layout so the path owns exactly one page. */
export const Route = createFileRoute('/kube-frontend/access/clusterroles')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
