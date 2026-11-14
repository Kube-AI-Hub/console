import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/clusters/$cluster/logs` — layout for the 容器日志查询 page. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/logs')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
