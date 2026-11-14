import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ImageBuilderPage } from '@/pages/app-workloads/ImageBuilderPage';

/** `…/projects/:namespace/s2ibuilder` — 镜像构建器（S2I/B2I，只读）。 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/s2ibuilder/')({
  component: imageBuilderRoute,
});

function imageBuilderRoute(): React.ReactElement {
  const { cluster, namespace } = Route.useParams();
  return <ImageBuilderPage cluster={cluster} namespace={namespace} />;
}
