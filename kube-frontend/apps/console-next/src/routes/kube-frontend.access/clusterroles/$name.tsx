import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterRoleDetailPage } from '@/pages/platform/ClusterRoleDetailPage';

/** `/kube-frontend/access/clusterroles/$name` — 平台角色详情。 */
export const Route = createFileRoute('/kube-frontend/access/clusterroles/$name')({
  component: clusterRoleDetailRoute,
});

function clusterRoleDetailRoute(): React.ReactElement {
  return <ClusterRoleDetailPage />;
}
