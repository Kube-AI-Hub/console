import * as React from 'react';
import { Link } from '@tanstack/react-router';
import { ApiError, configMapsApi, type ConfigMapDetail, type ConfigMapInput } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiButton, AiSurface, Badge, ResourceList, type ListSchema } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { useProjectFilter, useProjectOptions } from '@/components/projects/useProjects';
import { useConfigMapListController } from './controller';
import type { ConfigMapSummary } from './queries';
import { formatTimestamp } from './format';
import { toYaml } from './yaml';
import { ConfigMapCreateDialog } from './ConfigMapCreateDialog';
import { ConfigMapDeleteDialog } from './ConfigMapDeleteDialog';
import { ConfigMapEditInfoDialog, ConfigMapEditSettingsDialog } from './ConfigMapEditDialogs';
import { DialogSuspense } from '@/components/resource/DialogSuspense';

const ConfigMapYamlDialog = React.lazy(() => import('./ConfigMapYamlDialog'));

export interface ClusterConfigMapsPageProps {
  cluster: string;
  /** Narrow the list to one project, from the `?namespace=` search parameter. */
  namespace?: string;
}

const PAGE_SIZE = 10;
const KEYS_PREVIEW_LENGTH = 50;

type Dialog =
  | { kind: 'none' }
  | { kind: 'create'; namespace: string }
  | { kind: 'delete'; names: string[]; namespace: string }
  | { kind: 'editInfo'; detail: ConfigMapDetail }
  | { kind: 'editSettings'; detail: ConfigMapDetail }
  | { kind: 'editYaml'; detail: ConfigMapDetail };

/**
 * ConfigMaps across the whole cluster, under 集群管理.
 *
 * The old console has this as a second page, not as the project one with a
 * different URL: it adds a 项目 column, creates into a chosen project, and treats
 * federated objects as read-only. Those are the three differences; everything else
 * — schema, dialogs, detail — is shared with the project page.
 *
 * What is genuinely different here is the collection. With no project chosen the
 * list reads the cluster-wide endpoint, which the server answers by walking every
 * namespace; that is expensive, so the project filter starts at "all" but the
 * reader is one click from narrowing it.
 */
export function ClusterConfigMapsPage({ cluster, namespace }: ClusterConfigMapsPageProps): React.ReactElement {
  const t = useT();
  const list = useConfigMapListController({
    scope: 'cluster',
    cluster,
    ...(namespace ? { namespace } : {}),
    pageSize: PAGE_SIZE,
  });
  const { page, setPage, keyword, setKeyword, sortBy, order, sortByKey, selected, setSelected } = list;
  const { projectFilter, setProjectFilter, query, items, total, remove, create, update, patch, loadDetail } = list;
  const [dialog, setDialog] = React.useState<Dialog>({ kind: 'none' });

  const projectFilterControl = useProjectFilter(cluster, t('configmaps.filter.projectLabel'), t('clusterConfigmaps.filter.allProjects'));
  const projectOptions = useProjectOptions(cluster);

  const mutationError = [remove.error, create.error, update.error, patch.error].find((error) => error !== null);
  const api = configMapsApi(apiClient);

  const openWithDetail = React.useCallback(
    async (kind: 'editInfo' | 'editSettings' | 'editYaml', row: { name: string; namespace: string }) => {
      const detail = await loadDetail(row);
      setDialog(detail ? { kind, detail } : { kind: 'none' });
    },
    [loadDetail],
  );

  const schema = React.useMemo<ListSchema<ConfigMapSummary>>(
    () => ({
      title: t('clusterConfigmaps.title'),
      description: t('clusterConfigmaps.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': `${row.namespace}/${row.name}` }),
      search: { placeholder: t('configmaps.searchPlaceholder'), keys: ['name'], aiId: 'cluster-configmaps:search' },
      filters: [projectFilterControl],
      selection: 'multiple',
      /*
       * A federated object is owned by the federation control plane: editing or
       * deleting it here would either be rejected upstream or be reverted on the
       * next propagation. The old console disables the checkbox and hides the row
       * actions for the same reason.
       */
      isRowSelectable: (row: ConfigMapSummary) => !row.federated,
      sortableKeys: ['name', 'createTime'],
      sortAiPrefix: 'cluster-configmaps',
      selectAiId: 'cluster-configmaps:select',
      sort: { key: sortBy, order },
      primaryAction: { key: 'create', label: t('configmaps.action.create'), aiId: 'cluster-configmaps:create' },
      actions: [
        {
          key: 'bulk-delete',
          label: t('configmaps.action.bulkDelete'),
          tone: 'danger',
          aiId: 'cluster-configmaps:bulk-delete',
          aiNeeds: ['cluster-configmaps:row-select'],
        },
      ],
      columns: [
        {
          key: 'name',
          title: t('configmaps.column.name'),
          render: (row) => (
            <span className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1.5">
                <Link
                  to="/kube-frontend/clusters/$cluster/configmaps/$name"
                  params={{ cluster, name: row.name }}
                  search={{ namespace: row.namespace }}
                  className="truncate font-medium text-ai-fg hover:text-ai-accent"
                  title={`${row.namespace}/${row.name}`}
                  {...actionProps(`cluster-configmaps:open:${row.namespace}/${row.name}`)}
                >
                  {row.alias || row.name}
                </Link>
                {row.federated ? <Badge tone="info">{t('configmaps.federated')}</Badge> : null}
              </span>
              <span className="truncate text-[11px] text-ai-fg-muted">{row.description || '-'}</span>
            </span>
          ),
        },
        {
          key: 'project',
          title: t('configmaps.column.project'),
          /*
           * A ConfigMap's name is unique only within its project, so this column is
           * what tells two otherwise identical rows apart. It stays visible on
           * every width; `hideBelow` would make the list ambiguous on a phone.
           */
          width: 150,
          render: (row) => (
            <Link
              to="/kube-frontend/clusters/$cluster/configmaps"
              params={{ cluster }}
              search={{ namespace: row.namespace }}
              className="truncate text-ai-fg-secondary hover:text-ai-accent"
              title={row.namespace}
            >
              {row.namespace}
            </Link>
          ),
        },
        {
          key: 'keys',
          title: t('configmaps.column.keys'),
          hideBelow: 'md',
          render: (row) => {
            const keys = row.keys.join(',') || '-';
            const chars = Array.from(keys);
            const clipped = chars.length > KEYS_PREVIEW_LENGTH;
            const preview = clipped ? `${chars.slice(0, KEYS_PREVIEW_LENGTH).join('')}...` : keys;
            return (
              <span className="text-ai-fg-secondary" title={clipped ? keys : undefined}>
                {preview}
              </span>
            );
          },
        },
        {
          key: 'createTime',
          title: t('configmaps.column.createdAt'),
          width: 170,
          hideBelow: 'lg',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
        },
      ],
      rowActions: [
        { key: 'editInfo', label: t('configmaps.action.editInfo'), visible: (row) => !row.federated },
        { key: 'editYaml', label: t('configmaps.action.editYaml'), visible: (row) => !row.federated },
        { key: 'editSettings', label: t('configmaps.action.editSettings'), visible: (row) => !row.federated },
        { key: 'delete', label: t('common.delete'), tone: 'danger', visible: (row) => !row.federated },
      ],
      empty: { title: t('clusterConfigmaps.empty.title'), description: t('clusterConfigmaps.empty.description') },
      labels: {
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      pagination: { page, pageSize: PAGE_SIZE, total },
    }),
    [t, sortBy, order, page, total, cluster, projectFilterControl],
  );

  const state = query.isPending ? 'loading' : query.isError ? 'error' : items.length === 0 ? 'empty' : 'ready';

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="cluster-configmaps:surface" state="error" className="min-w-0">
        <ErrorPanel error={query.error} onRetry={() => void query.refetch()} />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="cluster-configmaps:surface" state={state} className="min-w-0">
      <ResourceList
        schema={schema}
        rows={items}
        loading={state === 'loading'}
        searchValue={keyword}
        onSearchChange={setKeyword}
        filters={{ project: projectFilter }}
        onFiltersChange={(next) => {
          setProjectFilter(next['project'] ?? '');
          setPage(1);
        }}
        selectedKeys={selected}
        onSelectionChange={setSelected}
        onPageChange={setPage}
        onSortChange={(next) => {
          if (!next) return;
          sortByKey(next.key, next.order);
        }}
        onAction={(action, row) => {
          if (action === 'create') {
            /*
             * A cluster-level create has no project to inherit: the filter may be
             * "all", and even when it names one the reader is creating into the
             * cluster, not into the page they happen to be looking at. The dialog
             * asks; seeding it with the active filter is only a convenience.
             */
            return setDialog({ kind: 'create', namespace: projectFilter });
          }
          if (!row) return;
          if (action === 'delete') return setDialog({ kind: 'delete', names: [row.name], namespace: row.namespace });
          if (action === 'editInfo' || action === 'editSettings' || action === 'editYaml') {
            void openWithDetail(action, row);
          }
        }}
        onBulkAction={(action, keys) => {
          if (action !== 'bulk-delete' || !keys.length) return;
          /*
           * Bulk selection can span projects, but a delete is addressed per
           * namespace. Limit the batch to one project and point the reader at the
           * filter otherwise: silently deleting a same-named object from another
           * project is the failure mode worth preventing here.
           */
          const namespaces = new Set(items.filter((row) => keys.includes(row.name)).map((row) => row.namespace));
          const [only] = [...namespaces];
          if (namespaces.size > 1 || !only) return;
          setDialog({ kind: 'delete', names: keys, namespace: only });
        }}
      />

      {mutationError ? (
        <p role="alert" className="mt-3 text-xs text-ai-danger">
          {mutationError instanceof ApiError ? mutationError.message : t('error.unknown')}
        </p>
      ) : null}

      <ConfigMapCreateDialog
        open={dialog.kind === 'create'}
        onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
        namespace={dialog.kind === 'create' ? dialog.namespace : projectFilter}
        projects={projectOptions}
        onNamespaceChange={(next) => setDialog({ kind: 'create', namespace: next })}
        pending={create.isPending}
        isNameTaken={(name, ns) => api.checkName({ cluster, namespace: ns, name })}
        onSubmit={async (input: ConfigMapInput) => {
          await create.mutateAsync(input);
          setDialog({ kind: 'none' });
        }}
        onSubmitYaml={async (object) => {
          const metadata = (object['metadata'] ?? {}) as { name?: string; namespace?: string };
          await create.mutateAsync({
            name: String(metadata.name ?? ''),
            namespace: metadata.namespace || (dialog.kind === 'create' ? dialog.namespace : projectFilter),
            data: (object['data'] as Record<string, string> | undefined) ?? {},
          });
          setDialog({ kind: 'none' });
        }}
      />

      {dialog.kind === 'delete' ? (
        <ConfigMapDeleteDialog
          open
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          names={dialog.names}
          pending={remove.isPending}
          onConfirm={async () => {
            await remove.mutateAsync(dialog.names);
            setSelected([]);
            setDialog({ kind: 'none' });
          }}
        />
      ) : null}

      {dialog.kind === 'editInfo' ? (
        <ConfigMapEditInfoDialog
          open
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          detail={dialog.detail}
          pending={patch.isPending}
          onSubmit={async (annotations) => {
            await patch.mutateAsync({ metadata: { annotations } });
            setDialog({ kind: 'none' });
          }}
        />
      ) : null}

      {dialog.kind === 'editSettings' ? (
        <ConfigMapEditSettingsDialog
          open
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          detail={dialog.detail}
          pending={update.isPending}
          onSubmit={async (data) => {
            await update.mutateAsync({
              apiVersion: 'v1',
              kind: 'ConfigMap',
              metadata: { name: dialog.detail.name, namespace: dialog.detail.namespace },
              data,
            });
            setDialog({ kind: 'none' });
          }}
        />
      ) : null}

      {dialog.kind === 'editYaml' ? (
        <DialogSuspense>
          <ConfigMapYamlDialog
            open
            onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
            initialYaml={toYaml(dialog.detail.raw)}
            lockName={dialog.detail.name}
            title={t('configmaps.edit.yamlTitle')}
            submitLabel={t('common.confirm')}
            pending={update.isPending}
            onSubmit={async (object) => {
              await update.mutateAsync(object as never);
              setDialog({ kind: 'none' });
            }}
          />
        </DialogSuspense>
      ) : null}
    </AiSurface>
  );
}

function ErrorPanel({ error, onRetry }: { error: unknown; onRetry: () => void }): React.ReactElement {
  const t = useT();
  const apiError = error instanceof ApiError ? error : undefined;
  const message = apiError
    ? apiError.isPermission
      ? t('error.unauthorized')
      : apiError.isNotFound
        ? t('error.notFound')
        : apiError.retryable
          ? t('error.network')
          : apiError.message
    : t('error.unknown');

  return (
    <div className="flex flex-col items-center gap-3 rounded-ai-md border border-ai-line p-8 text-center" role="alert">
      <p className="text-sm font-medium text-ai-fg">{t('error.title')}</p>
      <p className="text-xs text-ai-fg-muted">{message}</p>
      {/* No retry for a permission error: pressing it again cannot succeed. */}
      {apiError?.isPermission ? null : (
        <AiButton aiId="cluster-configmaps:retry" size="sm" onClick={onRetry}>
          {t('common.retry')}
        </AiButton>
      )}
    </div>
  );
}
