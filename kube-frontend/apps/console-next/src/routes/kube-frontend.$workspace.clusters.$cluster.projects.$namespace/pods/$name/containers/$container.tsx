import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ContainerDetailPage } from '@/pages/app-workloads/ContainerDetailPage';

/** `/…/pods/$name/containers/$container` — 容器详情。 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/pods/$name/containers/$container')({
  component: containerDetailRoute,
});

function containerDetailRoute(): React.ReactElement {
  const { workspace, cluster, namespace, name, container } = Route.useParams();
  return (
    <ContainerDetailPage
      workspace={workspace}
      cluster={cluster}
      namespace={namespace}
      pod={name}
      container={container}
    />
  );
}
