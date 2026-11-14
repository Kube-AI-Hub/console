import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/clusters/$cluster/monitor-resource` — 应用资源监控（工作负载 / 容器组）。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/monitor-resource')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
