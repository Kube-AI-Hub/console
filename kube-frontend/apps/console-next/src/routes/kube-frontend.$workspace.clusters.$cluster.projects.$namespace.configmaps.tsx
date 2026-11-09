import { createFileRoute } from '@tanstack/react-router';
import { ConfigMapsPage } from '@/pages/configmaps/ConfigMapsPage';

/**
 * `/kube-frontend/:workspace/clusters/:cluster/projects/:namespace/configmaps`
 *
 * Mirrors the old console's project path (`/:workspace/clusters/:cluster/projects/:namespace/...`)
 * with a `kube-frontend` prefix, so a person switching between the two sees the
 * same segments in the same order and a deep link can be rewritten by hand.
 *
 * `workspace` is accepted but not yet used: the BFF addresses resources by
 * cluster and namespace, and the workspace only scopes authorisation upstream.
 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/configmaps')({
  component: ConfigMapsRoute,
});

function ConfigMapsRoute() {
  const { workspace, cluster, namespace } = Route.useParams();
  return <ConfigMapsPage workspace={workspace} cluster={cluster} namespace={namespace} />;
}
