import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { NODE_RANK_METRICS, nodeRankingApi, nodesApi, type NodeRankMetric, type NodeRankRow } from '@kube-ai-hub/api-client';
import { Badge, Button, Icon, Progress, ResourceList, Select, Table, type ListSchema } from '@kube-ai-hub/ui';
import { api } from '@/api';
import { useT } from '@/i18n';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { useResourceListState } from '@/components/resource/useResourceListState';

export function rankValue(row: NodeRankRow, metric: NodeRankMetric): string {
  const value = row.values[metric];
  if (value === undefined) return '-';
  if (metric === 'node_load1') return String(Math.round(value * 100) / 100);
  if (metric === 'node_gpu_allocated') {
    const total = row.values.node_gpu_total;
    return total === undefined || total <= 0 ? '-' : `${Math.round(value / total * 100)}%`;
  }
  return `${Math.round(value * 100)}%`;
}

export function NodeRankingPanel({ cluster, preview = false, initialMetric = 'node_cpu_utilisation', onStateChange, renderError }: {
  cluster: string; preview?: boolean; initialMetric?: NodeRankMetric;
  onStateChange?: (state: 'loading' | 'ready' | 'empty' | 'error') => void;
  renderError?: (error: unknown, retry: () => void) => React.ReactElement;
}): React.ReactElement {
  const t = useT();
  const [metric, setMetric] = React.useState<NodeRankMetric>(preview ? NODE_RANK_METRICS[0] : initialMetric);
  const list = useResourceListState<NodeRankMetric>({ defaultSortBy: initialMetric, defaultOrder: 'desc', resetOn: [cluster] });
  React.useEffect(() => { setMetric(preview ? NODE_RANK_METRICS[0] : initialMetric); list.setPage(1); }, [cluster, initialMetric, preview]);
  const changeMetric = (value: string) => { setMetric(value as NodeRankMetric); list.setSort({ key: value, order: 'desc' }); };
  const query = useQuery({
    queryKey: ['node-ranking', cluster, preview, metric, preview ? 'desc' : list.order,
      preview ? 1 : list.page, preview ? 5 : list.pageSize, preview ? '' : list.search],
    queryFn: ({ signal }) => nodeRankingApi(api).list({
      cluster, metric, order: preview ? 'desc' : list.order, page: preview ? 1 : list.page,
      pageSize: preview ? 5 : list.pageSize, keyword: preview ? '' : list.search, signal,
    }), retry: false, staleTime: 15_000,
  });
  const metadata = useQuery({ queryKey: ['node-ranking-info', cluster], retry: false, staleTime: 30_000,
    queryFn: ({ signal }) => nodesApi(api).list({ cluster, namespace: '', page: 1, pageSize: -1, sortBy: 'name', order: 'asc', signal }) });
  const rows = query.data?.items ?? [];
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length ? 'ready' : 'empty';
  React.useEffect(() => { onStateChange?.(state); }, [state, onStateChange]);
  const nodeCell = (row: NodeRankRow) => {
    const info = metadata.data?.items.find((node) => node.name === row.name);
    return <div className="min-w-0">
      <Link to="/kube-frontend/clusters/$cluster/nodes/$name" params={{ cluster, name: row.name }}
        className="text-ai-fg underline underline-offset-2">{row.name}</Link>
      {info?.role.split(',').some((role) => ['master', 'control-plane'].includes(role.trim())) ?
        <Badge className="ml-2">{t('node.list.controlPlane')}</Badge> : null}
      <p className="mt-1 text-xs text-ai-fg-secondary">{info?.internalIP || '-'}</p>
    </div>;
  };
  const controls = <div className="flex flex-wrap items-center gap-2">
    <Select value={metric} aria-label={t('cluster.overview.rankMetric')} data-ai-id={preview ? 'overview:rank-metric' : 'node-usage:metric'}
      options={NODE_RANK_METRICS.map((value) => ({ value, label: t(`cluster.rank.${value}`) }))} onValueChange={changeMetric} className="w-52" />
    <Button variant="ghost" size="sm" disabled={query.isFetching} data-ai-id={preview ? 'overview:rank-refresh' : 'node-usage:refresh'}
      onClick={() => void query.refetch()}>{t('common.refresh')}</Button>
  </div>;
  const values = NODE_RANK_METRICS.map((value) => ({
    key: value, title: t(`cluster.rank.${value}`), width: 145,
    render: (row: NodeRankRow) => {
      const text = rankValue(row, value);
      return <span className="flex items-center gap-2 whitespace-nowrap tabular-nums" data-ai-id={`node-usage:${value}:${row.name}`}>
        {text.endsWith('%') ? <Progress value={Number.parseFloat(text)} className="w-12" aria-label={t(`cluster.rank.${value}`)} /> : null}{text}
      </span>;
    },
  }));
  const schema: ListSchema<NodeRankRow> = {
    title: t('cluster.nodeUsage.title'), rowKey: 'name', rowAttributes: (row) => ({ 'data-ai-row': row.name }),
    search: { placeholder: t('cluster.searchPlaceholder'), aiId: 'node-usage:search' },
    sort: { key: metric, order: list.order }, sortableKeys: [...NODE_RANK_METRICS], sortAiPrefix: 'node-usage',
    columns: [{ key: 'name', title: t('cluster.column.name'), render: nodeCell }, ...values,
      { key: 'pods', title: t('cluster.nodeUsage.pods'), render: (row) => <span data-ai-id={`node-usage:pods:${row.name}`}>{row.values.node_pod_running_count ?? '-'}</span> }],
    pagination: { page: list.page, pageSize: list.pageSize, total: query.data?.total ?? 0,
      pageSizeOptions: [10, 20, 50, 100] },
    empty: { title: t('cluster.nodeUsage.emptyTitle') },
    labels: { selectAll: t('table.selectAll'), selectRow: (index) => t('table.selectRow', { index }),
      moreActions: t('table.moreActions'), previous: t('table.previous'), next: t('table.next'), selected: (count) => t('table.selectedCount', { count }) },
  };
  return <section data-ai-id={preview ? 'overview:ranking' : 'node-usage:surface'}
    data-ai-state={state}
    aria-busy={query.isFetching} className={preview ? 'min-w-0 rounded-ai-lg border border-ai-line bg-ai-surface-1 p-4' : 'min-w-0'}>
    {preview ? <>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-medium"><Icon name="barchart" size={18} />{t('cluster.overview.top5')}</h2>{controls}</header>
      {query.isError ? <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="overview:rank-retry" /> :
        <Table rows={rows} rowKey={(row) => row.name} loading={query.isPending} empty={t('cluster.nodeUsage.emptyTitle')}
          rowAttributes={(row) => ({ 'data-ai-row': row.name })} columns={[
            { key: 'name', title: t('cluster.column.name'), render: nodeCell },
            { key: 'metric', title: t(`cluster.rank.${metric}`), render: (row) => {
              const value = rankValue(row, metric);
              return <span className="flex items-center gap-3" data-ai-id={`overview:rank-value:${row.name}`}>
                {value.endsWith('%') ? <Progress value={Number.parseFloat(value)} className="w-20" aria-label={t(`cluster.rank.${metric}`)} /> : null}
                <span className="whitespace-nowrap tabular-nums">{value}</span>
              </span>;
            } },
          ]} />}
      <Link to="/kube-frontend/clusters/$cluster/node-usage" params={{ cluster }} search={{ metric }}
        className="mt-3 inline-block text-sm text-ai-fg underline underline-offset-2" data-ai-id="overview:rank-more">{t('cluster.overview.viewMore')}</Link>
    </> : <><div className="mb-3">{controls}</div><ResourceList schema={schema} rows={rows} loading={query.isPending}
      errorContent={query.isError ? renderError ? renderError(query.error, () => void query.refetch()) :
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="node-usage:retry" /> : undefined}
      searchValue={list.keyword} onSearchChange={list.setKeyword}
      onSortChange={(sort) => { if (sort) { setMetric(sort.key as NodeRankMetric); list.setSort(sort); } }}
      onPageChange={list.setPage} onPageSizeChange={list.setPageSize} /></>}
  </section>;
}
