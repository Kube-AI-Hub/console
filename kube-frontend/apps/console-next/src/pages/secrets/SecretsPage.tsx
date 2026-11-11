import * as React from 'react';
import { Link } from '@tanstack/react-router';
import { type SecretDetail, type SecretInput } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient, secretsApi } from '@/api';
import {
  ensureSecretsRegistered,
  useCreateSecret,
  useDeleteSecrets,
  useSecrets,
  useUpdateSecret,
  type SecretSummary,
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
import { SecretCreateDialog } from './SecretCreateDialog';
import { SecretEditSettingsDialog } from './SecretEditDialogs';
import { SECRET_TYPE_LABEL } from './secretTypes';
import { LoadingDialog } from '@/components/resource/LoadingDialog';

export interface SecretsPageProps {
  workspace: string;
  cluster: string;
  namespace: string;
}

const PAGE_SIZE = 10;

/**
 * Type label for a stored type.
 *
 * Unknown types print verbatim, as the old list does (`SECRET_TYPES[type] ?
 * t(...) : type`): a CRD operator's own type name is the most useful thing to
 * show, and inventing a label would hide what the workload expects.
 */
export function secretTypeLabel(t: ReturnType<typeof useT>, type: string): string {
  const key = SECRET_TYPE_LABEL[type];
  return key ? t(key as Parameters<typeof t>[0]) : type;
}

type SortKey = 'name' | 'createTime';

type Dialog =
  | { kind: 'none' }
  /* The object is being fetched; shown so the click has a visible answer. */
  | { kind: 'loading'; target: 'editInfo' | 'editSettings' | 'editYaml'; subject: string }
  | { kind: 'create'; namespace: string }
  | { kind: 'delete'; names: string[] }
  | { kind: 'editInfo'; detail: SecretDetail }
  | { kind: 'editSettings'; detail: SecretDetail }
  | { kind: 'createYaml' }
  | { kind: 'editYaml'; detail: SecretDetail };

/**
 * Secrets list.
 *
 * Columns and row actions follow the old console
 * (`pages/projects/containers/Secrets/index.jsx`): 名称（别名替换名称，第二行描述）、
 * 类型、字段数、创建时间；行操作 编辑信息 → 编辑 YAML → 编辑设置 → 删除。 The one
 * addition is "设为默认镜像仓库", which the old console only offers on the detail
 * page of a non-default `dockerconfigjson` Secret; it is repeated here because a
 * list is where a reader compares which registry is default.
 */
export function SecretsPage({ workspace, cluster, namespace }: SecretsPageProps): React.ReactElement {
  const t = useT();
  ensureSecretsRegistered();

  const projectFilterControl = useProjectFilter(cluster, t('secrets.filter.projectLabel'), t('secrets.filter.project'));
  // Same cached query the filter uses, so the dialog opens with options resolved.
  const projectOptions = useProjectOptions(cluster);

  /**
   * The project the route names, or "all projects".
   *
   * Defaults to the route's project because the route is a project page;
   * "all" is an explicit, expensive choice (the server walks every namespace)
   * and must not be the accidental default.
   */
  const [projectFilter, setProjectFilter] = React.useState(namespace);
  React.useEffect(() => {
    setProjectFilter(namespace);
  }, [cluster, namespace]);

  const list = useResourceListState<SortKey>({ defaultSortBy: 'createTime', resetOn: [cluster, projectFilter] });
  const query = useSecrets(toListParams(list, { cluster, namespace: projectFilter }, PAGE_SIZE));

  const remove = useDeleteSecrets({ cluster, namespace: projectFilter });
  const create = useCreateSecret({ cluster });
  const update = useUpdateSecret({ cluster, namespace: projectFilter });
  const [dialog, setDialog] = React.useState<Dialog>({ kind: 'none' });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const api = secretsApi(apiClient);

  const mutationError = [remove.error, create.error, update.error].find((error) => error !== null);

  /**
   * Fetch the full object before opening a dialog that edits it: the list carries
   * only the summary, and opening with a summary-shaped object would let a fast
   * save write `{}` over the real payload.
   */
  const openWithDetail = React.useCallback(
    async (kind: 'editInfo' | 'editSettings' | 'editYaml', name: string) => {
      setDialog({ kind: 'loading', target: kind, subject: name });
      try {
        const detail = await api.get({ cluster, namespace: projectFilter, name });
        setDialog({ kind, detail });
      } catch {
        // Failing to load should not leave a half-populated dialog open.
        setDialog({ kind: 'none' });
      }
    },
    [api, cluster, projectFilter],
  );

  const schema = React.useMemo<ListSchema<SecretSummary>>(
    () => ({
      title: t('secrets.title'),
      description: t('secrets.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('secrets.searchPlaceholder'), keys: ['name'], aiId: 'secrets:search' },
      filters: [projectFilterControl],
      selection: 'multiple',
      sortableKeys: ['name', 'createTime'],
      sortAiPrefix: 'secrets',
      selectAiId: 'secrets:select',
      sort: { key: list.sortBy, order: list.order },
      primaryAction: { key: 'create', label: t('secrets.action.create'), aiId: 'secrets:create' },
      actions: [
        {
          key: 'bulk-delete',
          label: t('secrets.action.bulkDelete'),
          tone: 'danger',
          aiId: 'secrets:bulk-delete',
          aiNeeds: ['secrets:row-select'],
        },
      ],
      columns: [
        {
          key: 'name',
          title: t('secrets.column.name'),
          // Two lines as in the old `Avatar`: display name on top (the alias
          // *replaces* the name), description below with `-` when empty.
          render: (row) => (
            <span className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1.5">
                <a
                  // See ConfigMapsPage: one route per page, so this is a plain
                  // link with the same URL shape the old console used.
                  href={`/kube-frontend/${workspace}/clusters/${cluster}/projects/${row.namespace || projectFilter}/secrets/${row.name}`}
                  className="truncate font-medium text-ai-fg hover:text-ai-accent"
                  title={row.name}
                  {...actionProps(`secrets:open:${row.name}`)}
                >
                  {row.alias || row.name}
                </a>
                {row.isDefault ? <Badge tone="info">{t('secrets.defaultBadge')}</Badge> : null}
                {row.federated ? <Badge tone="info">{t('resource.federated')}</Badge> : null}
              </span>
              <span className="truncate text-[11px] text-ai-fg-muted">{row.description || '-'}</span>
            </span>
          ),
        },
        {
          key: 'project',
          title: t('secrets.column.project'),
          hideBelow: 'xl',
          width: 150,
          render: (row) => (
            <Link
              to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/secrets"
              params={{ workspace, cluster, namespace: row.namespace }}
              className="truncate text-ai-fg-secondary hover:text-ai-accent"
            >
              {row.namespace}
            </Link>
          ),
        },
        {
          key: 'type',
          title: t('secrets.column.type'),
          hideBelow: 'lg',
          width: 180,
          render: (row) => <span className="truncate text-ai-fg-secondary">{secretTypeLabel(t, row.type)}</span>,
        },
        {
          key: 'data',
          title: t('secrets.column.fieldCount'),
          width: 100,
          hideBelow: 'md',
          render: (row) => <span className="tabular-nums text-ai-fg-secondary">{row.fieldCount}</span>,
        },
        {
          key: 'createTime',
          title: t('secrets.column.createdAt'),
          width: 170,
          hideBelow: 'lg',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
        },
      ],
      rowActions: [
        { key: 'editInfo', label: t('resource.action.editInfo') },
        { key: 'editYaml', label: t('resource.action.editYaml') },
        { key: 'editSettings', label: t('resource.action.editSettings') },
        { key: 'delete', label: t('common.delete'), tone: 'danger' },
      ],
      empty: { title: t('secrets.empty.title'), description: t('secrets.empty.description') },
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
      <AiSurface as="section" aiId="secrets:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="secrets:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="secrets:surface" state={state} className="min-w-0">
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
          // The primary action arrives without a row; check it first or Create
          // silently does nothing.
          if (action === 'create') return setDialog({ kind: 'create', namespace: projectFilter || namespace });
          if (!row) return;
          if (action === 'delete') return setDialog({ kind: 'delete', names: [row.name] });
          if (action === 'editInfo' || action === 'editSettings' || action === 'editYaml') {
            void openWithDetail(action, row.name);
          }
        }}
        onBulkAction={(action, keys) => {
          if (action === 'bulk-delete' && keys.length) setDialog({ kind: 'delete', names: keys });
        }}
      />

      <MutationAlert error={mutationError} />

      <SecretCreateDialog
        open={dialog.kind === 'create'}
        onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
        namespace={dialog.kind === 'create' ? dialog.namespace : projectFilter || namespace}
        projects={projectOptions}
        onNamespaceChange={(next) => setDialog({ kind: 'create', namespace: next })}
        pending={create.isPending}
        isNameTaken={(name, ns) => api.checkName({ cluster, namespace: ns, name })}
        onSubmit={async (input: SecretInput) => {
          await create.mutateAsync(input);
          setDialog({ kind: 'none' });
        }}
        onSubmitYaml={async (object) => {
          const metadata = (object['metadata'] ?? {}) as { name?: string; namespace?: string; annotations?: Record<string, string> };
          const annotations = metadata.annotations ?? {};
          await create.mutateAsync({
            name: String(metadata.name ?? ''),
            namespace: metadata.namespace || (dialog.kind === 'create' ? dialog.namespace : namespace),
            type: typeof object['type'] === 'string' ? object['type'] : 'Opaque',
            data: (object['data'] as Record<string, string> | undefined) ?? {},
            alias: annotations['kubesphere.io/alias-name'] ?? '',
            description: annotations['kubesphere.io/description'] ?? '',
          });
          setDialog({ kind: 'none' });
        }}
      />

      {dialog.kind === 'loading' ? (
        <LoadingDialog
          open
          title={
            dialog.target === 'editInfo'
              ? t('resource.action.editInfo')
              : dialog.target === 'editYaml'
                ? t('resource.action.editYaml')
                : t('resource.action.editSettings')
          }
          subject={dialog.subject}
          size="xl"
        />
      ) : null}

      {dialog.kind === 'delete' ? (
        <DeleteDialog
          open
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          names={dialog.names}
          resource="secrets"
          noun={t('secrets.noun')}
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
          resource="secrets"
          name={dialog.detail.name}
          alias={dialog.detail.alias}
          description={dialog.detail.description}
          annotations={dialog.detail.annotations}
          pending={update.isPending}
          onSubmit={async (annotations) => {
            await update.mutateAsync({ ...dialog.detail.raw, metadata: { ...dialog.detail.raw.metadata, name: dialog.detail.name, namespace: dialog.detail.namespace, annotations } });
            setDialog({ kind: 'none' });
          }}
        />
      ) : null}

      {dialog.kind === 'editSettings' ? (
        <SecretEditSettingsDialog
          open
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          detail={dialog.detail}
          pending={update.isPending}
          onSubmit={async ({ data, annotations }) => {
            await update.mutateAsync({
              ...dialog.detail.raw,
              metadata: { ...dialog.detail.raw.metadata, name: dialog.detail.name, namespace: dialog.detail.namespace, annotations },
              data,
            });
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
