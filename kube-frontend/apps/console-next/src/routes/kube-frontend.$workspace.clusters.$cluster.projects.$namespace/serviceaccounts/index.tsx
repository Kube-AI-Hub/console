import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ServiceAccountsPage } from '@/pages/serviceaccounts/ServiceAccountsPage';

/**
 * `/kube-frontend/:workspace/clusters/:cluster/projects/:namespace/serviceaccounts`
 *
 * 服务账户列表。父布局（`route.tsx`）负责工作区栏与 配置 页签，本文件只渲染页面本身；
 * 详情是同级子路由 `serviceaccounts.$name.tsx`，因此列表不必再判断"末尾有没有名称"。
 *
 * 路径与老 console 完全一致（只多 `/kube-frontend` 前缀），没有区域段（DEC-AREA-01）。
 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/serviceaccounts/')({
  component: ServiceAccountsPageRoute,
});

function ServiceAccountsPageRoute(): React.ReactElement {
  const { workspace, cluster, namespace } = Route.useParams();
  return <ServiceAccountsPage workspace={workspace} cluster={cluster} namespace={namespace} />;
}
