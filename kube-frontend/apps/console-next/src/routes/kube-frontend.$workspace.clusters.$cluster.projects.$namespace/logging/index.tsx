import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { LogCollectionPage } from '@/pages/settings/LogCollectionPage';

/** `…/projects/$namespace/logging` — 项目日志收集。 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/logging/')({
  component: loggingRoute,
});

function loggingRoute(): React.ReactElement {
  const { cluster, namespace } = Route.useParams();
  return <LogCollectionPage cluster={cluster} namespace={namespace} />;
}
