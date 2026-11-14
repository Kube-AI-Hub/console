import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/clusters/$cluster/alerting-messages` — layout for the 告警消息 page. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/alerting-messages')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
