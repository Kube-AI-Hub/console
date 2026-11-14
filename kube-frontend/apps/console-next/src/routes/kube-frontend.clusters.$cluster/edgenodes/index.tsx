import * as React from 'react';
import { createFileRoute, useParams } from '@tanstack/react-router';
import { EdgeNodesPage } from '@/pages/cluster/EdgeNodesPage';

export const Route = createFileRoute('/kube-frontend/clusters/$cluster/edgenodes/')({
  component: Page,
});

function Page(): React.ReactElement {
  const { cluster } = useParams({ from: '/kube-frontend/clusters/$cluster/edgenodes/' });
  return <EdgeNodesPage cluster={cluster} />;
}
