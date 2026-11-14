import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `/kube-frontend/apps` — layout so the path owns exactly one page. */
export const Route = createFileRoute('/kube-frontend/apps')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
