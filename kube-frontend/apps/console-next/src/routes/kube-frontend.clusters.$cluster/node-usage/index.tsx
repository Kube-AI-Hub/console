import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { NodeUsagePage } from '@/pages/cluster/NodeUsagePage';

/** `…/clusters/$cluster/node-usage` — 节点用量。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/node-usage/')({
  component: nodeUsageRoute,
});

function nodeUsageRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <NodeUsagePage cluster={cluster} />;
}
