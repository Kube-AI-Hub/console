import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  annotationKeys,
  storageApi,
  storageClassesApi,
  type StorageClassDetail,
  type StorageClassDraft,
  type StorageClassSummary,
  type StorageSummary,
} from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { useResourceListState, toListParams } from '@/components/resource/useResourceListState';
import { errorMessage, MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { EditInfoDialog } from '@/components/resource/EditInfoDialog';
import { LoadingDialog } from '@/components/resource/LoadingDialog';
import { DialogSuspense } from '@/components/resource/DialogSuspense';
import { toYaml } from '@/components/resource/yaml';
import { formatTimestamp } from '@/lib/time';
import { useListRefresh } from '@/components/resource/useListRefresh';
import { StorageClassCreateDialog } from './StorageClassCreateDialog';

const YamlDialog = React.lazy(() => import('@/components/resource/YamlDialog'));

/**
 * 存储类型 (StorageClass).
 *
 * Writes were re-included by the 2026-11-17 review (N-12). A class that claims still
 * reference cannot be deleted; the guard reads the live PVC collection, not the
 * kubesphere.io/pvc-count annotation (which can be stale). Writes go to storage.k8s.io/v1
 * because the kapis resources proxy registers GET only.
 */
export interface StorageClassesPageProps {
  cluster: string;
}

/** Page sizes the old console offered: 10/20/50/100. */
const PAGE_SIZES = [10, 20, 50, 100] as const;
const PAGE_SIZE = 10;

type Dialog =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'loading'; target: 'editInfo' | 'editYaml'; subject: string }
  | { kind: 'delete'; names: string[] }
  | { kind: 'editInfo'; detail: StorageClassDetail }
  | { kind: 'editYaml'; detail: StorageClassDetail };

interface ResultSummary {
  deleted: number;
  skipped: number;
  failed: number;
}

/**
 * Whether a delete must be refused.
 *
 * Two independent reasons, both safety-critical: the class is used by a claim, or the claim
 * read failed so "not used" cannot be proven. The second is the one a page forgets, and a
 * failed read then silently authorises deleting an in-use class.
 */
export function isDeleteBlocked(claimCount: number | undefined, claimsUnavailable: boolean): boolean {
  return claimsUnavailable || (claimCount ?? 0) > 0;
}

export function StorageClassesPage({ cluster }: StorageClassesPageProps): React.ReactElement {
  const t = useT();
  const list = useResourceListState<'name' | 'createTime'>({ defaultSortBy: 'name', defaultPageSize: PAGE_SIZE, resetOn: [cluster] });
  const query = useQuery({
    queryKey: ['storageclasses', cluster],
    queryFn: ({ signal }) => storageClassesApi(apiClient).list({ ...toListParams(list, { cluster, namespace: '' }, 200), signal }),
  });

  const sorted = React.useMemo(() => {
    const items = [...((query.data?.items ?? []) as StorageClassSummary[])];
    return items.sort((a, b) => {
      const direction = list.order === 'asc' ? 1 : -1;
      if (list.sortBy === 'createTime') return a.createdAt.localeCompare(b.createdAt) * direction;
      return a.name.localeCompare(b.name) * direction;
    });
  }, [query.data, list.sortBy, list.order]);
  const rows = sorted.slice((list.page - 1) * list.pageSize, list.page * list.pageSize);
  const total = query.data?.total ?? 0;
  const listRefresh = useListRefresh('storageclasses', query);

  const queryClient = useQueryClient();
  const [dialog, setDialog] = React.useState<Dialog>({ kind: 'none' });
  const [result, setResult] = React.useState<ResultSummary | null>(null);
  const [pendingSkipped, setPendingSkipped] = React.useState(0);

  const claims = useQuery({
    queryKey: ['storageclass-claims', cluster],
    queryFn: ({ signal }) => storageApi(apiClient, 'persistentvolumeclaims').list({ cluster, namespace: '', page: 1, pageSize: 500, signal }),
  });
  const claimCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const claim of (claims.data?.items ?? []) as StorageSummary[]) {
      if (!claim.storageClass) continue;
      counts.set(claim.storageClass, (counts.get(claim.storageClass) ?? 0) + 1);
    }
    return counts;
  }, [claims.data]);
  const inUse = React.useCallback(
    (row: StorageClassSummary) => isDeleteBlocked(claimCounts.get(row.name), false),
    [claimCounts],
  );

  const invalidate = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['storageclasses', cluster] });
    void queryClient.invalidateQueries({ queryKey: ['storageclass-claims', cluster] });
  }, [cluster, queryClient]);

  const create = useMutation({
    mutationFn: (draft: StorageClassDraft) => storageClassesApi(apiClient).create(draft),
    onSuccess: () => {
      invalidate();
      setDialog({ kind: 'none' });
    },
  });
  const updateInfo = useMutation({
    mutationFn: (params: { name: string; annotations: Record<string, string> }) =>
      storageClassesApi(apiClient).updateInfo({ cluster, ...params }),
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ['storageclass-detail'] });
    },
  });
  const updateYaml = useMutation({
    mutationFn: (params: { name: string; body: Record<string, unknown> }) =>
      storageClassesApi(apiClient).update({ cluster, namespace: '', body: params.body }),
    onSuccess: () => invalidate(),
  });
  const setDefault = useMutation({
    mutationFn: (name: string) => storageClassesApi(apiClient).setDefault({ cluster, name }),
    onSuccess: () => {
      invalidate();
      setResult(null);
    },
  });
  const remove = useMutation({
    mutationFn: async (names: string[]): Promise<{ deleted: string[]; failed: string[] }> => {
      const deleted: string[] = [];
      const failed: string[] = [];
      for (const name of names) {
        try {
          await storageClassesApi(apiClient).remove({ cluster, names: [name] });
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
        const detail = await storageClassesApi(apiClient).get({ cluster, name, namespace: '' });
        setDialog({ kind: target, detail });
      } catch {
        setDialog({ kind: 'none' });
      }
    },
    [cluster],
  );

  const inUseCount = sorted.filter(inUse).length;
  /** While loading or after a failure we cannot prove a class is unused, so deletion is unsafe. */
  const claimsUnavailable = claims.isPending || claims.isError;

  const schema = React.useMemo<ListSchema<StorageClassSummary>>(
    () => ({
      title: t('cluster.storageClasses.title'),
      refresh: listRefresh.refresh,
      description: t('cluster.storageClasses.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('cluster.searchPlaceholder'), aiId: 'storageclasses:search' },
      selection: 'multiple',
      selectAiId: 'storageclasses:select',
      sortableKeys: ['name', 'createTime'],
      // Third click of the header cycle returns to the page's default order;
      // a server list must send a sort key, so "off" cannot be absent.
      sortFallback: list.sortFallback,
      sortAiPrefix: 'storageclasses',
      sort: { key: list.sortBy, order: list.order },
      columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'storageclasses:columns' },
      primaryAction: { key: 'create', label: t('cluster.storageClasses.create'), aiId: 'storageclasses:create' },
      // With the claim read failed there is no safe subset to delete; hide the bulk action
      // instead of offering an operation the page cannot guard.
      actions: claimsUnavailable
        ? []
        : [
            {
              key: 'bulk-delete',
              label: t('cluster.storageClasses.bulkDelete'),
              tone: 'danger',
              aiId: 'storageclasses:bulk-delete',
              aiNeeds: ['storageclasses:row-select'],
            },
          ],
      columns: [
        {
          key: 'name',
          title: t('cluster.column.name'),
          render: (row) => (
            <span className="flex min-w-0 items-center gap-1.5" {...actionProps('storageclasses:name:' + row.name)}>
              <Link
                to="/kube-frontend/clusters/$cluster/storageclasses/$name"
                params={{ cluster, name: row.name }}
                className="truncate font-medium text-ai-link hover:underline"
              >
                {row.name}
              </Link>
              {row.isDefault ? <Badge tone="info">{t('cluster.storageClasses.default')}</Badge> : null}
            </span>
          ),
        },
        {
          key: 'provisioner',
          hideable: true,
          title: t('cluster.storageClasses.provisioner'),
          width: 200,
          hideBelow: 'md',
          render: (row) => <span className="truncate font-mono text-[11px] text-ai-fg-secondary">{row.provisioner || '-'}</span>,
        },
        {
          key: 'pvcCount',
          hideable: true,
          title: t('cluster.storageClasses.pvcCount'),
          width: 110,
          hideBelow: 'lg',
          render: (row) => {
            const live = claimCounts.get(row.name);
            const value = live ?? row.pvcCount;
            return <span className="tabular-nums text-ai-fg-secondary">{value === undefined ? '-' : value}</span>;
          },
        },
        {
          key: 'capabilities',
          hideable: true,
          title: t('cluster.storageClasses.capabilities'),
          width: 220,
          hideBelow: 'lg',
          render: (row) => {
            const supported = [
              row.allowExpansion ? t('cluster.storageClasses.expand') : null,
              row.allowCloning ? t('cluster.storageClasses.clone') : null,
              row.allowSnapshot ? t('cluster.storageClasses.snapshot') : null,
            ].filter((label): label is string => Boolean(label));
            if (supported.length === 0) return <span className="text-ai-fg-muted">-</span>;
            return (
              <span className="flex flex-wrap gap-1">
                {supported.map((label) => (
                  <Badge key={label} tone="success">{label}</Badge>
                ))}
              </span>
            );
          },
        },
        {
          key: 'reclaimPolicy',
          hideable: true,
          title: t('cluster.storageClasses.reclaim'),
          width: 130,
          hideBelow: 'xl',
          render: (row) => <span className="text-ai-fg-secondary">{row.reclaimPolicy}</span>,
        },
        {
          key: 'createTime',
          hideable: true,
          title: t('cluster.column.createdAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
        },
      ],
      rowActions: [
        { key: 'editInfo', label: t('resource.action.editInfo') },
        { key: 'editYaml', label: t('resource.action.editYaml') },
        {
          key: 'setDefault',
          label: t('cluster.storageClasses.setDefault'),
          visible: (row) => !row.isDefault,
          // Explicit: replacing the current default changes where new claims land.
          confirm: t('cluster.storageClasses.setDefaultConfirm'),
        },
        { key: 'delete', label: t('common.delete'), tone: 'danger', disabled: (row) => isDeleteBlocked(claimCounts.get(row.name), claimsUnavailable) },
      ],
      empty: { title: t('cluster.storageClasses.emptyTitle'), description: t('cluster.storageClasses.emptyDescription') },
      labels: {
        ...listRefresh.emptyLabels,
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      pagination: { page: list.page, pageSize: list.pageSize, pageSizeOptions: [...PAGE_SIZES], total },
    }),
    [claimCounts, claimsUnavailable, inUse, list, query.isFetching, t, total],
  );

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('storageclasses', columnKeys);

  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="storageclasses:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="storageclasses:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="storageclasses:surface" state={state} className="flex min-w-0 flex-col gap-2">
      {claimsUnavailable ? (
        <p className="text-[11px] text-ai-warning" role="status" data-ai-id="storageclasses:claims-unavailable">
          {t('cluster.storageClasses.claimsUnavailable')}
        </p>
      ) : inUseCount > 0 ? (
        <p className="text-[11px] text-ai-fg-muted" data-ai-id="storageclasses:delete-policy">
          {t('cluster.storageClasses.deletePolicy')}
        </p>
      ) : null}
      <ResourceList
        {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
        onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys}
        schema={schema}
        onRefresh={listRefresh.onRefresh}
        rows={rows}
        loading={state === 'loading'}
        searchValue={list.keyword}
        onSearchChange={list.setKeyword}
        selectedKeys={list.selected}
        onSelectionChange={list.setSelected}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        onSortChange={(next: { key: string; order: SortOrder }) => {
          if (next) list.setSort(next);
        }}
        onAction={(action, row) => {
          if (action === 'create') {
            setDialog({ kind: 'create' });
            return;
          }
          if (!row) return;
          if (action === 'delete') {
            if (isDeleteBlocked(claimCounts.get(row.name), claimsUnavailable)) return;
            setPendingSkipped(0);
            setResult(null);
            setDialog({ kind: 'delete', names: [row.name] });
            return;
          }
          if (action === 'setDefault') {
            setResult(null);
            setDefault.mutate(row.name);
            return;
          }
          if (action === 'editInfo' || action === 'editYaml') void openWithDetail(action, row.name);
        }}
        onBulkAction={(action, keys) => {
          if (action !== 'bulk-delete' || !keys.length) return;
          // Compute from the selected keys, not from a memo of the current page: the
          // selection is authoritative and the page slice may lag a render behind.
          const deletable = keys.filter((name) => !isDeleteBlocked(claimCounts.get(name), claimsUnavailable));
          const skipped = keys.length - deletable.length;
          setPendingSkipped(skipped);
          if (!deletable.length) {
            setResult({ deleted: 0, skipped, failed: 0 });
            return;
          }
          setResult(null);
          setDialog({ kind: 'delete', names: deletable });
        }}
      />

      {result ? (
        <p
          className="text-xs text-ai-fg-secondary"
          role="status"
          data-ai-id="storageclasses:batch-result"
          data-ai-deleted={result.deleted}
          data-ai-skipped={result.skipped}
          data-ai-failed={result.failed}
        >
          {result.deleted + result.failed === 0
            ? t('cluster.storageClasses.batchNothing', { skipped: result.skipped })
            : t('cluster.storageClasses.batchResult', {
                deleted: result.deleted,
                skipped: result.skipped,
                failed: result.failed,
              })}
        </p>
      ) : null}

      <MutationAlert error={create.error ?? updateInfo.error ?? updateYaml.error ?? setDefault.error} />

      <StorageClassCreateDialog
        open={dialog.kind === 'create'}
        onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
        cluster={cluster}
        pending={create.isPending}
        isNameTaken={(name) => sorted.some((row) => row.name === name)}
        onSubmit={async (draft) => {
          await create.mutateAsync(draft);
        }}
      />

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
              setResult(null);
            }
          }}
          names={dialog.names}
          resource="storageclasses"
          noun={t('cluster.storageClasses.noun')}
          pending={remove.isPending}
          {...(remove.error ? { error: errorMessage(t, remove.error) } : {})}
          onConfirm={async () => {
            const outcome = await remove.mutateAsync(dialog.names);
            setResult({ deleted: outcome.deleted.length, skipped: pendingSkipped, failed: outcome.failed.length });
            list.setSelected([]);
            setDialog({ kind: 'none' });
          }}
        />
      ) : null}

      {dialog.kind === 'editInfo' ? (
        <EditInfoDialog
          open
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          resource="storageclasses"
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
