import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/clusters/$cluster/juicefs-storage` — JuiceFS shared storage, three tabs. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/juicefs-storage')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
