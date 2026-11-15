import * as React from 'react';
import { type StorageDetail, type StorageKind, type StorageSummary } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';

import { useProjectFilter } from '@/components/projects/useProjects';
import { useResourceListState, toListParams } from '@/components/resource/useResourceListState';
import { Link } from '@tanstack/react-router';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { EditInfoDialog } from '@/components/resource/EditInfoDialog';
import { LoadingDialog } from '@/components/resource/LoadingDialog';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { YamlDialog } from '@/components/resource/YamlDialog';
import { toYaml } from '@/components/resource/yaml';
import { formatTimestamp } from '@/lib/time';
import { statusLabel } from '@/lib/status';
import {
  STORAGE_DESCRIPTORS,
  useDeleteStorage,
  useExpandableClasses,
  useExpandStorage,
  useProjectPods,
  useStorageClasses,
  useProjectSnapshots,
  useCreateStorage,
  useStorageList,
  useStorageOne,
  useUpdateStorage,
} from './queries';
import { mountsOf, withMountState } from '@kube-ai-hub/api-client';
import { ExpandVolumeDialog } from './ExpandVolumeDialog';
import { CreateVolumeDialog } from './CreateVolumeDialog';
import { api as apiClient } from '@/api';
import { storageApi } from '@kube-ai-hub/api-client';

/**
 * The storage list, shared by 存储卷 and 存储卷快照.
 *
 * Both kinds differ only in columns, so they share this page and take a descriptor
 * — the same arrangement the application workloads use, and the reason a third
 * storage kind would be a descriptor rather than another page.
 */
export interface StorageListPageProps {
  kind: StorageKind;
  workspace: string;
  cluster: string;
  namespace: string;
}

const PAGE_SIZE = 10;

type SortKey = 'name' | 'createTime';

type Dialog =
  | { kind: 'none' }
  | { kind: 'delete'; rows: StorageSummary[] }
  | { kind: 'loading'; subject: string }
  | { kind: 'editYaml'; detail?: StorageDetail; subject?: string }
  | { kind: 'editInfo'; row: StorageSummary }
  | { kind: 'expand'; row: StorageSummary }
  | { kind: 'create' };

export function StorageListPage({ kind, workspace, cluster, namespace }: StorageListPageProps): React.ReactElement {
  const t = useT();
  const descriptor = STORAGE_DESCRIPTORS[kind]!;
  const [projectFilter, setProjectFilter] = React.useState(namespace);
  React.useEffect(() => setProjectFilter(namespace), [cluster, namespace]);

  const list = useResourceListState<SortKey>({ defaultSortBy: 'createTime', resetOn: [cluster, projectFilter] });
  const query = useStorageList(kind, toListParams(list, { cluster, namespace: projectFilter }, PAGE_SIZE));
  // One pod list answers "is it mounted" for every row on the page.
  const pods = useProjectPods(kind === 'persistentvolumeclaims' ? projectFilter : '');
  const remove = useDeleteStorage(kind, { cluster, namespace: projectFilter });
  const expand = useExpandStorage({ cluster, namespace: projectFilter });
  const expandableClasses = useExpandableClasses();
  const storageClasses = useStorageClasses();
  const projectSnapshots = useProjectSnapshots({ cluster, namespace: projectFilter });
  const create = useCreateStorage(kind, { cluster, namespace: projectFilter });
  const [dialog, setDialog] = React.useState<Dialog>({ kind: 'none' });
  const [editing, setEditing] = React.useState<string | null>(null);
  const api = storageApi(apiClient, kind);

  // The edit dialog needs the full object; the list only has a summary.
  const detail = useStorageOne(kind, { cluster, namespace: projectFilter, name: editing ?? '' });
  const update = useUpdateStorage(kind, { cluster, namespace: projectFilter });

  // The mount column stays `计算中` while this is undefined rather than claiming
  // `未挂载` before the scan has run.
  const mounted = pods.data ? mountsOf(pods.data) : undefined;
  const rows = withMountState((query.data?.items ?? []) as StorageSummary[], mounted);
  const total = query.data?.total ?? 0;
  const projectFilterControl = useProjectFilter(cluster, t('storage.filter.projectLabel'), t('storage.filter.project'), undefined, 'storage:filter:project');

  React.useEffect(() => {
    if (dialog.kind === 'loading' && detail.data) setDialog({ kind: 'editYaml', detail: detail.data });
  }, [dialog.kind, detail.data]);

  React.useEffect(() => {
    if (dialog.kind === 'loading' && detail.isError) {
      setDialog({ kind: 'none' });
      setEditing(null);
    }
  }, [dialog.kind, detail.isError]);

  const schema = React.useMemo<ListSchema<StorageSummary>>(
    () => ({
      title: t(descriptor.titleKey),
      description: t(descriptor.descriptionKey),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('storage.searchPlaceholder'), aiId: `${kind}:search` },
      filters: [projectFilterControl],
      /*
       * 创建存储卷 is a claim action: a snapshot is taken from a claim (its detail page), not
       * conjured from the snapshot list. Offering it here would open a form with no source.
       */
      ...(kind === 'persistentvolumeclaims'
        ? { primaryAction: { key: 'create', label: t('storage.create.title'), aiId: 'persistentvolumeclaims:create' } }
        : {}),
      selection: 'multiple',
      sortableKeys: ['name', 'createTime'],
      sortAiPrefix: kind,
      selectAiId: `${kind}:select`,
      sort: { key: list.sortBy, order: list.order },
      actions: [
        {
          key: 'bulk-delete',
          label: t('storage.action.bulkDelete'),
          tone: 'danger',
          aiId: `${kind}:bulk-delete`,
          aiNeeds: [`${kind}:row-select`],
        },
      ],
      columns: [
        {
          key: 'name',
          title: t('storage.column.name'),
          render: (row) => (
            <span className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1.5">
                <a
                  href={`/kube-frontend/${workspace}/clusters/${cluster}/projects/${row.namespace || projectFilter}/${kind}/${row.name}`}
                  className="inline-flex min-h-6 items-center truncate font-medium text-ai-fg hover:text-ai-accent"
                  title={row.name}
                  {...actionProps(`${kind}:open:${row.name}`)}
                >
                  {row.alias || row.name}
                </a>
                {row.federated ? <Badge tone="info">{t('resource.federated')}</Badge> : null}
              </span>
              <span className="truncate text-[11px] text-ai-fg-muted">{row.storageClass || '-'}</span>
            </span>
          ),
        },
        {
          key: 'status',
          title: t('storage.column.status'),
          width: 150,
          hideBelow: 'md',
          render: (row) => <Badge tone={storageTone(row.status)}>{statusLabel(t, row.status)}</Badge>,
        },
        {
          key: 'capacity',
          title: t('storage.column.capacity'),
          width: 110,
          hideBelow: 'lg',
          render: (row) => <span className="tabular-nums text-ai-fg-secondary">{row.capacity || '-'}</span>,
        },
        // Access modes are a claim concept; a snapshot has none.
        ...(kind === 'persistentvolumeclaims'
          ? [
              {
                key: 'accessModes',
                title: t('storage.column.accessModes'),
                width: 130,
                hideBelow: 'xl' as const,
                render: (row: StorageSummary) => (
                  <span className="truncate text-ai-fg-secondary">{row.accessModes.join(', ') || '-'}</span>
                ),
              },
            ]
          : []),
        ...(kind === 'persistentvolumeclaims'
          ? [
              {
                /*
                 * 持久卷 is the binding a claim ends up with. The old console shows it as a
                 * link into the cluster's PV detail, which is where the backing volume's own
                 * fields (reclaim policy, node affinity) live.
                 */
                key: 'volume',
                title: t('storage.column.volume'),
                hideBelow: 'lg' as const,
                render: (row: StorageSummary) =>
                  row.volumeName ? (
                    <Link
                      to="/kube-frontend/clusters/$cluster/persistentvolumes/$name"
                      params={{ cluster, name: row.volumeName }}
                      className="inline-flex min-h-6 items-center text-ai-accent hover:underline"
                      data-ai-id={`persistentvolumeclaims:volume:${row.volumeName}`}
                    >
                      {row.volumeName}
                    </Link>
                  ) : (
                    <span className="text-ai-fg-muted">-</span>
                  ),
              },
            ]
          : []),
        {
          key: 'createTime',
          title: t('storage.column.createdAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
        },
        {
          key: 'mountStatus',
          title: t('storage.column.mountStatus'),
          width: 110,
          hideBelow: 'lg',
          render: (row: StorageSummary) => {
            if (row.kind !== 'persistentvolumeclaims') return <span className="text-ai-fg-muted">-</span>;
            // Three states, not two: "not known yet" is different from "not mounted",
            // and the difference matters before deleting a claim.
            // PERFORMANCE: this depends on listing every pod in the project, which takes
            // over a minute on a large project against this API. The title says so, so a
            // long wait is explained rather than looking like a stuck page.
            // The pod list failed: say so rather than sitting on 计算中 for ever.
            if (pods.isError) return <span className="text-ai-fg-muted">{t('storage.mount.unknown')}</span>;
            if (row.inUse === undefined) {
              return (
                <span className="text-ai-fg-muted" title={t('storage.mount.computingHint')}>
                  {t('storage.mount.computing')}
                </span>
              );
            }
            return row.inUse ? (
              <Badge tone="success">{t('storage.mount.mounted')}</Badge>
            ) : (
              <Badge tone="neutral">{t('storage.mount.notMounted')}</Badge>
            );
          },
        },
      ],
      // Same order as the old console: 编辑信息 before 编辑 YAML, delete last.
      // Order matches every other list: the two edit entries together, then the
      // resource-specific action, then delete last.
      rowActions: [
        { key: 'editInfo', label: t('resource.action.editInfo') },
        { key: 'editYaml', label: t('resource.action.editYaml') },
        /*
         * 扩容 is claim-only (a snapshot has no capacity to grow) and class-gated:
         * a StorageClass without `allowVolumeExpansion` makes the apiserver reject the
         * write, so the control is hidden rather than offered and failed.
         */
        ...(kind === 'persistentvolumeclaims'
          ? [
              {
                key: 'expand',
                label: t('storage.action.expand'),
                visible: (row: StorageSummary) => expandableClasses.data?.[row.storageClass] === true,
              },
            ]
          : []),
        { key: 'delete', label: t('common.delete'), tone: 'danger' as const },
      ],
      empty: { title: t(descriptor.emptyTitleKey), description: t(descriptor.emptyDescriptionKey) },
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
    [cluster, descriptor, kind, list, projectFilter, projectFilterControl, t, total, workspace],
  );

  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId={`${kind}:surface`} state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId={`${kind}:retry`} />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId={`${kind}:surface`} state={state} className="min-w-0">
      <ResourceList
        schema={schema}
        rows={rows}
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
          if (next) list.setSort(next);
        }}
        onAction={(action, row) => {
          if (action === 'create') return setDialog({ kind: 'create' });
          if (!row) return;
          if (action === 'delete') return setDialog({ kind: 'delete', rows: [row] });
          if (action === 'editInfo') return setDialog({ kind: 'editInfo', row });
          if (action === 'expand') return setDialog({ kind: 'expand', row });
          if (action === 'editYaml') {
            // Frame first, data second: the dialog is on screen while the object loads.
            setDialog({ kind: 'loading', subject: row.name });
            setEditing(row.name);
          }
        }}
        onBulkAction={(action, keys) => {
          if (action !== 'bulk-delete' || keys.length === 0) return;
          setDialog({ kind: 'delete', rows: rows.filter((row) => keys.includes(row.name)) });
        }}
      />

      <MutationAlert error={remove.error ?? update.error ?? expand.error ?? create.error} />

      {dialog.kind === 'create' ? (
        <CreateVolumeDialog
          open
          namespace={projectFilter}
          classes={storageClasses.data ?? []}
          snapshots={(projectSnapshots.data?.items ?? []).filter((row) => row.status === 'ready')}
          pending={create.isPending}
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          onSubmit={async (body) => {
            await create.mutateAsync(body);
            setDialog({ kind: 'none' });
          }}
        />
      ) : null}

      {dialog.kind === 'delete' ? (
        <DeleteDialog
          open
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          names={dialog.rows.map((row) => row.name)}
          resource={kind}
          noun={t(descriptor.titleKey)}
          pending={remove.isPending}
          onConfirm={async () => {
            await remove.mutateAsync(dialog.rows.map((row) => row.name));
            list.setSelected([]);
            setDialog({ kind: 'none' });
          }}
        />
      ) : null}

      <LoadingDialog
        open={dialog.kind === 'loading'}
        title={t('resource.action.editYaml')}
        {...(dialog.kind === 'loading' ? { subject: dialog.subject } : {})}
      />

      {dialog.kind === 'expand' ? (
        <ExpandVolumeDialog
          open
          name={dialog.row.name}
          current={dialog.row.capacity}
          pending={expand.isPending}
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          onSubmit={async (storage) => {
            await expand.mutateAsync({ name: dialog.row.name, storageClass: dialog.row.storageClass, storage });
            setDialog({ kind: 'none' });
          }}
        />
      ) : null}

      {dialog.kind === 'editInfo' ? (
        <EditInfoDialog
          open
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          resource={kind}
          name={dialog.row.name}
          alias={dialog.row.alias}
          description={dialog.row.description}
          annotations={dialog.row.annotations}
          pending={update.isPending}
          onSubmit={async (annotations) => {
            // `update()` derives the object name from `body.metadata.name` and PUTs the
            // whole object; a bare annotation patch has no name and would be sent to
            // the collection URL (405). Fetch the object and carry the edited map.
            const detail = await api.get({ cluster, namespace: projectFilter, name: dialog.row.name });
            await update.mutateAsync({ ...detail.raw, metadata: { ...detail.raw.metadata, annotations } });
            setDialog({ kind: 'none' });
          }}
        />
      ) : null}

      {dialog.kind === 'editYaml' ? (
        <YamlDialog
          open
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          initialYaml={toYaml(dialog.detail!.raw)}
          lockName={dialog.detail!.name}
          title={t('resource.action.editYaml')}
          submitLabel={t('common.confirm')}
          pending={update.isPending}
          onSubmit={async (object) => {
            await update.mutateAsync(object as never);
            setDialog({ kind: 'none' });
            setEditing(null);
          }}
        />
      ) : null}
    </AiSurface>
  );
}

/** Status → badge tone: only a bound claim and a ready snapshot are healthy. */
function storageTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  if (status === 'Bound' || status === 'Ready') return 'success';
  if (status === 'Pending' || status === 'Resizing' || status === 'FileSystemResizePending') return 'warning';
  if (status === 'Lost') return 'danger';
  return 'neutral';
}

/** Status → locale key, falling back to the raw value for the resize conditions. */


