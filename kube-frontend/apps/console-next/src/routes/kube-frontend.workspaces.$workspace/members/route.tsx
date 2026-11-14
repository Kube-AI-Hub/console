import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/workspaces/$workspace/members` — layout so the list and a member share one path. */
export const Route = createFileRoute('/kube-frontend/workspaces/$workspace/members')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
