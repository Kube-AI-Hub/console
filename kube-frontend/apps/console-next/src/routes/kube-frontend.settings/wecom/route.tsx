import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `/kube-frontend/settings/wecom` — layout so the path owns exactly one page. */
export const Route = createFileRoute('/kube-frontend/settings/wecom')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
