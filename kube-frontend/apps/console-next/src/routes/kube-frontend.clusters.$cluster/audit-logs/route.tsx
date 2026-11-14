import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/clusters/$cluster/audit-logs` — layout for the 审计日志查询 page. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/audit-logs')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
