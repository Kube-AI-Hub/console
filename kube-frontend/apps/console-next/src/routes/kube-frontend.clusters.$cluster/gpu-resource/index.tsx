import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { GpuResourcePage } from '@/pages/cluster/GpuResourcePage';

/** `…/clusters/$cluster/gpu-resource` — GPU 资源监控。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/gpu-resource/')({
  component: gpuResourceRoute,
});

function gpuResourceRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <GpuResourcePage cluster={cluster} />;
}
