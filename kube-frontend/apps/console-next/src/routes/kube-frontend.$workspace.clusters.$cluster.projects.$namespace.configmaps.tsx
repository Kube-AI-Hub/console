import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router';
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
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  /*
   * This route is the parent of `$name`, so TanStack renders it for both the list
   * and the detail. Rendering the list unconditionally would hide the child; a
   * file-route `index` would be cleaner but the parent segment carries a param,
   * so the split has to happen here.
   */
  const isDetail = /\.configmaps\/[^/]+$/.test(pathname) || /\/configmaps\/.+$/.test(pathname);
  if (isDetail) return <Outlet />;
  return <ConfigMapsPage workspace={workspace} cluster={cluster} namespace={namespace} />;
}
