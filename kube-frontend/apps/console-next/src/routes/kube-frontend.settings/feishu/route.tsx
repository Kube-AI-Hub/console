import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `/kube-frontend/settings/feishu` — layout so the path owns exactly one page. */
export const Route = createFileRoute('/kube-frontend/settings/feishu')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
