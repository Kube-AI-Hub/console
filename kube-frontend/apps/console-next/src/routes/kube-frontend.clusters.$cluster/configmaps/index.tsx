import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterConfigMapsPage } from '@/pages/configmaps/ClusterConfigMapsPage';

/** `…/clusters/$cluster/configmaps` — 跨全部项目的配置字典列表。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/configmaps/')({
  component: ClusterConfigMapsRoute,
});

function ClusterConfigMapsRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  const { namespace } = Route.useSearch();
  // Keyed on the filter so switching project remounts the page's local state.
  return (
    <ClusterConfigMapsPage key={`${cluster}/${namespace ?? ''}`} cluster={cluster} {...(namespace ? { namespace } : {})} />
  );
}
