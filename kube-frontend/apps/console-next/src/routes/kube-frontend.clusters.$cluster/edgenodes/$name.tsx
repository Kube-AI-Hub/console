import * as React from 'react';
import { createFileRoute, useParams } from '@tanstack/react-router';
import { NodeDetailPage } from '@/pages/cluster/NodeDetailPage';

export const Route = createFileRoute('/kube-frontend/clusters/$cluster/edgenodes/$name')({
  component: Page,
});

function Page(): React.ReactElement {
  const { cluster, name } = useParams({ from: '/kube-frontend/clusters/$cluster/edgenodes/$name' });
  return <NodeDetailPage cluster={cluster} name={name} backTo="/kube-frontend/clusters/$cluster/edgenodes" />;
}
