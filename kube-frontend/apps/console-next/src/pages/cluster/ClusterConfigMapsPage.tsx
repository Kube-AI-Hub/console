import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { configMapsApi, type ConfigMapDetail, type ConfigMapSummary } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useT } from '@/i18n';
import { useListRefresh } from '@/components/resource/useListRefresh';
import { api as apiClient } from '@/api';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { clusterProjectRowId, projectObjectUrl, useClusterProjectIndex } from './useClusterProjectIndex';
import { toYaml } from '@/components/resource/yaml';
import { ConfigMapDeleteDialog } from '@/pages/configmaps/ConfigMapDeleteDialog';
import { ConfigMapEditInfoDialog, ConfigMapEditSettingsDialog } from '@/pages/configmaps/ConfigMapEditDialogs';
import { DialogSuspense } from '@/components/resource/DialogSuspense';
import { LoadingDialog } from '@/components/resource/LoadingDialog';
import { MutationAlert } from '@/components/resource/ResourceErrorPanel';

/**
 * 集群级配置字典（跨项目）.
 *
 * Same cross-project question as the Secret page: a ConfigMap is a namespaced
 * object, so a project page can only answer "what is in this project". The cluster
 * page answers "where does this key live", which is the first step of most
 * configuration debugging. Read-only, with the row linking into its own project.
 *
 * The key count is the number of entries under `data`; KubeSphere's old console
 * calls that column 字段, and the count is what tells a reader whether a ConfigMap
 * carries one value or a hundred.
 */
export interface ClusterConfigMapsPageProps {
  cluster: string;
}

/** Page sizes the old console offered (`PAGESIZE_OPTION`): 10/20/50/100. */
const PAGE_SIZES = [10, 20, 50, 100] as const;
const PAGE_SIZE = 20;
const AI_ID = 'cluster-configmaps';

const ConfigMapYamlDialog = React.lazy(() => import('@/pages/configmaps/ConfigMapYamlDialog'));

type Dialog =
  | { kind: 'none' }
  | { kind: 'loading'; target: 'editInfo' | 'editSettings' | 'editYaml'; subject: string }
  | { kind: 'editInfo'; detail: ConfigMapDetail }
  | { kind: 'editSettings'; detail: ConfigMapDetail }
  | { kind: 'editYaml'; detail: ConfigMapDetail }
  | { kind: 'delete'; row: ConfigMapSummary };

export function ClusterConfigMapsPage({ cluster }: ClusterConfigMapsPageProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = React.useState<Dialog>({ kind: 'none' });
  const invalidate = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [AI_ID] });
  }, [queryClient]);
  const patch = useMutation({
    mutationFn: (input: { namespace: string; name: string; body: unknown }) =>
      configMapsApi(apiClient).patch({ cluster, namespace: input.namespace, name: input.name, body: input.body }),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: (input: { namespace: string; body: Record<string, unknown> }) =>
      configMapsApi(apiClient).update({ cluster, namespace: input.namespace, body: input.body as never }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (input: { namespace: string; names: string[] }) =>
      configMapsApi(apiClient).remove({ cluster, namespace: input.namespace, names: input.names }),
    onSuccess: invalidate,
  });
  const openWithDetail = React.useCallback(
    async (target: 'editInfo' | 'editSettings' | 'editYaml', row: ConfigMapSummary) => {
      setDialog({ kind: 'loading', target, subject: row.name });
      try {
        const detail = await configMapsApi(apiClient).get({ cluster, namespace: row.namespace, name: row.name });
        setDialog({ kind: target, detail });
      } catch {
        setDialog({ kind: 'none' });
      }
    },
    [cluster],
  );
  const list = useResourceListState<'name' | 'createTime'>({ defaultSortBy: 'createTime', defaultOrder: 'desc', defaultPageSize: PAGE_SIZE, resetOn: [cluster] });
  const workspaceOf = useClusterProjectIndex(cluster);

  const query = useQuery({
    queryKey: [AI_ID, cluster, list.page, list.pageSize, list.sortBy, list.order, list.search],
    queryFn: ({ signal }) =>
      configMapsApi(apiClient).list({
        cluster,
        /*
         * Empty namespace + the default project scope is the cross-project read:
         * the URL keeps the cluster segment, so a member cluster lists its own
         * objects. The module's explicit `scope: 'cluster'` would drop that
         * segment and read the host cluster from a member cluster page.
         */
        namespace: '',
        page: list.page,
        pageSize: list.pageSize,
        sortBy: list.sortBy,
        order: list.order,
        keyword: list.search,
        signal,
      }),
  });

  const rows = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';
  const listRefresh = useListRefresh(AI_ID, query);

  const schema = React.useMemo<ListSchema<ConfigMapSummary>>(
    () => ({
      title: t('cluster.config.configmaps.title'),
      refresh: listRefresh.refresh,
      description: t('cluster.config.description'),
      rowKey: (row) => clusterProjectRowId(row),
      rowAttributes: (row) => ({ 'data-ai-row': clusterProjectRowId(row) }),
      search: { placeholder: t('cluster.searchPlaceholder'), aiId: AI_ID + ':search' },
      sortableKeys: ['name', 'createTime'],
      // Third click of the header cycle returns to the page's default order;
      // a server list must send a sort key, so "off" cannot be absent.
      sortFallback: list.sortFallback,
      sortAiPrefix: AI_ID,
      sort: { key: list.sortBy, order: list.order },
      columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'cluster-configmaps:columns' },
      columns: [
        {
          key: 'name',
          title: t('cluster.column.name'),
          render: (row) => (
            <a
              href={projectObjectUrl({
                cluster,
                workspace: workspaceOf.get(row.namespace) ?? 'public',
                namespace: row.namespace,
                page: 'configmaps',
                name: row.name,
              })}
              className="truncate font-medium text-ai-link hover:underline"
              {...actionProps(AI_ID + ':name:' + row.namespace + '/' + row.name)}
            >
              {row.name}
            </a>
          ),
        },
        {
          key: 'namespace',
          hideable: true,
          title: t('cluster.workloads.column.project'),
          width: 180,
          hideBelow: 'md',
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.namespace || '-'}</span>,
        },
        {
          key: 'keys',
          hideable: true,
          title: t('configmaps.column.keys'),
          width: 90,
          align: 'right',
          render: (row) => <span className="tabular-nums text-ai-fg-secondary">{row.keys.length}</span>,
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
        { key: 'editInfo', label: t('configmaps.action.editInfo'), visible: (row) => !row.federated },
        { key: 'editYaml', label: t('configmaps.action.editYaml'), visible: (row) => !row.federated },
        { key: 'editSettings', label: t('configmaps.action.editSettings'), visible: (row) => !row.federated },
        { key: 'delete', label: t('common.delete'), tone: 'danger' as const, visible: (row) => !row.federated },
      ],
      empty: { title: t('cluster.workloads.emptyTitle'), description: t('cluster.workloads.emptyDescription') },
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
    [cluster, list, t, total, workspaceOf],
  );

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('cluster-configmaps', columnKeys);

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId={AI_ID + ':surface'} state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId={AI_ID + ':retry'} />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId={AI_ID + ':surface'} state={state} className="min-w-0">
      <ResourceList
        {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
        onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys}
        schema={schema}
        onRefresh={listRefresh.onRefresh}
        rows={rows}
        loading={state === 'loading'}
        searchValue={list.search}
        onSearchChange={list.setKeyword}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        onSortChange={(next: { key: string; order: SortOrder }) => {
          if (next) list.setSort(next);
        }}
        onAction={(action, row) => {
          if (!row) return;
          if (action === 'delete') return setDialog({ kind: 'delete', row });
          if (action === 'editInfo' || action === 'editSettings' || action === 'editYaml') void openWithDetail(action, row);
        }}
      />

      {dialog.kind === 'loading' ? (
        <LoadingDialog open subject={dialog.subject} size="xl"
          title={dialog.target === 'editInfo' ? t('configmaps.action.editInfo')
            : dialog.target === 'editYaml' ? t('configmaps.action.editYaml') : t('configmaps.action.editSettings')} />
      ) : null}

      {dialog.kind === 'delete' ? (
        <ConfigMapDeleteDialog open names={[dialog.row.name]} pending={remove.isPending}
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          onConfirm={async () => {
            await remove.mutateAsync({ namespace: dialog.row.namespace, names: [dialog.row.name] });
            setDialog({ kind: 'none' });
          }} />
      ) : null}

      {dialog.kind === 'editInfo' ? (
        <ConfigMapEditInfoDialog open detail={dialog.detail} pending={patch.isPending}
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          onSubmit={async (annotations) => {
            await patch.mutateAsync({ namespace: dialog.detail.namespace, name: dialog.detail.name, body: { metadata: { annotations } } });
            setDialog({ kind: 'none' });
          }} />
      ) : null}

      {dialog.kind === 'editSettings' ? (
        <ConfigMapEditSettingsDialog open detail={dialog.detail} pending={update.isPending}
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          onSubmit={async (data) => {
            await update.mutateAsync({ namespace: dialog.detail.namespace, body: { ...dialog.detail.raw, data } });
            setDialog({ kind: 'none' });
          }} />
      ) : null}

      {dialog.kind === 'editYaml' ? (
        <DialogSuspense>
          <ConfigMapYamlDialog open initialYaml={toYaml(dialog.detail.raw)} lockName={dialog.detail.name}
            title={t('configmaps.action.editYaml')} submitLabel={t('common.confirm')} pending={update.isPending}
            onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
            onSubmit={async (object) => {
              await update.mutateAsync({ namespace: dialog.detail.namespace, body: object });
              setDialog({ kind: 'none' });
            }} />
        </DialogSuspense>
      ) : null}

      <MutationAlert error={patch.error ?? update.error ?? remove.error} />
    </AiSurface>
  );
}
