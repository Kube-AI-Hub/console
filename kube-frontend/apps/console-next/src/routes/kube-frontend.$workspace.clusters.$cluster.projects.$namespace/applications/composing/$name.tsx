import { createFileRoute } from '@tanstack/react-router';
import { ComposedAppDetailPage } from '@/pages/appstore/ComposedAppDetailPage';

export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/applications/composing/$name')({
  component: Page,
});

function Page() {
  const { workspace, cluster, namespace, name } = Route.useParams();
  return <ComposedAppDetailPage workspace={workspace} cluster={cluster} namespace={namespace} name={name} />;
}
