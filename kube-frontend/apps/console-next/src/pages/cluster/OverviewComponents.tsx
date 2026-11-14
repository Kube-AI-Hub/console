import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { componentsApi } from '@kube-ai-hub/api-client';
import { Icon, Skeleton, type IconName } from '@kube-ai-hub/ui';
import { api } from '@/api';
import { useT } from '@/i18n';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { COMPONENT_GROUPS } from './componentGroups';

export function OverviewComponents({ cluster }: { cluster: string }) {
  const t = useT();
  const icons: Record<string, IconName> = { kubeaihub: 'kubeaihub', kubernetes: 'kubernetes', istio: 'istio',
    monitoring: 'monitor', logging: 'log', devops: 'jenkins' };
  const query = useQuery({ queryKey: ['components', cluster], retry: false,
    queryFn: ({ signal }) => componentsApi(api).list({ cluster, signal }) });
  return <section className="rounded-ai-lg border border-ai-line bg-ai-surface-1 p-4" data-ai-id="overview:components" aria-busy={query.isFetching}>
    <h2 className="mb-3 flex items-center gap-2 text-sm font-medium"><Icon name="components" size={18} />{t('cluster.components.title')}</h2>
    {query.isPending ? <Skeleton className="h-16" /> : query.isError ?
      <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="overview:components-retry" /> :
      <nav className="grid grid-cols-2 gap-2 xl:grid-cols-3" aria-label={t('cluster.components.title')}>
        {COMPONENT_GROUPS.map((group) => <Link key={group.key}
          to="/kube-frontend/clusters/$cluster/components" params={{ cluster }} search={{ type: group.key }}
          data-ai-id={`overview:component:${group.key}`}
          className="rounded-ai-md border border-ai-line bg-ai-surface-2 px-3 py-2 text-sm text-ai-fg hover:bg-ai-surface-3">
          <Icon name={icons[group.key] ?? 'components'} className="mr-2" />
          {group.label.startsWith('cluster.') ? t(group.label as 'cluster.overview.module.monitoring') : group.label}
          <span className="ml-2 tabular-nums text-ai-fg-secondary" data-ai-id={`overview:component-count:${group.key}`}>
            {query.data?.items.filter((item) => item.namespace === group.namespace).length ?? '-'}
          </span>
        </Link>)}
      </nav>}
  </section>;
}
