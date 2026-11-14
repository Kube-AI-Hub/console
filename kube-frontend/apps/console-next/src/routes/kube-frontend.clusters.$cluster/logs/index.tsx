import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterLogsPage } from '@/pages/cluster/ClusterLogsPage';

/** `…/clusters/$cluster/logs` — 容器日志查询。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/logs/')({
  component: clusterLogsRoute,
});

function clusterLogsRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <ClusterLogsPage cluster={cluster} />;
}
