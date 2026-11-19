import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { customResourcesApi, type CustomResourceDetail, type CustomResourceInstance } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, ResourceList, Skeleton, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { formatTimestamp } from '@/lib/time';
import { useListRefresh } from '@/components/resource/useListRefresh';

/**
 * 自定义资源详情.
 *
 * A CRD's own attributes, plus the instances of it that exist on this cluster. The
 * instance list is what the old console puts behind its "资源状态" tab, and it is the
 * reason to open this page at all: "is anything actually using this CRD" is the
 * question the definition raises.
 *
 * The instance endpoint is built from the definition — a custom resource has no fixed
 * URL — so the page shows the exact path it read, which is also what a reader needs to
 * reproduce the query with kubectl.
 */
/** Page sizes the old console offered (`PAGESIZE_OPTION`): 10/20/50/100. */
const PAGE_SIZES = [10, 20, 50, 100] as const;

export interface CustomResourceDetailPageProps {
  cluster: string;
  name: string;
}

export function CustomResourceDetailPage({ cluster, name }: CustomResourceDetailPageProps): React.ReactElement {
  const t = useT();
  const list = useResourceListState<'name' | 'createTime'>({ defaultSortBy: 'name', defaultOrder: 'asc', resetOn: [cluster, name] });
  /* 每页档位 (old console's PAGESIZE_OPTION): the list is client-side, so the slice is here. */
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);

  const crd = useQuery({
    queryKey: ['custom-resource', cluster, name],
    queryFn: ({ signal }) => customResourcesApi(apiClient).get({ name, cluster, signal }),
  });

  const instances = useQuery({
    enabled: crd.data !== undefined,
    queryKey: ['custom-resource-instances', cluster, name, crd.data?.readVersion],
    queryFn: ({ signal }) =>
      customResourcesApi(apiClient).instances({ crd: crd.data as CustomResourceDetail, cluster, signal }),
  });

  const all = instances.data?.items ?? [];
  const keyword = list.search.trim().toLowerCase();
  const filtered = keyword
    ? all.filter((row) => row.name.toLowerCase().includes(keyword) || row.namespace.toLowerCase().includes(keyword))
    : all;
  const rows = React.useMemo(() => {
    const items = [...filtered];
    const direction = list.order === 'asc' ? 1 : -1;
    if (list.sortBy === 'createTime') return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt) * direction);
    return items.sort((a, b) => a.name.localeCompare(b.name) * direction);
  }, [filtered, list.sortBy, list.order]);

  if (crd.isError) {
    return <ResourceErrorPanel error={crd.error} onRetry={() => void crd.refetch()} retryAiId="custom-resource:retry" />;
  }

  const namespaced = crd.data?.scope === 'Namespaced';
  /** The exact collection path this page reads; shown so it can be reproduced. */
  const apiPath = crd.data ? `/apis/${crd.data.group}/${crd.data.readVersion}/${crd.data.plural}` : '';
  const listRefresh = useListRefresh('custom-resource', instances);

  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const schema = React.useMemo<ListSchema<CustomResourceInstance>>(
    () => ({
      title: t('cluster.customResources.instances'),
      refresh: listRefresh.refresh,
      description: t('cluster.customResources.instancesDescription'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.namespace ? `${row.namespace}/${row.name}` : row.name }),
      search: { placeholder: t('cluster.searchPlaceholder'), aiId: 'custom-resource:search' },
      sortableKeys: ['name', 'createTime'],
      // Third click of the header cycle returns to the page's default order;
      // a server list must send a sort key, so "off" cannot be absent.
      sortFallback: list.sortFallback,
      sortAiPrefix: 'custom-resource',
      sort: { key: list.sortBy, order: list.order },
      columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'custom-resource-instances:columns' },
      columns: [
        {
          key: 'name',
          title: t('cluster.column.name'),
          /* Pinned: the row's identity, kept in place while the other columns scroll. */
          width: 220,
          pin: 'start',
          render: (row: CustomResourceInstance) => (
            <span className="truncate font-medium text-ai-fg" {...actionProps(`custom-resource:instance:${row.name}`)}>
              {row.name}
            </span>
          ),
        },
        ...(namespaced
          ? [
              {
                key: 'namespace',
                hideable: true,
                title: t('cluster.customResources.namespace'),
                width: 180,
                hideBelow: 'md' as const,
                render: (row: CustomResourceInstance) => (
                  <span className="truncate text-ai-fg-secondary">{row.namespace || '-'}</span>
                ),
              },
            ]
          : []),
        {
          key: 'createTime',
          hideable: true,
          title: t('cluster.column.createdAt'),
          width: 170,
          hideBelow: 'lg',
          render: (row: CustomResourceInstance) => (
            <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>
          ),
        },
      ],
      empty: {
        title: t('cluster.customResources.instancesEmptyTitle'),
        description: t('cluster.customResources.instancesEmptyDescription'),
      },
      labels: {
        ...listRefresh.emptyLabels, ...listRefresh.filterLabels,
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      pagination: { page: currentPage, pageSize, pageSizeOptions: [...PAGE_SIZES], total },
    }),
    [apiPath, instances.isFetching, list.sortBy, list.order, namespaced, rows.length, t],
  );

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('custom-resource-instances', columnKeys);

  /*
   * The surface stays `loading` until the instance list settles too.
   *
   * Reporting `ready` while a second query is still in flight is how a page ends up
   * looking finished with an empty table: both a reader and an automated caller then
   * read "no instances" from a page that simply has not loaded them yet.
   */
  const state = crd.isPending || instances.isPending ? 'loading' : crd.isError ? 'error' : 'ready';

  return (
    <AiSurface as="section" aiId="custom-resource:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold text-ai-fg">{crd.data?.kind || name}</h1>
        {crd.data ? (
          <Badge tone={crd.data.served ? 'success' : 'neutral'}>
            {crd.data.served ? t('cluster.customResources.servedYes') : t('cluster.customResources.servedNo')}
          </Badge>
        ) : null}
        {/* Back to the list, so the page is usable without the browser's back button. */}
        <Link
          to="/kube-frontend/clusters/$cluster/custom-resources"
          params={{ cluster }}
          className="text-xs text-ai-link hover:underline"
          {...actionProps('custom-resource:back')}
        >
          {t('cluster.customResources.backToList')}
        </Link>
      </header>

      {crd.isPending ? <Skeleton className="h-32 w-full" /> : null}

      {crd.data ? (
        <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="custom-resource:attributes">
          <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('cluster.customResources.definition')}</h2>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <DefinitionRow label={t('cluster.customResources.kind')} value={crd.data.kind || '-'} />
            <DefinitionRow label={t('cluster.customResources.group')} value={crd.data.group || '-'} />
            <DefinitionRow label={t('cluster.customResources.versions')} value={crd.data.versions.join(', ') || '-'} />
            <DefinitionRow
              label={t('cluster.customResources.scope')}
              value={crd.data.scope === 'Namespaced' ? t('cluster.customResources.namespaced') : t('cluster.customResources.clusterScoped')}
            />
            <DefinitionRow label={t('cluster.column.name')} value={crd.data.name || '-'} />
            <DefinitionRow label={t('cluster.column.createdAt')} value={formatTimestamp(crd.data.createdAt)} />
          </dl>
        </section>
      ) : null}

      {state === 'ready' ? (
        instances.isError ? (
          <ResourceErrorPanel
            error={instances.error}
            onRetry={() => void instances.refetch()}
            retryAiId="custom-resource:instances-retry"
          />
        ) : (
          <ResourceList
        {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
        onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys}
            schema={schema}
            onRefresh={listRefresh.onRefresh}
            rows={pageRows}
            loading={false}
            refreshing={listRefresh.refreshing}
            searchValue={list.keyword}
            onSearchChange={list.setKeyword}
            onPageChange={setPage}
            onPageSizeChange={(size: number) => {
              setPageSize(size);
              setPage(1);
            }}
            onSortChange={(next: { key: string; order: SortOrder }) => {
              if (next) list.setSort(next);
            }}
          />
        )
      ) : null}
    </AiSurface>
  );
}