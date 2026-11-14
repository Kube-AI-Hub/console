import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/workspaces/$workspace/repos` — layout so the path owns exactly one page. */
export const Route = createFileRoute('/kube-frontend/workspaces/$workspace/repos')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
