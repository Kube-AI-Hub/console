import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { NODE_RANK_METRICS, nodeRankingApi, nodesApi, type NodeRankMetric, type NodeRankRow } from '@kube-ai-hub/api-client';
import { Badge, Button, Notify, Panel, Progress, ResourceList, Select, Table, type ListSchema } from '@kube-ai-hub/ui';
import { api } from '@/api';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useT } from '@/i18n';
import { errorMessage, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { AUTO_REFRESH_INTERVAL_MS } from './monitorWindow';

/** File name of the ranking export; the AC names it exactly. */
export const NODE_USAGE_EXPORT_FILENAME = 'node.usage.rank.json';

/**
 * Rows per request when the export pages through the ranking API.
 *
 * `limit=-1` is not an option here: the monitoring handler answers HTTP 400
 * `Invalid parameter 'limit'` for it (measured 2026-11-18), so the export pages with a
 * valid limit instead of exporting only the visible page.
 */
export const NODE_USAGE_EXPORT_PAGE_SIZE = 100;

/** A page cap so a backend that keeps claiming more rows cannot make export spin. */
const NODE_USAGE_EXPORT_MAX_PAGES = 100;

/** The document written by the ranking export. */
export interface NodeUsageExport {
  cluster: string;
  metric: NodeRankMetric;
  order: 'asc' | 'desc';
  generatedAt: string;
  items: Array<{ name: string; values: NodeRankRow['values'] }>;
}

/**
 * Project the ranked rows onto the exported document.
 *
 * Pure and exported so the shape the AC promises (`{cluster, metric, order, generatedAt,
 * items:[{name, values}]}`) is asserted without a browser. Values are copied so a later
 * table render cannot mutate a document that has already been serialised.
 */
export function buildNodeUsageExport(params: {
  cluster: string;
  metric: NodeRankMetric;
  order: 'asc' | 'desc';
  generatedAt: string;
  items: readonly NodeRankRow[];
}): NodeUsageExport {
  return {
    cluster: params.cluster,
    metric: params.metric,
    order: params.order,
    generatedAt: params.generatedAt,
    items: params.items.map((row) => ({ name: row.name, values: { ...row.values } })),
  };
}

/**
 * Read every row of the current metric/order, page by page.
 *
 * The first answer carries `total`; the loop stops when it has that many distinct rows.
 * An empty or repeating page ends the loop: a truncated export is a bug the reader can
 * see, while an endless one is a hang they cannot. `fetchPage` is injected so the
 * pagination rule is testable without a network.
 */
export async function collectRankRows(
  fetchPage: (page: number) => Promise<{ items: NodeRankRow[]; total: number }>,
): Promise<NodeRankRow[]> {
  const first = await fetchPage(1);
  const rows = new Map<string, NodeRankRow>();
  for (const row of first.items) rows.set(row.name, row);
  const total = Number.isFinite(first.total) ? first.total : rows.size;
  let page = 2;
  while (rows.size < total && page <= NODE_USAGE_EXPORT_MAX_PAGES) {
    const next = await fetchPage(page);
    if (next.items.length === 0) break;
    const before = rows.size;
    for (const row of next.items) rows.set(row.name, row);
    // A backend that repeats page one must not keep the loop alive.
    if (rows.size === before) break;
    page += 1;
  }
  return [...rows.values()];
}

/** Trigger a client-side JSON download. */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

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

/**
 * The node-usage ranking, shared by the full page and (as `preview`) the overview.
 *
 * `aiIdPrefix` namespaces every handle the list renders. The default keeps the
 * node-usage page's ids exactly as they were; the cluster monitor's ranking tab passes
 * `cluster-monitor:ranking:` so the same component can be mounted twice without two
 * elements answering the same automation id.
 *
 * The export button sits beside the metric selector because both describe the whole
 * ranking (which metric, which order), not the visible page. It reads every row — the
 * point of an export is to leave the table behind — and is disabled when the list is
 * empty rather than downloading an empty file.
 */
export function NodeRankingPanel({ cluster, preview = false, initialMetric = 'node_cpu_utilisation', aiIdPrefix = 'node-usage:', live = false, onStateChange, renderError }: {
  cluster: string; preview?: boolean; initialMetric?: NodeRankMetric; aiIdPrefix?: string;
  /** Poll at the monitor page's auto-refresh cadence; the ranking is a current-value read. */
  live?: boolean;
  onStateChange?: (state: 'loading' | 'ready' | 'empty' | 'error') => void;
  renderError?: (error: unknown, retry: () => void) => React.ReactElement;
}): React.ReactElement {
  const t = useT();
  const [metric, setMetric] = React.useState<NodeRankMetric>(preview ? NODE_RANK_METRICS[0] : initialMetric);
  const list = useResourceListState<NodeRankMetric>({ defaultSortBy: initialMetric, defaultOrder: 'desc', resetOn: [cluster] });
  const [exporting, setExporting] = React.useState(false);
  React.useEffect(() => { setMetric(preview ? NODE_RANK_METRICS[0] : initialMetric); list.setPage(1); }, [cluster, initialMetric, preview]);
  const changeMetric = (value: string) => { setMetric(value as NodeRankMetric); list.setSort({ key: value, order: 'desc' }); };
  const query = useQuery({
    queryKey: ['node-ranking', cluster, preview, metric, preview ? 'desc' : list.order,
      preview ? 1 : list.page, preview ? 5 : list.pageSize, preview ? '' : list.search],
    queryFn: ({ signal }) => nodeRankingApi(api).list({
      cluster, metric, order: preview ? 'desc' : list.order, page: preview ? 1 : list.page,
      pageSize: preview ? 5 : list.pageSize, keyword: preview ? '' : list.search, signal,
    }), retry: false, staleTime: 15_000,
    refetchOnWindowFocus: !preview,
    refetchOnReconnect: !preview,
    // The page's one 自动刷新 switch drives the ranking too; preview never polls, it is a
    // summary on a page that already refreshes what it shows.
    refetchInterval: !preview && live ? AUTO_REFRESH_INTERVAL_MS : false,
  });
  const metadata = useQuery({ queryKey: ['node-ranking-info', cluster], retry: false, staleTime: 30_000,
    queryFn: ({ signal }) => nodesApi(api).list({ cluster, namespace: '', page: 1, pageSize: -1, sortBy: 'name', order: 'asc', signal }) });
  const rows = query.data?.items ?? [];
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length ? 'ready' : 'empty';
  React.useEffect(() => { onStateChange?.(state); }, [state, onStateChange]);

  /*
   * The sort/pagination handles of ResourceList are built from this prefix as
   * `<prefix>:sort:<key>` etc., so the trailing colon is stripped here -- a prefixed
   * mount would otherwise render `...:ranking::sort:...`.
   */
  const sortAiPrefix = aiIdPrefix.replace(/:+$/, '');
  const canExport = !preview && rows.length > 0 && !query.isPending && !exporting;
  const exportTitle = rows.length === 0 ? t('cluster.nodeUsage.exportEmpty') : t('cluster.nodeUsage.exportHint');
  const handleExport = async (): Promise<void> => {
    if (!canExport) return;
    setExporting(true);
    try {
      const items = await collectRankRows((page) => nodeRankingApi(api).list({
        cluster, metric, order: list.order, page, pageSize: NODE_USAGE_EXPORT_PAGE_SIZE,
      }));
      downloadJson(NODE_USAGE_EXPORT_FILENAME, buildNodeUsageExport({
        cluster, metric, order: list.order, generatedAt: new Date().toISOString(), items,
      }));
    } catch (error) {
      Notify.error({ content: errorMessage(t, error) });
    } finally {
      setExporting(false);
    }
  };

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
    <Select value={metric} aria-label={t('cluster.overview.rankMetric')} data-ai-id={preview ? 'overview:rank-metric' : aiIdPrefix + 'metric'}
      options={NODE_RANK_METRICS.map((value) => ({ value, label: t(`cluster.rank.${value}`) }))} onValueChange={changeMetric} className="w-52" />
    <Button variant="ghost" size="sm" disabled={query.isFetching} data-ai-id={preview ? 'overview:rank-refresh' : aiIdPrefix + 'refresh'}
      onClick={() => void query.refetch()}>{t('common.refresh')}</Button>
    {preview ? null : (
      <Button variant="ghost" size="sm" disabled={!canExport} aria-busy={exporting}
        data-ai-id={aiIdPrefix + 'export'} title={exportTitle}
        onClick={() => void handleExport()}>{t('cluster.nodeUsage.export')}</Button>
    )}
  </div>;
  const values = NODE_RANK_METRICS.map((value) => ({
    key: value, title: t(`cluster.rank.${value}`), width: 145,
    render: (row: NodeRankRow) => {
      const text = rankValue(row, value);
      return <span className="flex items-center gap-2 whitespace-nowrap tabular-nums"
        data-ai-id={preview ? `overview:rank-value:${row.name}` : `${aiIdPrefix}${value}:${row.name}`}>
        {text.endsWith('%') ? <Progress value={Number.parseFloat(text)} className="w-12" aria-label={t(`cluster.rank.${value}`)} /> : null}{text}
      </span>;
    },
  }));
  const schema: ListSchema<NodeRankRow> = {
    title: t('cluster.nodeUsage.title'), rowKey: 'name', rowAttributes: (row) => ({ 'data-ai-row': row.name }),
    search: { placeholder: t('cluster.searchPlaceholder'), aiId: aiIdPrefix + 'search' },
    sort: { key: metric, order: list.order }, sortableKeys: [...NODE_RANK_METRICS], sortAiPrefix,
    columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: aiIdPrefix + 'columns' },
    columns: [{ key: 'name', title: t('cluster.column.name'), render: nodeCell }, ...values,
      { key: 'pods', hideable: true, title: t('cluster.nodeUsage.pods'), render: (row) => <span data-ai-id={preview ? `overview:rank-pods:${row.name}` : `${aiIdPrefix}pods:${row.name}`}>{row.values.node_pod_running_count ?? '-'}</span> }],
    pagination: { page: list.page, pageSize: list.pageSize, total: query.data?.total ?? 0,
      pageSizeOptions: [10, 20, 50, 100] },
    empty: { title: t('cluster.nodeUsage.emptyTitle') },
    labels: { selectAll: t('table.selectAll'), selectRow: (index) => t('table.selectRow', { index }),
      moreActions: t('table.moreActions'), previous: t('table.previous'), next: t('table.next'), selected: (count) => t('table.selectedCount', { count }) },
  };

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('node-usage', columnKeys);
  if (preview) {
    return <Panel title={t('cluster.overview.top5')} icon="barchart" titleLevel={2}
      data-ai-id="overview:ranking" data-ai-state={state} aria-busy={query.isFetching}
      className="flex h-full min-w-0 flex-col"
      /*
       * The header height matches the node block beside it. Both carry a control (this one
       * a metric select, that one a link), and without a shared floor the shorter header
       * starts its body on a different baseline — the row then reads as two panels that
       * happen to be adjacent rather than one row of a dashboard.
       */
      headerClassName="min-h-[3.75rem] items-center"
      bodyClassName="flex min-h-0 flex-1 flex-col"
      actions={controls}>
      {query.isError ? <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="overview:rank-retry" /> :
        <Table rows={rows} rowKey={(row) => row.name} loading={query.isPending}
          refreshing={query.isFetching && !query.isPending} empty={t('cluster.nodeUsage.emptyTitle')}
          rowAttributes={(row) => ({ 'data-ai-row': row.name })} columns={[
            { key: 'rank', title: '#', width: 48, render: (row) => <span className="text-xs font-medium tabular-nums text-ai-fg-muted">{rows.indexOf(row) + 1}</span> },
            { key: 'name', title: t('cluster.column.name'), width: 280, render: nodeCell },
            { key: 'metric', title: t(`cluster.rank.${metric}`), render: (row) => {
              const value = rankValue(row, metric);
              return <span className="flex w-full items-center gap-3" data-ai-id={`overview:rank-value:${row.name}`}>
                {value.endsWith('%') ? <Progress value={Number.parseFloat(value)} tone="auto" className="min-w-20 flex-1" aria-label={t(`cluster.rank.${metric}`)} /> : null}
                <span className="whitespace-nowrap tabular-nums">{value}</span>
              </span>;
            } },
          ]} />}
      <Link to="/kube-frontend/clusters/$cluster/node-usage" params={{ cluster }} search={{ metric }}
        className="mt-auto inline-block pt-3 text-xs text-ai-link underline-offset-4 hover:underline" data-ai-id="overview:rank-more">{t('cluster.overview.viewMore')}</Link>
    </Panel>;
  }
  return <section data-ai-id={aiIdPrefix + 'surface'}
    data-ai-state={state}
    aria-busy={query.isFetching} className="min-w-0">
    <div className="mb-3">{controls}</div><ResourceList
      {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
      onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys}
      schema={schema} rows={rows} loading={query.isPending}
      refreshing={query.isFetching && !query.isPending}
      errorContent={query.isError ? renderError ? renderError(query.error, () => void query.refetch()) :
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId={aiIdPrefix + 'retry'} /> : undefined}
      searchValue={list.keyword} onSearchChange={list.setKeyword}
      onSortChange={(sort) => { if (sort) { setMetric(sort.key as NodeRankMetric); list.setSort(sort); } }}
      onPageChange={list.setPage} onPageSizeChange={list.setPageSize} />
  </section>;
}
