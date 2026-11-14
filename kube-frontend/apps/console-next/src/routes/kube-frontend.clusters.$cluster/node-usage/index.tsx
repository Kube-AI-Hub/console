import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { NodeUsagePage } from '@/pages/cluster/NodeUsagePage';
import { NODE_RANK_METRICS, type NodeRankMetric } from '@kube-ai-hub/api-client';

/** `…/clusters/$cluster/node-usage` — 节点用量。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/node-usage/')({
  validateSearch: (search: Record<string, unknown>): { metric?: NodeRankMetric } =>
    NODE_RANK_METRICS.includes(search.metric as NodeRankMetric) ? { metric: search.metric as NodeRankMetric } : {},
  component: nodeUsageRoute,
});

function nodeUsageRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  const { metric } = Route.useSearch();
  return <NodeUsagePage cluster={cluster} initialMetric={metric ?? 'node_cpu_utilisation'} />;
}
