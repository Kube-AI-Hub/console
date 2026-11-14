import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { GpusPage } from '@/pages/cluster/GpusPage';

/** `…/clusters/$cluster/gpus` — 集群显卡列表。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/gpus/')({
  component: gpusRoute,
});

function gpusRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <GpusPage cluster={cluster} />;
}
