import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/workspaces/$workspace` — the workspace console's layout. */
export const Route = createFileRoute('/kube-frontend/workspaces/$workspace')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
