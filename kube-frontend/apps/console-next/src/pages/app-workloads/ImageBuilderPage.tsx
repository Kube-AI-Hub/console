import * as React from 'react';
import { Link } from '@tanstack/react-router';
import type { ImageBuilderSummary } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, ResourceList, type ListSchema } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { formatTimestamp } from '@/lib/time';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { useListRefresh } from '@/components/resource/useListRefresh';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { EditInfoDialog } from '@/components/resource/EditInfoDialog';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { ImageBuilderCreateDialog } from './imagebuilder/ImageBuilderCreateDialog';
import { builderStatusKey, kindKey, statusTone } from './imagebuilder/format';
import {
  useDeleteBuilder,
  useImageBuilders,
  usePatchBuilderInfo,
} from './imagebuilder/queries';

/**
 * 镜像构建器（项目级）.
 *
 * S2I/B2I builders live in the devops group's **v1alpha1**, not the v1alpha3 that serves
 * pipelines: the same group has two versions and the S2I CRDs were never promoted. The
 * list is read through the generic resources proxy because that is the endpoint with
 * server-side paging, name search and `totalItems`; the detail and all writes use the raw
 * CRD endpoints (see `api-client/src/s2ibuilder.ts`).
 *
 * What this page owns is the old console's list: columns, row menu, bulk delete, create.
 * The detail page owns the run history; the list only answers "which builders exist and
 * how did their last build go".
 */
export interface ImageBuilderPageProps {
  workspace: string;
  cluster: string;
  namespace: string;
}

const PAGE_SIZE = 10;

type Dialog =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'editInfo'; row: ImageBuilderSummary }
  | { kind: 'delete'; rows: ImageBuilderSummary[] };

export function ImageBuilderPage({ workspace, cluster, namespace }: ImageBuilderPageProps): React.ReactElement {
  const t = useT();
  const list = useResourceListState<'createTime'>({
    defaultSortBy: 'createTime',
    defaultOrder: 'desc',
    defaultPageSize: PAGE_SIZE,
    resetOn: [cluster, namespace],
  });
  const query = useImageBuilders({
    cluster,
    namespace,
    page: list.page,
    pageSize: list.pageSize,
    sortBy: list.sortBy,
    order: list.order,
    keyword: list.search,
  });
  const remove = useDeleteBuilder({ cluster, namespace });
  const patchInfo = usePatchBuilderInfo({ cluster, namespace });
  const listRefresh = useListRefresh('image-builder', query);
  const [dialog, setDialog] = React.useState<Dialog>({ kind: 'none' });

  const rows = query.data?.items ?? [];
  const total = query.data?.total ?? 0;

  // The paged collection answers 500 for a page beyond the last one. Any mutation resets
  // to page one, and a shrink observed in a successful response clamps the page instead of
  // leaving the reader on a page that cannot be fetched.
  React.useEffect(() => {
    if (!query.data || query.data.total === 0) return;
    const lastPage = Math.max(1, Math.ceil(query.data.total / list.pageSize));
    if (list.page > lastPage) list.setPage(lastPage);
  }, [query.data, list]);

  const schema = React.useMemo<ListSchema<ImageBuilderSummary>>(
    () => ({
      title: t('devopsProject.s2ibuilder.title'),
      description: t('devopsProject.s2ibuilder.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('devopsProject.s2ibuilder.searchPlaceholder'), aiId: 'image-builder:search' },
      refresh: listRefresh.refresh,
      columnVisibility: {
        label: t('devopsProject.s2ibuilder.columns'),
        resetLabel: t('devopsProject.s2ibuilder.resetColumns'),
        aiId: 'image-builder:columns',
      },
      primaryAction: { key: 'create', label: t('devopsProject.s2ibuilder.create'), aiId: 'image-builder:create' },
      selection: 'multiple',
      actions: [{ key: 'bulk-delete', label: t('common.delete'), tone: 'danger', aiId: 'image-builder:bulk-delete' }],
      columns: [
        {
          key: 'name',
          title: t('devopsProject.s2ibuilder.column.name'),
          render: (row) => (
            <span className="flex min-w-0 flex-col">
              <Link
                to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/s2ibuilder/$name"
                params={{ workspace, cluster, namespace, name: row.name }}
                className="inline-flex min-h-6 items-center truncate font-medium text-ai-fg hover:text-ai-accent"
                title={row.name}
                data-ai-id={'image-builder:open:' + row.name}
              >
                {row.displayName || row.name}
              </Link>
              <span className="truncate text-[11px] text-ai-fg-muted">
                {[t(kindKey(row.kind)), row.serviceName ? t('devopsProject.s2ibuilder.forService', { service: row.serviceName }) : '']
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
          ),
        },
        {
          key: 'status',
          title: t('devopsProject.s2ibuilder.column.status'),
          width: 130,
          render: (row) => (
            <Badge tone={statusTone(row.status)} className="whitespace-nowrap" data-ai-id={'image-builder:status:' + row.name}>
              {t(builderStatusKey(row.status))}
            </Badge>
          ),
        },
        {
          key: 'type',
          hideable: true,
          title: t('devopsProject.s2ibuilder.column.type'),
          width: 110,
          hideBelow: 'xl',
          render: (row) => <span className="whitespace-nowrap text-ai-fg-secondary">{t(kindKey(row.kind))}</span>,
        },
        {
          key: 'service',
          hideable: true,
          title: t('devopsProject.s2ibuilder.column.service'),
          width: 180,
          hideBelow: 'xl',
          render: (row) =>
            row.serviceName ? (
              <Link
                to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/services/$name"
                params={{ workspace, cluster, namespace, name: row.serviceName }}
                className="truncate text-ai-accent hover:underline"
                data-ai-id={'image-builder:service:' + row.name}
              >
                {row.serviceName}
              </Link>
            ) : (
              <span className="text-ai-fg-muted">-</span>
            ),
        },
        {
          key: 'baseImage',
          hideable: true,
          title: t('devopsProject.s2ibuilder.column.baseImage'),
          hideBelow: 'md',
          render: (row) => (
            <code className="block max-w-md truncate font-mono text-[11px] text-ai-fg-secondary" title={row.baseImage}>
              {row.baseImage || '-'}
            </code>
          ),
        },
        {
          key: 'lastRun',
          hideable: true,
          title: t('devopsProject.s2ibuilder.column.lastRunAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row) => (
            <span className="whitespace-nowrap tabular-nums text-ai-fg-muted" data-ai-id={'image-builder:last-run:' + row.name}>
              {row.lastRunStartTime ? formatTimestamp(row.lastRunStartTime) : '-'}
            </span>
          ),
        },
        {
          key: 'createdAt',
          hideable: true,
          title: t('devopsProject.s2ibuilder.column.createdAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row) => (
            <span className="whitespace-nowrap tabular-nums text-ai-fg-muted" data-ai-id={'image-builder:created-at:' + row.name}>
              {formatTimestamp(row.createdAt)}
            </span>
          ),
        },
      ],
      rowActions: [
        { key: 'editInfo', label: t('resource.action.editInfo') },
        { key: 'delete', label: t('common.delete'), tone: 'danger' },
      ],
      empty: {
        title: t('devopsProject.s2ibuilder.emptyTitle'),
        description: t('devopsProject.s2ibuilder.emptyDescription'),
      },
      labels: {
        ...listRefresh.emptyLabels,
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
        clearSearch: t('table.clearSearchAndFilters'),
        clearFilters: t('table.clearSearchAndFilters'),
        range: (from, to, count) => t('table.range', { from, to, total: count }),
        goToPage: t('table.goToPage'),
        jumpTo: t('table.jumpTo'),
        pageSize: t('table.pageSize'),
        pageSizeSuffix: t('table.pageSizeSuffix'),
      },
      pagination: { page: list.page, pageSize: list.pageSize, total },
    }),
    [cluster, list, listRefresh, namespace, t, total, workspace],
  );

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('image-builder', columnKeys);

  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="image-builder:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="image-builder:retry" />
      </AiSurface>
    );
  }

  const closeDialog = (): void => setDialog({ kind: 'none' });

  return (
    <AiSurface as="section" aiId="image-builder:surface" state={state} className="min-w-0">
      <ResourceList
        schema={schema}
        rows={rows}
        {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
        onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys}
        loading={state === 'loading'}
        searchValue={list.keyword}
        onSearchChange={list.setKeyword}
        onRefresh={listRefresh.onRefresh}
        selectedKeys={list.selected}
        onSelectionChange={list.setSelected}
        onPageChange={list.setPage}
        onAction={(action, row) => {
          if (action === 'create') return setDialog({ kind: 'create' });
          if (!row) return;
          if (action === 'editInfo') return setDialog({ kind: 'editInfo', row });
          if (action === 'delete') return setDialog({ kind: 'delete', rows: [row] });
        }}
        onBulkAction={(action, keys) => {
          if (action !== 'bulk-delete' || keys.length === 0) return;
          setDialog({ kind: 'delete', rows: rows.filter((row) => keys.includes(row.name)) });
        }}
      />

      <MutationAlert error={remove.error ?? patchInfo.error} />

      <ImageBuilderCreateDialog
        open={dialog.kind === 'create'}
        onOpenChange={(open) => (open ? setDialog({ kind: 'create' }) : closeDialog())}
        cluster={cluster}
        namespace={namespace}
        onCreated={() => {
          list.setPage(1);
          list.setSelected([]);
          void query.refetch();
        }}
      />

      {dialog.kind === 'editInfo' ? (
        <EditInfoDialog
          open
          onOpenChange={(open) => (open ? setDialog({ kind: 'editInfo', row: dialog.row }) : closeDialog())}
          resource="image-builder"
          name={dialog.row.name}
          alias={dialog.row.alias}
          description={dialog.row.description}
          annotations={dialog.row.annotations}
          pending={patchInfo.isPending}
          onSubmit={async (annotations) => {
            await patchInfo.mutateAsync({ name: dialog.row.name, annotations });
            closeDialog();
          }}
        />
      ) : null}

      {dialog.kind === 'delete' ? (
        <DeleteDialog
          open
          onOpenChange={(open) => (open ? setDialog({ kind: 'delete', rows: dialog.rows }) : closeDialog())}
          names={dialog.rows.map((row) => row.name)}
          resource="image-builder"
          noun={t('devopsProject.s2ibuilder.title')}
          pending={remove.isPending}
          onConfirm={async () => {
            for (const row of dialog.rows) await remove.mutateAsync(row.name);
            list.setSelected([]);
            // A page can disappear when its last row is deleted; go back one page rather
            // than leaving the reader on a URL the server answers 500 for.
            if (dialog.rows.length >= rows.length && list.page > 1) list.setPage(list.page - 1);
            closeDialog();
            void query.refetch();
          }}
        />
      ) : null}
    </AiSurface>
  );
}
