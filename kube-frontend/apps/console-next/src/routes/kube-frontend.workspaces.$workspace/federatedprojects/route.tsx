import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/workspaces/$workspace/federatedprojects` — 联邦项目列表与详情的布局。 */
export const Route = createFileRoute('/kube-frontend/workspaces/$workspace/federatedprojects')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
