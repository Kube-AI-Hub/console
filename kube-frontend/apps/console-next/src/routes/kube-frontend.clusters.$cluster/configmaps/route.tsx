import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/clusters/$cluster/configmaps` — cluster-wide configmaps list. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/configmaps')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
