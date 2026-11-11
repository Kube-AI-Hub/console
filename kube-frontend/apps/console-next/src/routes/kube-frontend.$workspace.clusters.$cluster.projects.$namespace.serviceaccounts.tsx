import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router';
import { ServiceAccountsPage } from '@/pages/serviceaccounts/ServiceAccountsPage';

/**
 * `/kube-frontend/:workspace/clusters/:cluster/projects/:namespace/serviceaccounts`
 *
 * Same segment order as the old console, with the `kube-frontend` prefix.
 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/serviceaccounts')({
  component: ServiceAccountsRoute,
});

function ServiceAccountsRoute() {
  const { workspace, cluster, namespace } = Route.useParams();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // Parent of `$name`: render the child for a detail URL, the list otherwise.
  const isDetail = /\/serviceaccounts\/[^/]+$/.test(pathname);
  if (isDetail) return <Outlet />;
  return <ServiceAccountsPage workspace={workspace} cluster={cluster} namespace={namespace} />;
}
