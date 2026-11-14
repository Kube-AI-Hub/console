import { createFileRoute } from '@tanstack/react-router';
import { KubectlPage } from '@/pages/cluster/KubectlPage';

export const Route = createFileRoute('/kube-frontend/clusters/$cluster/kubectl/')({
  component: Page,
});

function Page() {
  const { cluster } = Route.useParams();
  return <KubectlPage cluster={cluster} />;
}
