import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/workspaces/$workspace/roles` — layout so the path owns exactly one page. */
export const Route = createFileRoute('/kube-frontend/workspaces/$workspace/roles')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
