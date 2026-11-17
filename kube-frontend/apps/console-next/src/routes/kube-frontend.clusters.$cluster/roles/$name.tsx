import { createFileRoute } from '@tanstack/react-router';
import { ClusterRoleDetailPage } from '@/pages/cluster/ClusterRoleDetailPage';

export const Route = createFileRoute('/kube-frontend/clusters/$cluster/roles/$name')({
  component: Page,
});

function Page() {
  const { cluster, name } = Route.useParams();
  return <ClusterRoleDetailPage cluster={cluster} name={name} />;
}
