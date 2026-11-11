import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router';
import { SecretsPage } from '@/pages/secrets/SecretsPage';

/**
 * `/kube-frontend/:workspace/clusters/:cluster/projects/:namespace/secrets`
 *
 * Mirrors the old console's project path with the `kube-frontend` prefix, so a
 * deep link can be rewritten by hand and both apps show the same segments in the
 * same order.
 *
 * `workspace` is accepted but not used for fetching: the BFF addresses resources
 * by cluster and namespace, and the workspace only scopes authorisation upstream.
 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/secrets')({
  component: SecretsRoute,
});

function SecretsRoute() {
  const { workspace, cluster, namespace } = Route.useParams();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  /*
   * This route is the parent of `$name`, so TanStack renders it for both the list
   * and the detail. Rendering the list unconditionally would hide the child.
   */
  const isDetail = /\/secrets\/[^/]+$/.test(pathname);
  if (isDetail) return <Outlet />;
  return <SecretsPage workspace={workspace} cluster={cluster} namespace={namespace} />;
}
