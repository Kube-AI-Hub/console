import { createFileRoute } from '@tanstack/react-router';
import { ComposedAppsPage } from '@/pages/appstore/ComposedAppsPage';

export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/applications/composing/')({
  component: Page,
});

function Page() {
  const { workspace, cluster, namespace } = Route.useParams();
  return <ComposedAppsPage workspace={workspace} cluster={cluster} namespace={namespace} />;
}
