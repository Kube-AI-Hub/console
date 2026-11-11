import * as React from 'react';
import { Link } from '@tanstack/react-router';
import type { ServiceAccountDetail, ServiceAccountInput } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient, serviceAccountsApi } from '@/api';
import {
  ensureServiceAccountsRegistered,
  useCreateServiceAccount,
  useDeleteServiceAccounts,
  useServiceAccounts,
  useSetServiceAccountRole,
  useUpdateServiceAccount,
  type ServiceAccountSummary,
} from './queries';
import { useProjectFilter, useProjectOptions } from '@/components/projects/useProjects';
import { useResourceListState, toListParams } from '@/components/resource/useResourceListState';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { EditInfoDialog } from '@/components/resource/EditInfoDialog';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DialogSuspense } from '@/components/resource/DialogSuspense';

/*
 * The YAML editor is 188 KB gzip of CodeMirror. A list page must not pay for it
 * before a dialog opens, so it is imported on demand (DEC-CORE-KUBE_FRONTEND-04).
 */
const YamlDialog = React.lazy(() => import('@/components/resource/YamlDialog'));
import { toYaml } from '@/components/resource/yaml';
import { formatTimestamp } from '@/lib/time';
import { ServiceAccountCreateDialog } from './ServiceAccountCreateDialog';
import { ServiceAccountRoleDialog } from './ServiceAccountRoleDialog';

export interface ServiceAccountsPageProps {
  workspace: string;
  cluster: string;
  namespace: string;
}

const PAGE_SIZE = 10;

type SortKey = 'name' | 'createTime';

type Dialog =
  | { kind: 'none' }
  | { kind: 'create'; namespace: string }
  | { kind: 'delete'; names: string[] }
  | { kind: 'editInfo'; detail: ServiceAccountDetail }
  | { kind: 'role'; detail: ServiceAccountDetail }
  | { kind: 'editYaml'; detail: ServiceAccountDetail };

/**
 * ServiceAccounts list.
 *
 * Columns and row actions follow the old console
 * (`pages/projects/containers/ServiceAccounts/index.jsx`): 名称（别名替换名称，第二行
 * 描述）、角色、密钥、创建时间；行操作 编辑 → 编辑 YAML → 修改角色 → 删除. Note the first
 * two labels: this page says 编辑, not 编辑信息 — the buttons are the same, the words
 * are not, and users of the old console look for the word.
 */
export function ServiceAccountsPage({ workspace, cluster, namespace }: ServiceAccountsPageProps): React.ReactElement {
  const t = useT();
  ensureServiceAccountsRegistered();

  const projectFilterControl = useProjectFilter(
    cluster,
    t('serviceaccounts.filter.projectLabel'),
    t('serviceaccounts.filter.project'),
  );
  const projectOptions = useProjectOptions(cluster);

  const [projectFilter, setProjectFilter] = React.useState(namespace);
  React.useEffect(() => {
    setProjectFilter(namespace);
  }, [cluster, namespace]);

  const list = useResourceListState<SortKey>({ defaultSortBy: 'createTime', resetOn: [cluster, projectFilter] });
  const query = useServiceAccounts(toListParams(list, { cluster, namespace: projectFilter }, PAGE_SIZE));

  const remove = useDeleteServiceAccounts({ cluster, namespace: projectFilter });
  const create = useCreateServiceAccount({ cluster });
  const update = useUpdateServiceAccount({ cluster, namespace: projectFilter });
  // Role changes are an annotation patch, not a whole-object write: the old
  // console's role modal does the same (`store.patch(detail, data)`), and it
  // cannot clobber `secrets[]` which the API server owns.
  const setRole = useSetServiceAccountRole({ cluster, namespace: projectFilter });
  const [dialog, setDialog] = React.useState<Dialog>({ kind: 'none' });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const api = serviceAccountsApi(apiClient);
  const mutationError = [remove.error, create.error, update.error, setRole.error].find((error) => error !== null);

  const openWithDetail = React.useCallback(
    async (kind: 'editInfo' | 'role' | 'editYaml', name: string) => {
      try {
        const detail = await api.get({ cluster, namespace: projectFilter, name });
        setDialog({ kind, detail });
      } catch {
        setDialog({ kind: 'none' });
      }
    },
    [api, cluster, projectFilter],
  );

  /**
   * Secrets link target: the account's own project.
   *
   * A row's `namespace` comes from the object, which is what the link needs when
   * the list is showing "all projects".
   */
  const secretsLink = (row: ServiceAccountSummary, secret: string): string =>
    `/kube-frontend/${workspace}/clusters/${cluster}/projects/${row.namespace || projectFilter}/secrets/${secret}`;

  const schema = React.useMemo<ListSchema<ServiceAccountSummary>>(
    () => ({
      title: t('serviceaccounts.title'),
      description: t('serviceaccounts.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('serviceaccounts.searchPlaceholder'), keys: ['name'], aiId: 'serviceaccounts:search' },
      filters: [projectFilterControl],
      selection: 'multiple',
      sortableKeys: ['name', 'createTime'],
      sortAiPrefix: 'serviceaccounts',
      selectAiId: 'serviceaccounts:select',
      sort: { key: list.sortBy, order: list.order },
      primaryAction: { key: 'create', label: t('serviceaccounts.action.create'), aiId: 'serviceaccounts:create' },
      actions: [
        {
          key: 'bulk-delete',
          label: t('serviceaccounts.action.bulkDelete'),
          tone: 'danger',
          aiId: 'serviceaccounts:bulk-delete',
          aiNeeds: ['serviceaccounts:row-select'],
        },
      ],
      columns: [
        {
          key: 'name',
          title: t('serviceaccounts.column.name'),
          render: (row) => (
            <span className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1.5">
                <Link
                  to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/serviceaccounts/$name"
                  params={{ workspace, cluster, namespace: row.namespace || projectFilter, name: row.name }}
                  className="truncate font-medium text-ai-fg hover:text-ai-accent"
                  title={row.name}
                  {...actionProps(`serviceaccounts:open:${row.name}`)}
                >
                  {row.alias || row.name}
                </Link>
                {row.federated ? <Badge tone="info">{t('resource.federated')}</Badge> : null}
              </span>
              <span className="truncate text-[11px] text-ai-fg-muted">{row.description || '-'}</span>
            </span>
          ),
        },
        {
          key: 'project',
          title: t('serviceaccounts.column.project'),
          hideBelow: 'xl',
          width: 150,
          render: (row) => (
            <Link
              to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/serviceaccounts"
              params={{ workspace, cluster, namespace: row.namespace }}
              className="truncate text-ai-fg-secondary hover:text-ai-accent"
            >
              {row.namespace}
            </Link>
          ),
        },
        {
          key: 'role',
          title: t('serviceaccounts.column.role'),
          width: 180,
          hideBelow: 'lg',
          // An account without a role prints an empty cell, as the old list does:
          // "无" would read like a role that failed to load.
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.role || ''}</span>,
        },
        {
          key: 'secrets',
          title: t('serviceaccounts.column.secrets'),
          hideBelow: 'lg',
          // One link per token Secret, stacked, as the old list renders them.
          render: (row) =>
            row.secrets.length ? (
              <span className="flex min-w-0 flex-col">
                {row.secrets.map((secret) => (
                  <Link
                    key={secret}
                    to={secretsLink(row, secret)}
                    className="truncate text-ai-accent hover:underline"
                    title={secret}
                    {...actionProps(`serviceaccounts:open-secret:${secret}`)}
                  >
                    {secret}
                  </Link>
                ))}
              </span>
            ) : (
              <span className="text-ai-fg-muted">-</span>
            ),
        },
        {
          key: 'createTime',
          title: t('serviceaccounts.column.createdAt'),
          width: 170,
          hideBelow: 'md',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
        },
      ],
      rowActions: [
        { key: 'edit', label: t('serviceaccounts.action.edit') },
        { key: 'editYaml', label: t('resource.action.editYaml') },
        { key: 'role', label: t('serviceaccounts.action.changeRole') },
        { key: 'delete', label: t('common.delete'), tone: 'danger' },
      ],
      empty: { title: t('serviceaccounts.empty.title'), description: t('serviceaccounts.empty.description') },
      labels: {
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      pagination: { page: list.page, pageSize: PAGE_SIZE, total },
    }),
    [t, list, total, cluster, projectFilter, workspace, projectFilterControl],
  );

  const state = query.isPending ? 'loading' : query.isError ? 'error' : items.length === 0 ? 'empty' : 'ready';

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="serviceaccounts:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="serviceaccounts:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="serviceaccounts:surface" state={state} className="min-w-0">
      <ResourceList
        schema={schema}
        rows={items}
        loading={state === 'loading'}
        searchValue={list.keyword}
        onSearchChange={list.setKeyword}
        filters={{ project: projectFilter }}
        onFiltersChange={(next) => {
          setProjectFilter(next['project'] ?? '');
          list.setPage(1);
        }}
        selectedKeys={list.selected}
        onSelectionChange={list.setSelected}
        onPageChange={list.setPage}
        onSortChange={(next: { key: string; order: SortOrder } | undefined) => {
          if (!next) return;
          list.setSort(next);
        }}
        onAction={(action, row) => {
          if (action === 'create') return setDialog({ kind: 'create', namespace: projectFilter || namespace });
          if (!row) return;
          if (action === 'delete') return setDialog({ kind: 'delete', names: [row.name] });
          // The row action is called `edit` (the old console's word); the dialog
          // it opens is the shared "edit information" one.
          if (action === 'edit') return void openWithDetail('editInfo', row.name);
          if (action === 'role' || action === 'editYaml') void openWithDetail(action, row.name);
        }}
        onBulkAction={(action, keys) => {
          if (action === 'bulk-delete' && keys.length) setDialog({ kind: 'delete', names: keys });
        }}
      />

      <MutationAlert error={mutationError} />

      <ServiceAccountCreateDialog
        open={dialog.kind === 'create'}
        onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
        cluster={cluster}
        namespace={dialog.kind === 'create' ? dialog.namespace : projectFilter || namespace}
        projects={projectOptions}
        onNamespaceChange={(next) => setDialog({ kind: 'create', namespace: next })}
        pending={create.isPending}
        isNameTaken={(name, ns) => api.checkName({ cluster, namespace: ns, name })}
        onSubmit={async (input: ServiceAccountInput) => {
          await create.mutateAsync(input);
          setDialog({ kind: 'none' });
        }}
        onSubmitYaml={async (object) => {
          const metadata = (object['metadata'] ?? {}) as { name?: string; namespace?: string; annotations?: Record<string, string> };
          const annotations = metadata.annotations ?? {};
          await create.mutateAsync({
            name: String(metadata.name ?? ''),
            namespace: metadata.namespace || (dialog.kind === 'create' ? dialog.namespace : namespace),
            alias: annotations['kubesphere.io/alias-name'] ?? '',
            description: annotations['kubesphere.io/description'] ?? '',
            role: annotations['iam.kubesphere.io/role'] ?? '',
          });
          setDialog({ kind: 'none' });
        }}
      />

      {dialog.kind === 'delete' ? (
        <DeleteDialog
          open
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          names={dialog.names}
          resource="serviceaccounts"
          noun={t('serviceaccounts.noun')}
          pending={remove.isPending}
          onConfirm={async () => {
            await remove.mutateAsync(dialog.names);
            list.setSelected([]);
            setDialog({ kind: 'none' });
          }}
        />
      ) : null}

      {dialog.kind === 'editInfo' ? (
        <EditInfoDialog
          open
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          resource="serviceaccounts"
          name={dialog.detail.name}
          alias={dialog.detail.alias}
          description={dialog.detail.description}
          annotations={dialog.detail.annotations}
          pending={update.isPending}
          onSubmit={async (annotations) => {
            await update.mutateAsync({
              ...dialog.detail.raw,
              metadata: { ...dialog.detail.raw.metadata, name: dialog.detail.name, namespace: dialog.detail.namespace, annotations },
            });
            setDialog({ kind: 'none' });
          }}
        />
      ) : null}

      {dialog.kind === 'role' ? (
        <ServiceAccountRoleDialog
          open
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          cluster={cluster}
          namespace={dialog.detail.namespace}
          name={dialog.detail.name}
          role={dialog.detail.role}
          pending={setRole.isPending}
          onSubmit={async (role) => {
            await setRole.mutateAsync({ name: dialog.detail.name, role });
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
