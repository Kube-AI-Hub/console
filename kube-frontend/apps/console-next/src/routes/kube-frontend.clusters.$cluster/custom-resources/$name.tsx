import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { CustomResourceDetailPage } from '@/pages/cluster/CustomResourceDetailPage';

/** `…/clusters/$cluster/custom-resources/$name` — 自定义资源详情（定义 + 实例）。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/custom-resources/$name')({
  component: customResourceDetailRoute,
});

function customResourceDetailRoute(): React.ReactElement {
  const { cluster, name } = Route.useParams();
  return <CustomResourceDetailPage cluster={cluster} name={name} />;
}
