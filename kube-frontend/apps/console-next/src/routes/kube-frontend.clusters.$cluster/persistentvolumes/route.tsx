import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/clusters/$cluster/persistentvolumes` — layout so the path owns one page. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/persistentvolumes')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
