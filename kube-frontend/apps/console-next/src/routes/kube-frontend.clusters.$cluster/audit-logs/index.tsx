import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterAuditLogsPage } from '@/pages/cluster/ClusterAuditLogsPage';

/** `…/clusters/$cluster/audit-logs` — 审计日志查询。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/audit-logs/')({
  component: clusterAuditLogsRoute,
});

function clusterAuditLogsRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <ClusterAuditLogsPage cluster={cluster} />;
}
