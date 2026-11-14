import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { NamespaceDetailPage } from '@/pages/cluster/NamespaceDetailPage';

/** `…/clusters/$cluster/namespaces/$name` — 集群作用域的项目详情。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/namespaces/$name')({
  component: namespaceDetailRoute,
});

function namespaceDetailRoute(): React.ReactElement {
  const { cluster, name } = Route.useParams();
  return <NamespaceDetailPage cluster={cluster} name={name} />;
}
