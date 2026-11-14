import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ComponentDetailPage } from '@/pages/cluster/ComponentDetailPage';

/** `…/clusters/$cluster/components/$name` — one platform component. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/components/$name')({
  component: Page,
});

function Page(): React.ReactElement {
  return <ComponentDetailPage />;
}
