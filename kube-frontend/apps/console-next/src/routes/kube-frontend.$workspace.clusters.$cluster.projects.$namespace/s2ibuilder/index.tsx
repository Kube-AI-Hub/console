import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ImageBuilderPage } from '@/pages/app-workloads/ImageBuilderPage';
import { ensureImageBuilderRegistered } from '@/pages/app-workloads/imagebuilder/queries';

/** `…/projects/:namespace/s2ibuilder` — 镜像构建器（S2I/B2I）列表。 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/s2ibuilder/')({
  component: imageBuilderRoute,
});

function imageBuilderRoute(): React.ReactElement {
  const { workspace, cluster, namespace } = Route.useParams();
  ensureImageBuilderRegistered();
  return <ImageBuilderPage workspace={workspace} cluster={cluster} namespace={namespace} />;
}
