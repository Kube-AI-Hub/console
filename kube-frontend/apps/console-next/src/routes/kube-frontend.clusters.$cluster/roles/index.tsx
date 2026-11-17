import { createFileRoute } from '@tanstack/react-router';
import { ClusterRolesPage } from '@/pages/cluster/ClusterRolesPage';

export const Route = createFileRoute('/kube-frontend/clusters/$cluster/roles/')({
  component: Page,
});

function Page() {
  const { cluster } = Route.useParams();
  return <ClusterRolesPage cluster={cluster} />;
}
