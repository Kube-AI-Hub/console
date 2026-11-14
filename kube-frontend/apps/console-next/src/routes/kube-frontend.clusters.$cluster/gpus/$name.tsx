import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { GpuDetailPage } from '@/pages/cluster/GpuDetailPage';

/** `…/clusters/$cluster/gpus/$name` — 单卡详情；`$name` 是显卡 UUID。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/gpus/$name')({
  component: gpuDetailRoute,
});

function gpuDetailRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <GpuDetailPage cluster={cluster} />;
}
