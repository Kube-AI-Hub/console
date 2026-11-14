import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/** `…/federatedprojects/$name` — 联邦项目详情与其中资源详情的布局。 */
export const Route = createFileRoute('/kube-frontend/workspaces/$workspace/federatedprojects/$name')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
