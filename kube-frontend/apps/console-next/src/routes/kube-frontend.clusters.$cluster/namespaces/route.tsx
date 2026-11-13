import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/clusters/$cluster/namespaces` — layout so the path owns exactly one page. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/namespaces')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
