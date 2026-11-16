import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { componentsApi } from '@kube-ai-hub/api-client';
import { Icon, Panel, Skeleton, type IconName } from '@kube-ai-hub/ui';
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
  return <Panel title={t('cluster.components.title')} icon="components" titleLevel={2}
    data-ai-id="overview:components" aria-busy={query.isFetching}>
    {query.isPending ? <Skeleton className="h-16" /> : query.isError ?
      <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="overview:components-retry" /> :
      /*
       * Two columns below `xl`, three above: the six entries are the same six facts in
       * both, and a third column only exists once the panel is wide enough that the
       * longest label (Kube AI Hub / Kubernetes) does not wrap.
       */
      <nav className="grid grid-cols-2 gap-2 xl:grid-cols-3" aria-label={t('cluster.components.title')}>
        {COMPONENT_GROUPS.map((group) => <Link key={group.key}
          to="/kube-frontend/clusters/$cluster/components" params={{ cluster }} search={{ type: group.key }}
          data-ai-id={`overview:component:${group.key}`}
          className="flex min-w-0 items-center gap-2 rounded-ai-md border border-ai-line bg-ai-surface-2 px-3 py-2 text-sm text-ai-fg transition-colors duration-ai-fast hover:border-ai-line-strong hover:bg-ai-surface-3">
          <Icon name={icons[group.key] ?? 'components'} className="text-ai-fg-secondary" />
          <span className="min-w-0 flex-1 truncate">
            {group.label.startsWith('cluster.') ? t(group.label as 'cluster.overview.module.monitoring') : group.label}
          </span>
          <span className="shrink-0 text-xs tabular-nums text-ai-fg-muted" data-ai-id={`overview:component-count:${group.key}`}>
            {query.data?.items.filter((item) => item.namespace === group.namespace).length ?? '-'}
          </span>
        </Link>)}
      </nav>}
  </Panel>;
}
