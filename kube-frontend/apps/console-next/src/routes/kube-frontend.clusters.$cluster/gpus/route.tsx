import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/clusters/$cluster/gpus` — layout so the path owns both the list and the card. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/gpus')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
