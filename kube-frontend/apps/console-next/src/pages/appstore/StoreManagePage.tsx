import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { storeAppsApi, storeCategoriesApi, storeReviewsApi } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Button, ResourceList, Skeleton, type ListSchema } from '@kube-ai-hub/ui';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';

/**
 * 商店管理：分类与审核.
 *
 * Both are read-only for now, and the page says which half is missing rather than hiding the
 * buttons: creating a category and approving a review are writes to openpitrix, and this round
 * could not verify them — the store has no apps and no reviews, so an approval flow would have
 * nothing to act on. The gap is registered instead of guessed at.
 *
 * Read-only still earns its place: before this page existed, the top bar's 应用商店管理 link
 * led to a blank screen.
 */
export interface StoreManagePageProps {
  view: 'store' | 'categories' | 'reviews';
}

/** Page sizes the old console offered (`PAGESIZE_OPTION`): 10/20/50/100. */
const PAGE_SIZES = [10, 20, 50, 100] as const;
const PAGE_SIZE = 10;

export function StoreManagePage({ view }: StoreManagePageProps): React.ReactElement {
  const t = useT();

  return (
    <AiSurface as="section" aiId={`store-manage:${view}:surface`} state={view === 'store' ? 'ready' : 'ready'} className="flex min-w-0 flex-col gap-4">
      {/* 刷新是缺口分析点名的缺失能力：数据不会自己更新，读者需要手动出口。 */}
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" {...actionProps(`store-manage:${view}:refresh`)} onClick={() => window.location.reload()}>
          {t('store.manage.refresh')}
        </Button>
      </div>
      {view === 'store' ? <StoreAppsTable /> : view === 'categories' ? <CategoriesTable /> : <ReviewsTable />}
    </AiSurface>
  );
}

function CategoriesTable(): React.ReactElement {
  const t = useT();
  const categories = useQuery({
    queryKey: ['store-categories-manage'],
    queryFn: ({ signal }) => storeCategoriesApi(apiClient).list({ page: 1, pageSize: -1, signal }),
  });

  const rows = categories.data?.items ?? [];
  const state = categories.isPending ? 'loading' : categories.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  const schema: ListSchema<(typeof rows)[number]> = {
    title: t('store.manage.categories'),
    sortAiPrefix: 'store-manage:categories',
    description: t('store.manage.categoriesDescription'),
    rowKey: 'id',
    rowAttributes: (row) => ({ 'data-ai-row': row.id }),
    columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'store-manage:categories:columns' },
    columns: [
      { key: 'name', title: t('cluster.column.name'), render: (row) => <span className="truncate font-medium text-ai-fg">{row.name}</span> },
      { key: 'description', hideable: true, title: t('store.manage.description'), width: 260, hideBelow: 'md', render: (row) => <span className="truncate text-ai-fg-secondary">{row.description || '-'}</span> },
      { key: 'appTotal', hideable: true, title: t('store.manage.appCount'), width: 120, render: (row) => <span className="tabular-nums text-ai-fg-secondary">{row.appTotal}</span> },
      { key: 'createdAt', hideable: true, title: t('cluster.column.createdAt'), width: 170, hideBelow: 'lg', render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span> },
    ],
    empty: { title: t('store.manage.categoriesEmpty'), description: t('store.manage.emptyDescription') },
    labels: {
      selectAll: t('table.selectAll'),
      selectRow: (index) => t('table.selectRow', { index }),
      moreActions: t('table.moreActions'),
      previous: t('table.previous'),
      next: t('table.next'),
      selected: (count) => t('table.selectedCount', { count }),
    },
  };

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('store-manage:categories', columnKeys);

  if (state === 'error') {
    return <ResourceErrorPanel error={categories.error} onRetry={() => void categories.refetch()} retryAiId="store-manage:categories:retry" />;
  }
  if (state === 'loading') return <Skeleton className="h-40 w-full" />;
  return <ResourceList {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})} onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys} schema={schema} rows={rows} loading={false} />;
}

/**
 * 商店里的应用.
 *
 * The old store-management landing page. Apps arrive from a chart repository; with none
 * configured this renders the empty state, which is the honest answer to "what is published".
 * Installing one (`/apps/:id/deploy`) is a separate flow and is not built yet.
 */
function StoreAppsTable(): React.ReactElement {
  const t = useT();
  const list = useResourceListState<'name' | 'createTime'>({ defaultSortBy: 'createTime', defaultOrder: 'desc', defaultPageSize: PAGE_SIZE });
  const apps = useQuery({
    queryKey: ['store-manage-apps', list.page, list.pageSize],
    queryFn: ({ signal }) => storeAppsApi(apiClient).list({ page: list.page, pageSize: list.pageSize, signal }),
  });

  const rows = apps.data?.items ?? [];
  const total = apps.data?.total ?? 0;
  const state = apps.isPending ? 'loading' : apps.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  const schema: ListSchema<(typeof rows)[number]> = {
    title: t('store.manage.apps'),
    sortAiPrefix: 'store-manage:apps',
    description: t('store.manage.appsDescription'),
    rowKey: 'id',
    rowAttributes: (row) => ({ 'data-ai-row': row.name }),
    columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'store-manage:apps:columns' },
    columns: [
      { key: 'name', title: t('cluster.column.name'), render: (row) => <span className="truncate font-medium text-ai-fg">{row.name}</span> },
      {
        key: 'description',
        hideable: true,
        title: t('store.manage.description'),
        width: 280,
        hideBelow: 'md',
        render: (row) => <span className="truncate text-ai-fg-secondary">{row.description || '-'}</span>,
      },
      {
        key: 'workspace',
        hideable: true,
        title: t('cluster.column.workspace'),
        width: 150,
        hideBelow: 'lg',
        render: (row) => <span className="truncate text-ai-fg-secondary">{row.workspace || '-'}</span>,
      },
      {
        key: 'status',
        hideable: true,
        title: t('cluster.column.status'),
        width: 120,
        render: (row) => <Badge tone={row.status === 'active' ? 'success' : 'warning'}>{row.status || '-'}</Badge>,
      },
      {
        key: 'createdAt',
        hideable: true,
        title: t('cluster.column.createdAt'),
        width: 170,
        hideBelow: 'xl',
        render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
      },
    ],
    empty: { title: t('store.manage.appsEmpty'), description: t('store.manage.appsEmptyDescription') },
    labels: {
      selectAll: t('table.selectAll'),
      selectRow: (index) => t('table.selectRow', { index }),
      moreActions: t('table.moreActions'),
      previous: t('table.previous'),
      next: t('table.next'),
      selected: (count) => t('table.selectedCount', { count }),
    },
    pagination: { page: list.page, pageSize: list.pageSize, pageSizeOptions: [...PAGE_SIZES], total },
  };

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('store-manage:apps', columnKeys);

  if (state === 'error') {
    return <ResourceErrorPanel error={apps.error} onRetry={() => void apps.refetch()} retryAiId="store-manage:apps:retry" />;
  }
  if (state === 'loading') return <Skeleton className="h-40 w-full" />;
  return <ResourceList {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})} onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys} schema={schema} rows={rows} loading={false} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} />;
}

function ReviewsTable(): React.ReactElement {
  const t = useT();
  const list = useResourceListState<'appName' | 'createTime'>({ defaultSortBy: 'createTime', defaultPageSize: PAGE_SIZE });
  const reviews = useQuery({
    queryKey: ['store-reviews', list.page, list.pageSize],
    queryFn: ({ signal }) => storeReviewsApi(apiClient).list({ page: list.page, pageSize: list.pageSize, signal }),
  });

  const rows = reviews.data?.items ?? [];
  const total = reviews.data?.total ?? 0;
  const state = reviews.isPending ? 'loading' : reviews.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  const schema: ListSchema<(typeof rows)[number]> = {
    title: t('store.manage.reviews'),
    description: t('store.manage.reviewsDescription'),
    rowKey: 'id',
    rowAttributes: (row) => ({ 'data-ai-row': row.appName || row.id }),
    columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'store-manage:reviews:columns' },
    columns: [
      { key: 'appName', hideable: true, title: t('store.manage.app'), render: (row) => <span className="truncate font-medium text-ai-fg">{row.appName || row.appId}</span> },
      { key: 'status', hideable: true, title: t('cluster.column.status'), width: 130, render: (row) => <Badge tone={row.status === 'passed' ? 'success' : row.status === 'rejected' ? 'danger' : 'warning'}>{row.status || '-'}</Badge> },
      { key: 'reviewer', hideable: true, title: t('store.manage.reviewer'), width: 160, hideBelow: 'md', render: (row) => <span className="truncate text-ai-fg-secondary">{row.reviewer || '-'}</span> },
      { key: 'createdAt', hideable: true, title: t('cluster.column.createdAt'), width: 170, hideBelow: 'lg', render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span> },
    ],
    empty: { title: t('store.manage.reviewsEmpty'), description: t('store.manage.emptyDescription') },
    labels: {
      selectAll: t('table.selectAll'),
      selectRow: (index) => t('table.selectRow', { index }),
      moreActions: t('table.moreActions'),
      previous: t('table.previous'),
      next: t('table.next'),
      selected: (count) => t('table.selectedCount', { count }),
    },
    pagination: { page: list.page, pageSize: list.pageSize, pageSizeOptions: [...PAGE_SIZES], total },
  };

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('store-manage:reviews', columnKeys);

  if (state === 'error') {
    return <ResourceErrorPanel error={reviews.error} onRetry={() => void reviews.refetch()} retryAiId="store-manage:reviews:retry" />;
  }
  if (state === 'loading') return <Skeleton className="h-40 w-full" />;
  return <ResourceList {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})} onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys} schema={schema} rows={rows} loading={false} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} />;
}
