import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/workspaces/$workspace/apps` — layout so the path owns exactly one page. */
export const Route = createFileRoute('/kube-frontend/workspaces/$workspace/apps')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
