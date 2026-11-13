import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ComponentsPage } from '@/pages/cluster/ComponentsPage';

/** `…/clusters/$cluster/components` — 集群级系统组件列表。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/components/')({
  component: ComponentsRoute,
});

function ComponentsRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <ComponentsPage cluster={cluster} />;
}
