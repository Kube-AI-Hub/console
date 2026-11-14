import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { clusterGatewaysApi, type ClusterGateway } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, ResourceList, Tabs, type ListSchema } from '@kube-ai-hub/ui';
import { api } from '@/api';
import { useT } from '@/i18n';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { useClusterProjectIndex } from './useClusterProjectIndex';

export function ClusterGatewaysPage({ cluster, component = 'cluster' }: {
  cluster: string; component?: 'cluster' | 'project';
}): React.ReactElement {
  const t = useT();
  const navigate = useNavigate();
  const workspaceOf = useClusterProjectIndex(cluster);
  const [search, setSearch] = React.useState('');
  const query = useQuery({
    queryKey: ['cluster-gateways', cluster],
    queryFn: ({ signal }) => clusterGatewaysApi(api).list({ cluster, signal }),
    refetchInterval: (state) => state.state.data?.some((row) => !row.ready) ? 5000 : false,
  });
  const rows = (query.data ?? []).filter((row) => row.scope === component && row.name.includes(search.trim()));
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length ? 'ready' : 'empty';
  const schema: ListSchema<ClusterGateway> = {
    rowKey: (row) => `${row.namespace}/${row.name}`,
    rowAttributes: (row) => ({ 'data-ai-row': `${row.namespace}/${row.name}` }),
    search: { placeholder: t('cluster.searchPlaceholder'), aiId: 'cluster-gateways:search' },
    refresh: { label: t('cluster.list.refresh'), aiId: 'cluster-gateways:refresh', busy: query.isFetching },
    columns: [
      {
        key: 'name',
        title: t('settings.gateway.name'),
        // The cluster gateway has a detail page; project gateways stay on the
        // project's own gateway page, which is where they are managed.
        render: (row) =>
          row.scope === 'cluster' ? (
            <a
              className="font-medium text-ai-accent hover:underline"
              href={'/kube-frontend/clusters/' + encodeURIComponent(cluster) + '/gateways/' + encodeURIComponent(row.name)}
              data-ai-id={'cluster-gateways:name:' + row.name}
            >
              {row.name}
            </a>
          ) : (
            <span className="text-ai-fg">{row.name}</span>
          ),
      },
      { key: 'namespace', title: t('cluster.workloads.column.project'), render: (row) => row.scope === 'project' ?
        <a className="text-ai-accent hover:underline" href={`/kube-frontend/${encodeURIComponent(workspaceOf.get(row.namespace) ?? 'public')}/clusters/${encodeURIComponent(cluster)}/projects/${encodeURIComponent(row.namespace)}/gateways`}>{row.namespace}</a> : '-' },
      { key: 'ready', title: t('cluster.column.status'), render: (row) =>
        <Badge tone={row.ready ? 'success' : 'warning'}>{t(row.ready ? 'settings.gateway.ready' : 'settings.gateway.pending')}</Badge> },
      { key: 'type', title: t('settings.gateway.type'), render: (row) => row.type || '-' },
      { key: 'address', title: t('settings.gateway.address'), render: (row) => row.address || '-', hideBelow: 'lg' },
      { key: 'message', title: t('settings.gateway.message'), render: (row) => row.message || '-', wrap: true },
      { key: 'createdAt', title: t('cluster.column.createdAt'), render: (row) => formatTimestamp(row.createdAt), hideBelow: 'xl' },
    ],
    empty: { title: t('cluster.clusterGateways.empty'), description: t('cluster.clusterGateways.emptyHint') },
  };
  return <AiSurface as="section" aiId="cluster-gateways:surface" state={state} aria-busy={query.isFetching} className="flex min-w-0 flex-col gap-4" data-ai-id="cluster-gateways:body">
    <header><h1 className="text-lg font-semibold text-ai-fg">{t('cluster.clusterGateways.title')}</h1>
      <p className="mt-1 text-xs text-ai-fg-muted">{t('cluster.clusterGateways.description')}</p></header>
    <Tabs value={component} items={[
      { value: 'cluster', label: t('cluster.clusterGateways.cluster'), aiId: 'cluster-gateways:tab:cluster' },
      { value: 'project', label: t('cluster.clusterGateways.project'), aiId: 'cluster-gateways:tab:project' },
    ]} onValueChange={(value) => {
      setSearch('');
      void navigate({ to: '/kube-frontend/clusters/$cluster/gateways/$name', params: { cluster, name: value } });
    }} />
    {state === 'error' ? <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="cluster-gateways:retry" />
      : <ResourceList schema={schema} rows={rows} loading={query.isPending} searchValue={search}
        onSearchChange={setSearch} onRefresh={() => void query.refetch()} />}
  </AiSurface>;
}
