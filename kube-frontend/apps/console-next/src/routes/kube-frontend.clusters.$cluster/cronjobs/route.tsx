import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/clusters/$cluster/cronjobs` — cluster-wide cronjobs list. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/cronjobs')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
