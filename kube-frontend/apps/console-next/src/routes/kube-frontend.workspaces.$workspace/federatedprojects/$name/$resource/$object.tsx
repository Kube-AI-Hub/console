import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { FederatedResourceDetailPage } from '@/pages/federated/FederatedResourceDetailPage';

/** `…/federatedprojects/$name/$resource/$object` — 联邦资源详情（只读）。 */
export const Route = createFileRoute('/kube-frontend/workspaces/$workspace/federatedprojects/$name/$resource/$object')({
  component: federatedResourceDetailRoute,
});

function federatedResourceDetailRoute(): React.ReactElement {
  const { workspace, name, resource, object } = Route.useParams();
  return (
    <FederatedResourceDetailPage
      workspace={workspace}
      projectName={name}
      resource={resource}
      object={object}
    />
  );
}
