import { createFileRoute, redirect } from '@tanstack/react-router';
import { ClusterConfigMapsPage } from '@/pages/configmaps/ClusterConfigMapsPage';

/**
 * `/kube-frontend/clusters/$cluster/configmaps`
 *
 * The cluster console's ConfigMap list: every project at once, reached from
 * 平台管理 → 集群管理 → 配置 → 配置字典. The project console has its own page under
 * `/projects/$namespace/configmaps`; they are separate pages in the old console
 * too, with different columns.
 *
 * `namespace` narrows the list to one project and is optional. It is a search
 * parameter rather than a path segment because the page is the same page either
 * way — narrowing is a filter, not a different resource scope.
 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/configmaps')({
  validateSearch: (search: Record<string, unknown>): { namespace?: string } =>
    typeof search['namespace'] === 'string' && search['namespace'] ? { namespace: search['namespace'] } : {},
  /*
   * No workspace segment: a cluster console page is not scoped to a workspace.
   * `/kube-frontend/clusters` already belongs to 平台管理 through `isAdminPath`, so
   * the 工作台 entry does not light up for it.
   */
  beforeLoad: ({ params }) => {
    if (!params.cluster) throw redirect({ to: '/' });
  },
  component: ClusterConfigMapsRoute,
});

function ClusterConfigMapsRoute() {
  const { cluster } = Route.useParams();
  const { namespace } = Route.useSearch();
  return <ClusterConfigMapsPage key={`${cluster}/${namespace ?? ''}`} cluster={cluster} {...(namespace ? { namespace } : {})} />;
}
