import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ImageBuilderDetailPage } from '@/pages/app-workloads/imagebuilder/ImageBuilderDetailPage';
import { ensureImageBuilderRegistered } from '@/pages/app-workloads/imagebuilder/queries';

/**
 * `…/projects/:namespace/s2ibuilder/:name` — 镜像构建器详情.
 *
 * A sibling of the list inside the same folder; the folder's `route.tsx` renders
 * whichever of the two matches, so a detail URL never falls back to the list.
 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/s2ibuilder/$name')({
  component: imageBuilderDetailRoute,
});

function imageBuilderDetailRoute(): React.ReactElement {
  const { workspace, cluster, namespace, name } = Route.useParams();
  ensureImageBuilderRegistered();
  return <ImageBuilderDetailPage workspace={workspace} cluster={cluster} namespace={namespace} name={name} />;
}
