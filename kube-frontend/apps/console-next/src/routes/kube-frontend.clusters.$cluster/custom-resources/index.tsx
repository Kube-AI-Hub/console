import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { CustomResourcesPage } from '@/pages/cluster/CustomResourcesPage';

/** `…/clusters/$cluster/custom-resources` — 自定义资源。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/custom-resources/')({
  component: customResourcesRoute,
});

function customResourcesRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <CustomResourcesPage cluster={cluster} />;
}
