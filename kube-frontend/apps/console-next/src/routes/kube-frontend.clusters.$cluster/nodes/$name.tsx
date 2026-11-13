import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { NodeDetailPage } from '@/pages/cluster/NodeDetailPage';

/** `…/clusters/$cluster/nodes/$name` — 节点详情。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/nodes/$name')({
  component: nodeDetailRoute,
});

function nodeDetailRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <NodeDetailPage cluster={cluster} />;
}
