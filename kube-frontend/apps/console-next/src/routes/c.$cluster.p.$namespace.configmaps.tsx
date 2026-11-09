import { createFileRoute } from '@tanstack/react-router';
import { ConfigMapsPage } from '@/pages/configmaps/ConfigMapsPage';

/**
 * `/c/:cluster/p/:namespace/configmaps`
 *
 * `c` and `p` rather than `cluster` and `project` because these segments repeat
 * in every resource URL; the verbose form makes breadcrumb code noisy without
 * adding meaning.
 */
export const Route = createFileRoute('/c/$cluster/p/$namespace/configmaps')({
  component: ConfigMapsRoute,
});

function ConfigMapsRoute() {
  const { cluster, namespace } = Route.useParams();
  return <ConfigMapsPage cluster={cluster} namespace={namespace} />;
}
