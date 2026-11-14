import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { FederatedProjectDetailPage } from '@/pages/federated/FederatedProjectDetailPage';

/** `…/workspaces/$workspace/federatedprojects/$name` — 联邦项目详情骨架。 */
export const Route = createFileRoute('/kube-frontend/workspaces/$workspace/federatedprojects/$name/')({
  component: federatedProjectDetailRoute,
});

function federatedProjectDetailRoute(): React.ReactElement {
  const { workspace, name } = Route.useParams();
  return <FederatedProjectDetailPage workspace={workspace} name={name} />;
}
