import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ComponentsPage } from '@/pages/cluster/ComponentsPage';

/** `…/clusters/$cluster/components` — 集群级系统组件列表。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/components/')({
  validateSearch: (search: Record<string, unknown>): { type?: string } =>
    typeof search.type === 'string' ? { type: search.type } : {},
  component: ComponentsRoute,
});

function ComponentsRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  const { type } = Route.useSearch();
  return <ComponentsPage cluster={cluster} initialType={type ?? ''} />;
}
