import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ConfigMapsPage } from '@/pages/configmaps/ConfigMapsPage';

/**
 * `/kube-frontend/:workspace/clusters/:cluster/projects/:namespace/configmaps`
 *
 * 配置字典列表。父布局（`route.tsx`）负责工作区栏与 配置 页签，本文件只渲染页面本身；
 * 详情是同级子路由 `configmaps.$name.tsx`，因此列表不必再判断"末尾有没有名称"。
 *
 * 路径与老 console 完全一致（只多 `/kube-frontend` 前缀），没有区域段（DEC-AREA-01）。
 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/configmaps/')({
  component: ConfigMapsPageRoute,
});

function ConfigMapsPageRoute(): React.ReactElement {
  const { workspace, cluster, namespace } = Route.useParams();
  return <ConfigMapsPage workspace={workspace} cluster={cluster} namespace={namespace} />;
}
