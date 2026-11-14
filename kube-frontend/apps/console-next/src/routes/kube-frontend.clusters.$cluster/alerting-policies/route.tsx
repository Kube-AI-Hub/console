import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/clusters/$cluster/alerting-policies` — layout for the 告警策略 page. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/alerting-policies')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
