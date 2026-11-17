import { createFileRoute } from '@tanstack/react-router';
import { ClusterBillPage } from '@/pages/cluster/ClusterBillPage';

export const Route = createFileRoute('/kube-frontend/clusters/$cluster/bill/')({
  component: Page,
});

function Page() {
  const { cluster } = Route.useParams();
  return <ClusterBillPage cluster={cluster} />;
}
