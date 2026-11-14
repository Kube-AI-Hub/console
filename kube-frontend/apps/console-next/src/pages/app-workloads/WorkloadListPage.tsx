import * as React from 'react';
import { type WorkloadDetail, type WorkloadKind, type WorkloadSummary } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient, workloadsApi } from '@/api';
import { useProjectFilter } from '@/components/projects/useProjects';
import { useResourceListState, toListParams } from '@/components/resource/useResourceListState';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { ResourceErrorPanel, MutationAlert } from '@/components/resource/ResourceErrorPanel';
import { YamlDialog } from '@/components/resource/YamlDialog';
import { LoadingDialog } from '@/components/resource/LoadingDialog';
import { toYaml } from '@/components/resource/yaml';
import { formatTimestamp } from '@/lib/time';
import {
  useDeleteWorkload,
  useRestartWorkload,
  useScaleWorkload,
  useSetIngressRules,
  useSetServicePorts,
  useSuspendWorkload,
  useUpdateWorkload,
  useWorkloads,
  type WorkloadDescriptor,
} from './queries';
import { WorkloadCreateDialog } from './WorkloadCreateDialog';
import { ServicePortsDialog } from './ServicePortsDialog';
import { ReplicasDialog } from './ReplicasDialog';
import { IngressRulesDialog } from './IngressRulesDialog';
import { EditInfoDialog } from '@/components/resource/EditInfoDialog';

/**
 * One list page for every application workload.
 *
 * The eight kinds differ only in their columns and their row actions, so they share
 * this page and each supplies a descriptor (see `descriptors.ts`). That is not
 * premature abstraction: the second kind made it necessary — eight near-identical
 * pages would drift in status wording, empty states and agent handles, and the old
 * console paid exactly that price.
 *
 * The list itself is a schema (`ResourceList`): columns are data, so adding a kind
 * is a descriptor entry rather than another page skeleton.
 */
export interface WorkloadListPageProps {
  descriptor: WorkloadDescriptor;
  workspace: string;
  cluster: string;
  namespace: string;
}

const PAGE_SIZE = 10;

type SortKey = 'name' | 'createTime';

type Dialog =
  | { kind: 'none' }
  | { kind: 'delete'; rows: WorkloadSummary[] }
  | { kind: 'loading'; target: string; subject: string }
  | { kind: 'editYaml'; detail: WorkloadDetail }
  | { kind: 'editInfo'; row: WorkloadSummary }
  | { kind: 'stop'; row: WorkloadSummary }
  | { kind: 'start'; row: WorkloadSummary }
  | { kind: 'create' }
  | { kind: 'servicePorts'; row: WorkloadSummary }
  | { kind: 'ingressRules'; row: WorkloadSummary }
  | { kind: 'replicas'; row: WorkloadSummary }
  | { kind: 'bulk-stop'; rows: WorkloadSummary[] }
  | { kind: 'redeployConfirm'; row: WorkloadSummary };

export function WorkloadListPage({ descriptor, workspace, cluster, namespace }: WorkloadListPageProps): React.ReactElement {
  const t = useT();
  const kind: WorkloadKind = descriptor.kind;
  const [projectFilter, setProjectFilter] = React.useState(namespace);
  React.useEffect(() => setProjectFilter(namespace), [cluster, namespace]);

  const list = useResourceListState<SortKey>({ defaultSortBy: 'createTime', resetOn: [cluster, projectFilter] });
  const query = useWorkloads(kind, toListParams(list, { cluster, namespace: projectFilter }, PAGE_SIZE));
  const remove = useDeleteWorkload(kind, { cluster, namespace: projectFilter });
  const update = useUpdateWorkload(kind, { cluster, namespace: projectFilter });
  const scale = useScaleWorkload(kind, { cluster, namespace: projectFilter });
  const suspend = useSuspendWorkload(kind, { cluster, namespace: projectFilter });
  const servicePorts = useSetServicePorts(kind, { cluster, namespace: projectFilter });
  const ingressRules = useSetIngressRules(kind, { cluster, namespace: projectFilter });
  const redeploy = useRestartWorkload(kind, { cluster, namespace: projectFilter });
  const [dialog, setDialog] = React.useState<Dialog>({ kind: 'none' });

  const rows = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const api = workloadsApi(apiClient, kind);
  const projectFilterControl = useProjectFilter(cluster, t('workloads.filter.projectLabel'), t('workloads.filter.project'), undefined, 'workloads:filter:project');

  /** Opens the dialog frame first, then fills it: a silent wait reads as a dead click. */
  const openWithDetail = React.useCallback(
    async (target: string, name: string) => {
      setDialog({ kind: 'loading', target, subject: name });
      try {
        const detail = await api.get({ cluster, namespace: projectFilter, name });
        setDialog({ kind: 'editYaml', detail });
      } catch {
        setDialog({ kind: 'none' });
      }
    },
    [api, cluster, projectFilter],
  );

  const statusLabel = React.useCallback(
    (status: string): string => {
      const key = descriptor.statusKeys[status];
      return key ? t(key) : status;
    },
    [descriptor.statusKeys, t],
  );

  const schema = React.useMemo<ListSchema<WorkloadSummary>>(
    () => ({
      title: t(descriptor.titleKey),
      description: t(descriptor.descriptionKey),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('workloads.searchPlaceholder'), aiId: `${kind}:search` },
      filters: [projectFilterControl],
      selection: 'multiple',
      sortableKeys: ['name', 'createTime'],
      sortAiPrefix: kind,
      selectAiId: `${kind}:select`,
      sort: { key: list.sortBy, order: list.order },
      /*
       * 创建 is a *primary* action, not a bulk one: it belongs in the header and is
       * available regardless of selection. Bulk actions only exist once rows are
       * selected, which is why a create entry there rendered disabled on an empty list.
       */
      ...(descriptor.allowCreate
        ? { primaryAction: { key: 'create', label: t('workloads.action.create'), aiId: `${kind}:create` } }
        : {}),
      actions: [
        /*
         * 批量停止 scales every selected workload to zero. It is offered only for the
         * kinds that have replicas — the old console puts it on Deployments — because a
         * Job or a bare pod has nothing to scale.
         */
        ...(descriptor.allowScale
          ? [
              {
                key: 'bulk-stop',
                label: t('workloads.action.bulkStop'),
                aiId: `${kind}:bulk-stop`,
                aiNeeds: [`${kind}:row-select`],
              },
            ]
          : []),
        {
          key: 'bulk-delete',
          label: t('workloads.action.bulkDelete'),
          tone: 'danger',
          aiId: `${kind}:bulk-delete`,
          aiNeeds: [`${kind}:row-select`],
        },
      ],
      columns: [
        {
          key: 'name',
          title: t('workloads.column.name'),
          // Two lines like the old `Avatar`: display name (alias replaces the name)
          // and the app label under it, `-` when the workload carries none.
          render: (row) => (
            <span className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1.5">
                <a
                  // Plain link: the detail is the same folder's `$name` route, and the
                  // project layout turns a left click into a client-side transition.
                  href={`/kube-frontend/${workspace}/clusters/${cluster}/projects/${row.namespace || projectFilter}/${kind}/${row.name}`}
                  className="inline-flex min-h-6 items-center truncate font-medium text-ai-fg hover:text-ai-accent"
                  title={row.name}
                  {...actionProps(`${kind}:open:${row.name}`)}
                >
                  {row.alias || row.name}
                </a>
                {row.federated ? <Badge tone="info">{t('resource.federated')}</Badge> : null}
              </span>
              <span className="truncate text-[11px] text-ai-fg-muted">{row.app || '-'}</span>
            </span>
          ),
        },
        ...(descriptor.showStatus
          ? [
              {
                key: 'status',
                title: t('workloads.column.status'),
                width: 140,
                hideBelow: 'md' as const,
                render: (row: WorkloadSummary) => (
                  <Badge tone={statusTone(row.status)}>{statusLabel(row.status)}</Badge>
                ),
              },
            ]
          : []),
        // The ready/desired counter only exists for kinds that have replicas.
        ...(descriptor.showProgress
          ? [
              {
                key: 'ready',
                title: t('workloads.column.ready'),
                width: 110,
                hideBelow: 'lg' as const,
                render: (row: WorkloadSummary) =>
                  row.total === undefined ? (
                    <span className="text-ai-fg-muted">-</span>
                  ) : (
                    <span className="tabular-nums text-ai-fg-secondary">
                      {row.ready ?? 0}/{row.total}
                    </span>
                  ),
              },
            ]
          : []),
        // Services show their ports where other kinds show readiness: it is the field
        // an operator checks most often on that page.
        ...(kind === 'services'
          ? [
              {
                key: 'ports',
                title: t('workloads.column.ports'),
                width: 200,
                hideBelow: 'md' as const,
                render: (row: WorkloadSummary) => (
                  <span className="truncate font-mono text-[11px] text-ai-fg-secondary">
                    {row.ports.length === 0 ? '-' : row.ports.map((p) => `${p.port}→${p.targetPort}`).join(', ')}
                  </span>
                ),
              },
            ]
          : []),
        ...(kind === 'pods'
          ? [
              {
                key: 'node',
                title: t('workloads.field.node'),
                width: 160,
                hideBelow: 'lg' as const,
                render: (row: WorkloadSummary) => (
                  <span className="truncate text-ai-fg-secondary">{row.node || '-'}</span>
                ),
              },
              {
                key: 'podIP',
                title: t('workloads.field.podIP'),
                width: 140,
                hideBelow: 'xl' as const,
                render: (row: WorkloadSummary) => (
                  <span className="truncate font-mono text-[11px] text-ai-fg-muted">{row.podIP || '-'}</span>
                ),
              },
            ]
          : []),
        {
          key: 'createTime',
          title: t('workloads.column.createdAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
        },
      ],
      /*
       * Row actions follow the old console: 编辑信息 everywhere, 编辑 YAML where the
       * kind has one (a Job does not), 停止/启动 for the three controllers that own
       * replicas, 删除 last.
       */
      rowActions: [
        ...(descriptor.allowEditInfo ? [{ key: 'editInfo', label: t('resource.action.editInfo') }] : []),
        // 编辑路由规则 replaces an Ingress's host/path/backend triple.
        ...(kind === 'ingresses'
          ? [{ key: 'editRules', label: t('workloads.action.editRoute') }]
          : []),
        // 编辑服务 is port editing, which only a ClusterIP/NodePort/LoadBalancer has;
        // an ExternalName service has no ports to edit.
        ...(kind === 'services'
          ? [
              {
                key: 'servicePorts',
                label: t('workloads.action.editService'),
                visible: (row: WorkloadSummary) => row.serviceType !== 'ExternalName',
              },
            ]
          : []),
        { key: 'editYaml', label: t('resource.action.editYaml') },
        /*
         * 停止/启动 are two entries whose `visible` predicates are mutually exclusive:
         * a row action's label is static, so a single entry cannot rename itself per
         * row. Showing "stop" on an already-stopped workload is a dead control, and
         * showing both would let a user pick either for the same object.
         */
        ...(descriptor.allowScale
          ? [
              { key: 'stop', label: t('workloads.action.stop'), visible: (row: WorkloadSummary) => row.status !== 'stopped' },
              { key: 'start', label: t('workloads.action.start'), visible: (row: WorkloadSummary) => row.status === 'stopped' },
            ]
          : []),
        /*
         * 扩缩容 and 重新部署 live on the row as well as the detail page: the old
         * console puts them in the list menu, and a scale-out is usually decided while
         * scanning the list, not after opening one workload.
         */
        ...(descriptor.allowScale ? [{ key: 'scale', label: t('workloads.action.scale') }] : []),
        ...(descriptor.allowRedeploy ? [{ key: 'redeploy', label: t('workloads.action.redeploy') }] : []),
        ...(descriptor.allowSuspend ? [{ key: 'suspend-toggle', label: t('workloads.action.suspend') }] : []),
        ...(descriptor.allowDelete === false ? [] : [{ key: 'delete', label: t('common.delete'), tone: 'danger' as const }]),
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
    [
      descriptor,
      kind,
      list,
      projectFilter,
      projectFilterControl,
      statusLabel,
      t,
      total,
      workspace,
      cluster,
    ],
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
          // `primaryAction` dispatches through the same channel with no row, which is
          // how a header control reaches a page that also has row actions.
          if (action === 'create') return setDialog({ kind: 'create' });
          if (!row) return;
          if (action === 'delete') return setDialog({ kind: 'delete', rows: [row] });
          if (action === 'editYaml') void openWithDetail('editYaml', row.name);
          if (action === 'editInfo') return setDialog({ kind: 'editInfo', row });
          if (action === 'servicePorts') return setDialog({ kind: 'servicePorts', row });
          if (action === 'editRules') return setDialog({ kind: 'ingressRules', row });
          if (action === 'stop') return setDialog({ kind: 'stop', row });
          if (action === 'start') return setDialog({ kind: 'start', row });
          if (action === 'scale') return setDialog({ kind: 'replicas', row });
          if (action === 'redeploy') return setDialog({ kind: 'redeployConfirm', row });
          if (action === 'suspend-toggle') {
            const cy = row as unknown as { enabled?: boolean };
            suspend.mutate({ name: row.name, suspended: cy.enabled !== false });
          }
        }}
        onBulkAction={(action, keys) => {
          if (keys.length === 0) return;
          if (action === 'bulk-delete') {
            setDialog({ kind: 'delete', rows: rows.filter((row) => keys.includes(row.name)) });
            return;
          }
          if (action === 'bulk-stop') {
            setDialog({ kind: 'bulk-stop', rows: rows.filter((row) => keys.includes(row.name)) });
          }
        }}
      />

      <MutationAlert error={remove.error ?? update.error ?? scale.error ?? suspend.error ?? servicePorts.error ?? ingressRules.error ?? redeploy.error} />

      {dialog.kind === 'ingressRules' ? (
        <IngressRulesDialog
          open
          name={dialog.row.name}
          rules={dialog.row.rules}
          pending={ingressRules.isPending}
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          onSubmit={async (rules) => {
            await ingressRules.mutateAsync({ name: dialog.row.name, rules });
            setDialog({ kind: 'none' });
          }}
        />
      ) : null}

      {dialog.kind === 'servicePorts' ? (
        <ServicePortsDialog
          open
          name={dialog.row.name}
          ports={dialog.row.ports}
          pending={servicePorts.isPending}
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          onSubmit={async (ports) => {
            await servicePorts.mutateAsync({ name: dialog.row.name, ports });
            setDialog({ kind: 'none' });
          }}
        />
      ) : null}

      {dialog.kind === 'create' ? (
        <WorkloadCreateDialog
          kind={kind}
          cluster={cluster}
          namespace={projectFilter}
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
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
            /*
             * `update()` derives the object name from `body.metadata.name` and PUTs the
             * whole object, so a bare `{ metadata: { annotations } }` has no name and
             * the request went to the *collection* URL (405). Send the object we
             * already hold with the edited annotation map, exactly as the secret page
             * does — the row summary does not carry the raw object, so fetch it first.
             */
            const detail = await api.get({ cluster, namespace: projectFilter, name: dialog.row.name });
            await update.mutateAsync({
              ...detail.raw,
              metadata: { ...detail.raw.metadata, annotations },
            });
            setDialog({ kind: 'none' });
          }}
        />
      ) : null}

      {dialog.kind === 'start' ? (
        <DeleteDialog
          open
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          names={[dialog.row.name]}
          resource={kind}
          noun={t('workloads.action.start')}
          title={t('workloads.action.start')}
          confirmLabel={t('workloads.action.start')}
          pending={scale.isPending}
          onConfirm={async () => {
            // One replica is the smallest running state; the old console restores the
            // previous count, but the list summary does not carry it.
            await scale.mutateAsync({ name: dialog.row.name, replicas: 1 });
            setDialog({ kind: 'none' });
          }}
        />
      ) : null}

      {dialog.kind === 'bulk-stop' ? (
        <DeleteDialog
          open
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          names={dialog.rows.map((row) => row.name)}
          resource={kind}
          noun={t('workloads.action.bulkStop')}
          title={t('workloads.action.bulkStop')}
          confirmLabel={t('workloads.action.bulkStop')}
          pending={scale.isPending}
          onConfirm={async () => {
            // Sequentially: each scale is its own object, and firing twenty at once
            // turns one slow request into twenty competing ones.
            for (const row of dialog.rows) {
              await scale.mutateAsync({ name: row.name, replicas: 0 });
            }
            setDialog({ kind: 'none' });
          }}
        />
      ) : null}

      {dialog.kind === 'replicas' ? (
        <ReplicasDialog
          open
          current={dialog.row.replicas}
          pending={scale.isPending}
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          onSubmit={async (replicas) => {
            await scale.mutateAsync({ name: dialog.row.name, replicas });
            setDialog({ kind: 'none' });
          }}
        />
      ) : null}

      {dialog.kind === 'redeployConfirm' ? (
        // Reuses the delete-style confirmation: a redeploy restarts every pod, which
        // deserves the same "type the name" friction as a destructive action.
        <DeleteDialog
          open
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          names={[dialog.row.name]}
          resource={kind}
          noun={t('workloads.action.redeploy')}
          title={t('workloads.action.redeploy')}
          confirmLabel={t('workloads.action.redeploy')}
          pending={redeploy.isPending}
          onConfirm={async () => {
            await redeploy.mutateAsync(dialog.row.name);
            setDialog({ kind: 'none' });
          }}
        />
      ) : null}

      {dialog.kind === 'stop' ? (
        <DeleteDialog
          open
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          names={[dialog.row.name]}
          resource={kind}
          noun={t('workloads.action.stop')}
          title={t('workloads.action.stop')}
          confirmLabel={t('workloads.action.stop')}
          pending={scale.isPending}
          onConfirm={async () => {
            // Scale to zero keeps the object and its history; deleting would lose both.
            await scale.mutateAsync({ name: dialog.row.name, replicas: 0 });
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

      {dialog.kind === 'editYaml' ? (
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
      ) : null}

      {/* Frame-first loading: the dialog is already on screen while the object is
          fetched, so a click never looks ignored. */}
      <LoadingDialog
        open={dialog.kind === 'loading'}
        title={t('resource.action.editYaml')}
        {...(dialog.kind === 'loading' ? { subject: dialog.subject } : {})}
      />
    </AiSurface>
  );
}

/** Badge tone per status, so "stopped" is not painted like "running". */
function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  if (status === 'running') return 'success';
  if (status === 'updating' || status === 'waiting') return 'warning';
  if (status === 'terminated' || status === 'stopped') return 'neutral';
  return 'info';
}
