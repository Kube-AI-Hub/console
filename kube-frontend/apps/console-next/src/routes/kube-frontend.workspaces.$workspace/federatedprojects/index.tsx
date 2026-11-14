import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { FederatedProjectsPage } from '@/pages/federated/FederatedProjectsPage';

/** `…/workspaces/$workspace/federatedprojects` — 联邦项目列表。 */
export const Route = createFileRoute('/kube-frontend/workspaces/$workspace/federatedprojects/')({
  component: federatedProjectsRoute,
});

function federatedProjectsRoute(): React.ReactElement {
  const { workspace } = Route.useParams();
  return <FederatedProjectsPage workspace={workspace} />;
}
