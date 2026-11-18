import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  annotationKeys,
  persistentVolumesApi,
  type PersistentVolumeDetail,
  type PersistentVolumeSummary,
} from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { errorMessage, MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { EditInfoDialog } from '@/components/resource/EditInfoDialog';
import { LoadingDialog } from '@/components/resource/LoadingDialog';
import { DialogSuspense } from '@/components/resource/DialogSuspense';
import { toYaml } from '@/components/resource/yaml';
import { formatTimestamp } from '@/lib/time';
import { statusLabel } from '@/lib/status';
import { useListRefresh } from '@/components/resource/useListRefresh';

const YamlDialog = React.lazy(() => import('@/components/resource/YamlDialog'));

/**
 * 持久卷 (PersistentVolume).
 *
 * Cluster-scoped infrastructure: the columns answer "what backs this, who holds it, and
 * what happens on release". Writes were re-included by the 2026-11-17 product review
 * (N-11): hiding the delete button did not stop administrators from deleting volumes, it
 * only moved them to kubectl, where the Bound/Released guard does not exist. The guard
 * now lives here: `Bound` / `Released` volumes cannot be deleted, single or bulk; bulk
 * reports deleted/skipped/failed instead of stopping halfway.
 *
 * Read from the core API rather than the kapis proxy: measured 24s against 63s for the
 * same list, and the page only needs the standard fields.
 */
export interface PersistentVolumesPageProps {
  cluster: string;
}

/** A volume the platform forbids deleting through the console. */
const UNDELETABLE = new Set(['Bound', 'Released']);

type Dialog =
  | { kind: 'none' }
  | { kind: 'loading'; target: 'editInfo' | 'editYaml'; subject: string }
  | { kind: 'delete'; names: string[] }
  | { kind: 'editInfo'; detail: PersistentVolumeDetail }
  | { kind: 'editYaml'; detail: PersistentVolumeDetail };

interface BatchResult {
  deleted: number;
  skipped: number;
  failed: number;
}

export function PersistentVolumesPage({ cluster }: PersistentVolumesPageProps): React.ReactElement {
  const t = useT();
  const list = useResourceListState<'name' | 'createTime'>({ defaultSortBy: 'name', defaultOrder: 'asc' });

  const query = useQuery({
    queryKey: ['persistentvolumes'],
    queryFn: ({ signal }) => persistentVolumesApi(apiClient).list({ signal }),
  });
  const queryClient = useQueryClient();
  const [dialog, setDialog] = React.useState<Dialog>({ kind: 'none' });
  const [batchResult, setBatchResult] = React.useState<BatchResult | null>(null);
  /** Selected rows that the console refuses to delete; carried into the result summary. */
  const [batchSkipped, setBatchSkipped] = React.useState(0);

  /** Invalidate both the list and any open detail query. */
  const invalidate = React.useCallback(
    (name?: string) => {
      void queryClient.invalidateQueries({ queryKey: ['persistentvolumes'] });
      if (name) void queryClient.invalidateQueries({ queryKey: ['persistent-volume-detail', name] });
    },
    [queryClient],
  );

  const updateInfo = useMutation({
    mutationFn: (params: { name: string; annotations: Record<string, string> }) =>
      persistentVolumesApi(apiClient).updateInfo(params),
    onSuccess: (_, params) => invalidate(params.name),
  });
  const updateYaml = useMutation({
    mutationFn: (params: { name: string; body: Record<string, unknown> }) =>
      persistentVolumesApi(apiClient).update({ name: params.name, body: params.body }),
    onSuccess: (_, params) => invalidate(params.name),
  });
  /**
   * Remove one by one and keep the outcome.
   *
   * A batch is not atomic upstream. Reporting "deleted 2, skipped 1, failed 1" is the
   * only honest result; throwing on the first failure would hide the rows already gone.
   */
  const remove = useMutation({
    mutationFn: async (names: string[]): Promise<{ deleted: string[]; failed: string[] }> => {
      const deleted: string[] = [];
      const failed: string[] = [];
      for (const name of names) {
        try {
          await persistentVolumesApi(apiClient).remove({ names: [name] });
          deleted.push(name);
        } catch {
          failed.push(name);
        }
      }
      return { deleted, failed };
    },
    onSuccess: () => invalidate(),
  });

  const openWithDetail = React.useCallback(
    async (target: 'editInfo' | 'editYaml', name: string) => {
      setDialog({ kind: 'loading', target, subject: name });
      try {
        const detail = await persistentVolumesApi(apiClient).get({ name });
        setDialog({ kind: target, detail });
      } catch {
        // A failed read must not leave a half-populated dialog open.
        setDialog({ kind: 'none' });
      }
    },
    [],
  );

  const all = query.data?.items ?? [];
  const keyword = list.search.trim().toLowerCase();
  const filtered = keyword
    ? all.filter((row) => row.name.toLowerCase().includes(keyword) || row.claim.toLowerCase().includes(keyword))
    : all;

  const rows = React.useMemo(() => {
    const items = [...filtered];
    const direction = list.order === 'asc' ? 1 : -1;
    return items.sort((a, b) =>
      list.sortBy === 'createTime'
        ? a.createdAt.localeCompare(b.createdAt) * direction
        : a.name.localeCompare(b.name) * direction,
    );
  }, [filtered, list.sortBy, list.order]);
  const listRefresh = useListRefresh('persistentvolumes', query);

  const selectedRows = React.useMemo(() => rows.filter((row) => list.selected.includes(row.name)), [rows, list.selected]);
  const protectedCount = rows.filter((row) => UNDELETABLE.has(row.status)).length;

  const schema = React.useMemo<ListSchema<PersistentVolumeSummary>>(
    () => ({
      title: t('cluster.persistentVolumes.title'),
      refresh: listRefresh.refresh,
      description: t('cluster.persistentVolumes.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('cluster.searchPlaceholder'), aiId: 'persistentvolumes:search' },
      selection: 'multiple',
      selectAiId: 'persistentvolumes:select',
      sortableKeys: ['name', 'createTime'],
      // Third click of the header cycle returns to the page's default order;
      // a server list must send a sort key, so "off" cannot be absent.
      sortFallback: list.sortFallback,
      sortAiPrefix: 'persistentvolumes',
      sort: { key: list.sortBy, order: list.order },
      columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'persistent-volumes:columns' },
      actions: [
        {
          key: 'bulk-delete',
          label: t('cluster.persistentVolumes.bulkDelete'),
          tone: 'danger',
          aiId: 'persistentvolumes:bulk-delete',
          aiNeeds: ['persistentvolumes:row-select'],
        },
      ],
      columns: [
        {
          key: 'name',
          title: t('cluster.column.name'),
          render: (row) => (
            <span className="flex min-w-0 flex-col" {...actionProps(`persistentvolumes:name:${row.name}`)}>
              <Link
                to="/kube-frontend/clusters/$cluster/persistentvolumes/$name"
                params={{ cluster, name: row.name }}
                className="truncate font-medium text-ai-link hover:underline"
              >
                {row.name}
              </Link>
              <span className="truncate text-[11px] text-ai-fg-muted">{row.storageClass || '-'}</span>
            </span>
          ),
        },
        {
          key: 'status',
          hideable: true,
          title: t('storage.column.status'),
          width: 120,
          render: (row) => (
            <Badge tone={row.status === 'Bound' ? 'success' : row.status === 'Available' ? 'info' : 'warning'}>
              {row.status ? statusLabel(t, row.status) : '-'}
            </Badge>
          ),
        },
        {
          key: 'capacity',
          hideable: true,
          title: t('storage.column.capacity'),
          width: 100,
          render: (row) => <span className="tabular-nums text-ai-fg-secondary">{row.capacity || '-'}</span>,
        },
        {
          key: 'accessModes',
          hideable: true,
          title: t('storage.column.accessModes'),
          width: 110,
          hideBelow: 'lg',
          render: (row) => <span className="text-ai-fg-secondary">{row.accessModes.join(', ') || '-'}</span>,
        },
        {
          key: 'claim',
          hideable: true,
          title: t('cluster.persistentVolumes.claim'),
          width: 200,
          hideBelow: 'md',
          render: (row) => <span className="truncate font-mono text-[11px] text-ai-fg-secondary">{row.claim || '-'}</span>,
        },
        {
          key: 'reclaimPolicy',
          hideable: true,
          title: t('cluster.storageClasses.reclaim'),
          width: 110,
          hideBelow: 'xl',
          render: (row) => <span className="text-ai-fg-secondary">{row.reclaimPolicy}</span>,
        },
        {
          key: 'createTime',
          hideable: true,
          title: t('cluster.column.createdAt'),
          width: 160,
          hideBelow: 'xl',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
        },
      ],
      rowActions: [
        { key: 'editInfo', label: t('resource.action.editInfo') },
        { key: 'editYaml', label: t('resource.action.editYaml') },
        {
          key: 'delete',
          label: t('common.delete'),
          tone: 'danger',
          // The action stays visible but disabled: a missing button reads as "the console
          // forgot it", while the hint above the table says why this row cannot go.
          disabled: (row) => UNDELETABLE.has(row.status),
        },
      ],
      empty: { title: t('cluster.persistentVolumes.emptyTitle'), description: t('cluster.persistentVolumes.emptyDescription') },
      labels: {
        ...listRefresh.emptyLabels,
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      pagination: { page: 1, pageSize: Math.max(rows.length, 1), total: rows.length },
    }),
    [cluster, list.selected, list.order, list.sortBy, query.isFetching, rows.length, t],
  );

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('persistent-volumes', columnKeys);

  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="persistentvolumes:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="persistentvolumes:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="persistentvolumes:surface" state={state} className="flex min-w-0 flex-col gap-2">
      {protectedCount > 0 ? (
        <p className="text-[11px] text-ai-fg-muted" data-ai-id="persistentvolumes:delete-policy">
          {t('cluster.persistentVolumes.deletePolicy')}
        </p>
      ) : null}
      <ResourceList
        {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
        onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys}
        schema={schema}
        onRefresh={listRefresh.onRefresh}
        rows={rows}
        // The list takes ~24s on this cluster; showing the skeleton while a refetch is
        // in flight is what tells the reader the page is working.
        loading={query.isFetching}
        searchValue={list.keyword}
        onSearchChange={list.setKeyword}
        selectedKeys={list.selected}
        onSelectionChange={list.setSelected}
        onSortChange={(next: { key: string; order: SortOrder }) => {
          if (next) list.setSort(next);
        }}
        onAction={(action, row) => {
          if (!row) return;
          if (action === 'delete') {
            if (UNDELETABLE.has(row.status)) return;
            setBatchSkipped(0);
            setBatchResult(null);
            setDialog({ kind: 'delete', names: [row.name] });
            return;
          }
          if (action === 'editInfo' || action === 'editYaml') void openWithDetail(action, row.name);
        }}
        onBulkAction={(action, keys) => {
          if (action !== 'bulk-delete' || !keys.length) return;
          const deletable = selectedRows.filter((row) => !UNDELETABLE.has(row.status));
          const skipped = keys.length - deletable.length;
          setBatchSkipped(skipped);
          if (!deletable.length) {
            setBatchResult({ deleted: 0, skipped, failed: 0 });
            return;
          }
          setBatchResult(null);
          setDialog({ kind: 'delete', names: deletable.map((row) => row.name) });
        }}
      />

      {batchResult ? (
        <p
          className="text-xs text-ai-fg-secondary"
          role="status"
          data-ai-id="persistentvolumes:batch-result"
          data-ai-deleted={batchResult.deleted}
          data-ai-skipped={batchResult.skipped}
          data-ai-failed={batchResult.failed}
        >
          {batchResult.deleted + batchResult.failed === 0
            ? t('cluster.persistentVolumes.batchNothing', { skipped: batchResult.skipped })
            : t('cluster.persistentVolumes.batchResult', {
                deleted: batchResult.deleted,
                skipped: batchResult.skipped,
                failed: batchResult.failed,
              })}
        </p>
      ) : null}

      <MutationAlert error={updateInfo.error ?? updateYaml.error} />

      {dialog.kind === 'loading' ? (
        <LoadingDialog
          open
          title={dialog.target === 'editInfo' ? t('resource.action.editInfo') : t('resource.action.editYaml')}
          subject={dialog.subject}
          size="xl"
        />
      ) : null}

      {dialog.kind === 'delete' ? (
        <DeleteDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setDialog({ kind: 'none' });
              setBatchResult(null);
            }
          }}
          names={dialog.names}
          resource="persistentvolumes"
          noun={t('cluster.persistentVolumes.noun')}
          pending={remove.isPending}
          {...(remove.error ? { error: errorMessage(t, remove.error) } : {})}
          onConfirm={async () => {
            const names = dialog.names;
            const result = await remove.mutateAsync(names);
            setBatchResult({ deleted: result.deleted.length, skipped: batchSkipped, failed: result.failed.length });
            list.setSelected([]);
            setDialog({ kind: 'none' });
          }}
        />
      ) : null}

      {dialog.kind === 'editInfo' ? (
        <EditInfoDialog
          open
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          resource="persistentvolumes"
          name={dialog.detail.name}
          alias={dialog.detail.annotations[annotationKeys.alias] ?? ''}
          description={dialog.detail.annotations[annotationKeys.description] ?? ''}
          annotations={dialog.detail.annotations}
          pending={updateInfo.isPending}
          onSubmit={async (annotations) => {
            await updateInfo.mutateAsync({ name: dialog.detail.name, annotations });
            setDialog({ kind: 'none' });
          }}
        />
      ) : null}

      {dialog.kind === 'editYaml' ? (
        <DialogSuspense>
          <YamlDialog
            open
            onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
            initialYaml={toYaml(dialog.detail.raw)}
            lockName={dialog.detail.name}
            title={t('resource.action.editYaml')}
            submitLabel={t('common.confirm')}
            pending={updateYaml.isPending}
            onSubmit={async (object) => {
              await updateYaml.mutateAsync({ name: dialog.detail.name, body: object });
              setDialog({ kind: 'none' });
            }}
          />
        </DialogSuspense>
      ) : null}
    </AiSurface>
  );
}
