import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { MultiClusterListPage } from '@/pages/cluster/MultiClusterListPage';

/**
 * `/kube-frontend/clusters` — the platform's cluster list.
 *
 * This is the target of 平台管理 → 集群 in the header menu, which until now pointed at
 * a path with no route. It sits beside `clusters/$cluster` (the per-cluster console)
 * rather than inside it: the list is about the fleet, and the console is about one
 * cluster.
 */
export const Route = createFileRoute('/kube-frontend/clusters/')({
  component: clustersRoute,
});

function clustersRoute(): React.ReactElement {
  return <MultiClusterListPage />;
}
