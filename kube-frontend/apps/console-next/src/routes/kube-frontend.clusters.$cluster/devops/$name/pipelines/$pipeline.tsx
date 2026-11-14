import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { PipelineDetailPage } from '@/pages/devops/PipelineDetailPage';

/** `…/clusters/$cluster/devops/$name/pipelines/$pipeline` — 流水线详情与运行记录。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/devops/$name/pipelines/$pipeline')({
  component: pipelineDetailRoute,
});

function pipelineDetailRoute(): React.ReactElement {
  const { cluster, name, pipeline } = Route.useParams();
  return <PipelineDetailPage cluster={cluster} devops={name} pipeline={pipeline} />;
}
