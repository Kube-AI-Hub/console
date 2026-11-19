import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import {
  ruleGroupsApi,
  ruleGroupsWriteApi,
  type RuleGroupDetail,
  type RuleGroupSummary,
} from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { useProjectFilter } from '@/components/projects/useProjects';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { RuleGroupDialog } from './RuleGroupDialog';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { formatTimestamp } from '@/lib/time';
import { useListRefresh } from '@/components/resource/useListRefresh';
import { AlertMessagesTimeline } from './AlertMessagesTimeline';
import { alertSeverityLabel, scopeLabel } from './alertLabels';
import { useRuleGroupPermissions } from './permissions';

/**
 * 告警策略 (rule-group model).
 *
 * KubeSphere 3.3 stored policies as `alertingrules`; the current API group stores
 * them as rule groups holding Prometheus rules. The page is the same page — what a
 * reader wants is "which alerting policies exist and are any turned off" — so the
 * model is chosen by probing the API group and only the body differs.
 *
 * Reading is one page for both models; writing is deliberately narrower. The
 * platform-installed groups (`alerting.kubesphere.io/builtin: true`) are not
 * editable because a click would silently disagree with the installer at its next
 * reconcile. Project-scoped, non-builtin groups are the user's own policies, so the
 * page creates, edits (description, rule list, severity) and deletes them.
 *
 * The row's 详情 opens a **page**, not a modal: the detail answers two questions
 * (the rules, and which of them are firing), and each has its own loading/empty/
 * error state. See `RuleGroupDetailPage`.
 */
export interface RuleGroupsPageProps {
  cluster: string;
  namespace: string;
}

/** Page sizes the old console offered (`PAGESIZE_OPTION`): 10/20/50/100. */
const PAGE_SIZES = [10, 20, 50, 100] as const;
const PAGE_SIZE = 10;

/** Detail route: `scope` selects which of the three collections to read. */
const DETAIL_ROUTE = '/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/alertingrules/$name';

type SortKey = 'name' | 'ruleCount' | 'createTime';

export function RuleGroupsPage({ cluster, namespace }: RuleGroupsPageProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const routeParams = useParams({ strict: false }) as { workspace?: string };
  const workspace = routeParams.workspace ?? 'system-workspace';
  const list = useResourceListState<SortKey>({ defaultSortBy: 'name', defaultOrder: 'asc', resetOn: [cluster, namespace], defaultPageSize: PAGE_SIZE });
  const [projectFilter, setProjectFilter] = React.useState(namespace);
  React.useEffect(() => setProjectFilter(namespace), [cluster, namespace]);
  /*
   * The old console offered a 已启用/已停用 filter on this list. The merged list is
   * already fully in memory (three sources, client-side paging), so the filter runs
   * here and the pager/total follow the filtered set — it is not a per-page filter.
   */
  const [enabledFilter, setEnabledFilter] = React.useState<'' | 'true' | 'false'>('');
  React.useEffect(() => setEnabledFilter(''), [cluster, namespace]);
  const permissions = useRuleGroupPermissions({ cluster, namespace: projectFilter });

  const groups = useQuery({
    queryKey: ['rule-groups', cluster, projectFilter],
    queryFn: ({ signal }) => ruleGroupsApi(apiClient).list({ cluster, namespace: projectFilter, signal }),
  });

  const toggle = useMutation({
    mutationFn: (input: { group: RuleGroupSummary; enabled: boolean }) =>
      ruleGroupsApi(apiClient).setEnabled({
        name: input.group.name,
        scope: input.group.scope,
        ...(input.group.scope === 'project' ? { namespace: projectFilter } : {}),
        enabled: input.enabled,
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['rule-groups', cluster] }),
  });

  /* Bulk enable/disable: the old console offered it on the policy list, and toggling
   * twenty rows one by one is the kind of chore that makes people skip the action. */
  const [selectedKeys, setSelectedKeys] = React.useState<string[]>([]);
  React.useEffect(() => setSelectedKeys([]), [cluster, projectFilter, enabledFilter]);
  const [bulkResult, setBulkResult] = React.useState<{ ok: number; failed: string[] } | null>(null);
  const bulkToggle = useMutation({
    mutationFn: async (enabled: boolean) => {
      const targets = rows.filter(
        (row) => selectedKeys.includes(row.name) && row.enabled !== enabled && permissions.update[row.scope],
      );
      const failed: string[] = [];
      let ok = 0;
      for (const group of targets) {
        try {
          await ruleGroupsApi(apiClient).setEnabled({
            name: group.name,
            scope: group.scope,
            ...(group.scope === 'project' ? { namespace: projectFilter } : {}),
            enabled,
          });
          ok += 1;
        } catch {
          failed.push(group.name);
        }
      }
      return { ok, failed };
    },
    onSuccess: (result) => {
      setBulkResult(result);
      setSelectedKeys([]);
      void queryClient.invalidateQueries({ queryKey: ['rule-groups', cluster] });
    },
  });

  const [editing, setEditing] = React.useState<RuleGroupSummary | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<RuleGroupSummary | null>(null);

  const remove = useMutation({
    mutationFn: (group: RuleGroupSummary) =>
      ruleGroupsWriteApi(apiClient).remove({ scope: 'project', namespace: projectFilter, name: group.name }),
    onSuccess: () => {
      setDeleting(null);
      void queryClient.invalidateQueries({ queryKey: ['rule-groups', cluster] });
    },
  });

  /**
   * Whether a group's rules can be edited here.
   *
   * Only project-scoped, non-builtin groups. The editor edits the whole rule list, so the
   * rule count no longer matters; builtin and cluster-scoped groups are installer-owned
   * and a write to them would be reverted at the next reconcile.
   */
  const canEdit = React.useCallback(
    (group: RuleGroupSummary): boolean => group.scope === 'project' && !group.builtin,
    [],
  );

  const projectFilterControl = useProjectFilter(
    cluster,
    t('monitoring.filter.projectLabel'),
    t('monitoring.filter.project'),
    undefined,
    'alertingrules:filter:project',
  );

  const all = groups.data?.items ?? [];
  const keyword = list.search.trim().toLowerCase();
  const filtered = all.filter((group) => {
    if (keyword && !group.name.toLowerCase().includes(keyword)) return false;
    if (enabledFilter === 'true') return group.enabled;
    if (enabledFilter === 'false') return !group.enabled;
    return true;
  });
  const sorted = React.useMemo(() => {
    const rows = [...filtered];
    const direction = list.order === 'asc' ? 1 : -1;
    if (list.sortBy === 'ruleCount') return rows.sort((a, b) => (a.ruleCount - b.ruleCount) * direction);
    if (list.sortBy === 'createTime') return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt) * direction);
    return rows.sort((a, b) => a.name.localeCompare(b.name) * direction);
  }, [filtered, list.sortBy, list.order]);

  /*
   * Client-side pagination: the three sources each paginate on their own, so a
   * merged page has to be cut here or the page would show a different number of rows
   * than its own page size claims.
   */
  const total = sorted.length;
  const rows = sorted.slice((list.page - 1) * list.pageSize, list.page * list.pageSize);
  const listRefresh = useListRefresh('alertingrules', groups);

  const enableFilter = React.useMemo(
    () => ({
      key: 'enable',
      title: t('monitoring.column.ruleStatus'),
      allLabel: t('monitoring.filter.allStates'),
      options: [
        { value: 'true', label: t('monitoring.status.enabled') },
        { value: 'false', label: t('monitoring.status.disabled') },
      ],
      aiId: 'alertingrules:filter:enable',
    }),
    [t],
  );

  const schema = React.useMemo<ListSchema<RuleGroupSummary>>(
    () => ({
      title: t('monitoring.ruleGroups.title'),
      refresh: listRefresh.refresh,
      description: t('monitoring.ruleGroups.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('monitoring.searchPlaceholder'), aiId: 'alertingrules:search' },
      filters: [projectFilterControl, enableFilter],
      sortableKeys: ['name', 'ruleCount', 'createTime'],
      // Third click of the header cycle returns to the page's default order;
      // a server list must send a sort key, so "off" cannot be absent.
      sortFallback: list.sortFallback,
      sortAiPrefix: 'alertingrules',
      columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'rule-groups:columns' },
      sort: { key: list.sortBy, order: list.order },
      columns: [
        {
          key: 'name',
          title: t('monitoring.column.name'),
          /* Pinned: the row's identity, kept in place while the other columns scroll. */
          width: 220,
          pin: 'start',
          render: (row: RuleGroupSummary) => (
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-ai-fg">{row.name}</span>
              {/* Old console showed the description under the name; the scope is new
                  information, so both fit on the secondary line. */}
              <span className="truncate text-[11px] text-ai-fg-muted">
                {[scopeLabel(t, row.scope), row.description].filter(Boolean).join(' · ')}
              </span>
            </span>
          ),
        },
        {
          key: 'enabled',
          hideable: true,
          title: t('monitoring.column.ruleStatus'),
          width: 130,
          hideBelow: 'md',
          render: (row: RuleGroupSummary) => (
            <Badge tone={row.enabled ? 'success' : 'neutral'}>
              {row.enabled ? t('monitoring.status.enabled') : t('monitoring.status.disabled')}
            </Badge>
          ),
        },
        {
          key: 'ruleCount',
          hideable: true,
          title: t('monitoring.ruleGroups.ruleCount'),
          width: 110,
          hideBelow: 'lg',
          render: (row: RuleGroupSummary) => <span className="tabular-nums text-ai-fg-secondary">{row.ruleCount}</span>,
        },
        {
          key: 'type',
          hideable: true,
          title: t('monitoring.ruleGroups.type'),
          width: 110,
          hideBelow: 'lg',
          render: (row: RuleGroupSummary) => (
            <span className="text-ai-fg-secondary">
              {row.builtin ? t('monitoring.ruleGroups.builtin') : t('monitoring.ruleGroups.custom')}
            </span>
          ),
        },
        {
          key: 'createdAt',
          hideable: true,
          title: t('cluster.column.createdAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row: RuleGroupSummary) => (
            <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>
          ),
        },
      ],
      // The create entry is a namespaced write. Two gates: a project must be selected
      // (there is no namespace to write to in "all projects") and the reader must be
      // allowed to create rule groups in it.
      ...(projectFilter && permissions.create
        ? {
            primaryAction: {
              key: 'create',
              label: t('monitoring.ruleGroups.create'),
              aiId: 'monitoring-alerts:create',
            },
          }
        : {}),
      selection: 'multiple' as const,
      /* A row nobody may write to must not be checkable: selection drives a write. */
      isRowSelectable: (row: RuleGroupSummary) => Boolean(permissions.update[row.scope]),
      actions: [
        { key: 'enable', label: t('monitoring.action.enable'), aiId: 'alertingrules:bulk-enable' },
        { key: 'disable', label: t('monitoring.action.disable'), aiId: 'alertingrules:bulk-disable' },
      ],
      rowActions: [
        { key: 'detail', label: t('monitoring.action.detail'), aiId: 'monitoring-alerts:detail' },
        /*
         * Mutually exclusive entries, not one label that changes: a row action's
         * label is static, so a single entry would claim the wrong state for half
         * the rows.
         */
        {
          key: 'disable',
          label: t('monitoring.action.disable'),
          aiId: 'monitoring-alerts:disable',
          visible: (row: RuleGroupSummary) => row.enabled && permissions.update[row.scope],
        },
        {
          key: 'enable',
          label: t('monitoring.action.enable'),
          aiId: 'monitoring-alerts:enable',
          visible: (row: RuleGroupSummary) => !row.enabled && permissions.update[row.scope],
        },
        /*
         * Edit and delete appear only where they can succeed. Builtin and
         * cluster-scoped groups are installer-owned, so those rows do not offer the
         * actions at all; the editor itself edits the whole rule list, so rule count
         * is no longer a gate. The SSAR reviews add the permission dimension.
         */
        {
          key: 'edit',
          label: t('common.edit'),
          aiId: 'monitoring-alerts:edit',
          visible: (row: RuleGroupSummary) => canEdit(row) && permissions.update.project,
        },
        {
          key: 'delete',
          label: t('common.delete'),
          aiId: 'monitoring-alerts:delete',
          tone: 'danger' as const,
          visible: (row: RuleGroupSummary) => canEdit(row) && permissions.deleteProject,
        },
      ],
      empty: {
        title: t('monitoring.ruleGroups.emptyTitle'),
        description: t('monitoring.ruleGroups.emptyDescription'),
      },
      labels: {
        ...listRefresh.emptyLabels, ...listRefresh.filterLabels,
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      pagination: { page: list.page, pageSize: list.pageSize, pageSizeOptions: [...PAGE_SIZES], total },
    }),
    [canEdit, enableFilter, enabledFilter, groups.isFetching, list, permissions, projectFilter, projectFilterControl, t, total],
  );

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('rule-groups', columnKeys);

  const state = groups.isPending ? 'loading' : groups.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="alertingrules:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={groups.error} onRetry={() => void groups.refetch()} retryAiId="alertingrules:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="alertingrules:surface" state={state} className="min-w-0">
      {bulkResult ? (
        <p
          className={bulkResult.failed.length ? 'mb-2 text-xs text-ai-danger' : 'mb-2 text-xs text-ai-fg-secondary'}
          data-ai-id="alertingrules:bulk-result"
        >
          {bulkResult.failed.length
            ? t('monitoring.ruleGroups.bulkPartial', { ok: bulkResult.ok, failed: bulkResult.failed.join(', ') })
            : t('monitoring.ruleGroups.bulkDone', { ok: bulkResult.ok })}
        </p>
      ) : null}
      {projectFilter && !permissions.create ? (
        <p className="mb-2 text-xs text-ai-fg-muted" data-ai-id="alertingrules:no-create-permission">
          {t('monitoring.ruleGroups.permission.createDenied')}
        </p>
      ) : null}
      <ResourceList
        {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
        onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys}
        schema={schema}
        onRefresh={listRefresh.onRefresh}
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        onBulkAction={(action) => {
          if (action === 'enable' || action === 'disable') {
            setBulkResult(null);
            bulkToggle.mutate(action === 'enable');
          }
        }}
        rows={rows}
        loading={state === 'loading'}

        // Rows stay while a refetch runs, dimmed, so the reader keeps their place
        // and the refresh button's spinner has something to explain.
        refreshing={listRefresh.refreshing}
        searchValue={list.keyword}
        onSearchChange={list.setKeyword}
        filters={{ project: projectFilter, enable: enabledFilter }}
        onFiltersChange={(next) => {
          setProjectFilter(next['project'] ?? '');
          setEnabledFilter(next['enable'] === 'true' || next['enable'] === 'false' ? next['enable'] : '');
          list.setPage(1);
        }}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        onSortChange={(next: { key: string; order: SortOrder }) => {
          if (next) list.setSort(next);
        }}
        onAction={(action, row) => {
          // The primary action arrives without a row: it belongs to the page, not to a
          // record, so it is handled before the per-row guard.
          if (action === 'create') {
            setCreating(true);
            return;
          }
          if (!row) return;
          if (action === 'detail') {
            /*
             * The detail route needs a namespace even for a global group (the URL is
             * project-scoped). "All projects" shows only global/cluster groups, and the
             * filter is cleared, so fall back to the project the URL already names.
             */
            void navigate({
              to: DETAIL_ROUTE,
              params: { workspace, cluster, namespace: projectFilter || namespace, name: row.name },
              search: { scope: row.scope },
            });
            return;
          }
          if (action === 'edit') setEditing(row);
          if (action === 'delete') setDeleting(row);
          if (action === 'enable' || action === 'disable') {
            toggle.mutate({ group: row, enabled: action === 'enable' });
          }
        }}
      />

      <MutationAlert error={toggle.error ?? remove.error ?? bulkToggle.error} />

      <RuleGroupDialog
        open={creating || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
        cluster={cluster}
        scope="project"
        namespace={projectFilter}
        {...(editing ? { group: editing } : {})}
      />

      {deleting ? (
        <DeleteDialog
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          names={[deleting.name]}
          resource="alertingrules"
          noun={t('monitoring.ruleGroups.title')}
          pending={remove.isPending}
          onConfirm={async () => {
            await remove.mutateAsync(deleting);
          }}
        />
      ) : null}
    </AiSurface>
  );
}

/**
 * One group's rules and its alert messages.
 *
 * Shared with the cluster-scope pages: they open a modal and pass the detail they
 * already fetched, and the same alert filter applies there (a global group's alerts
 * are in `globalalerts`, a cluster group's in `clusteralerts`). `namespace` is only
 * needed for project groups; the cluster pages omit it.
 *
 * The expression is shown in full rather than truncated: it is the thing a reader
 * opens this panel to read, and a PromQL expression cut at 80 characters usually
 * loses exactly the condition that matters.
 */
export function RuleGroupBody({ detail, namespace }: { detail: RuleGroupDetail; namespace?: string }): React.ReactElement {
  const t = useT();
  return (
    <div className="flex flex-col gap-4" data-ai-id="alertingrules:detail">
      <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-[minmax(6rem,auto)_1fr]">
        <DefinitionRow label={t('monitoring.field.name')} value={detail.name} />
        <DefinitionRow
          label={t('monitoring.ruleGroups.field.description')}
          value={detail.description || t('monitoring.ruleGroups.noDescription')}
        />
        <DefinitionRow
          label={t('monitoring.column.ruleStatus')}
          value={detail.enabled ? t('monitoring.status.enabled') : t('monitoring.status.disabled')}
        />
        <DefinitionRow label={t('monitoring.ruleGroups.type')} value={detail.builtin ? t('monitoring.ruleGroups.builtin') : t('monitoring.ruleGroups.custom')} />
        <DefinitionRow label={t('monitoring.ruleGroups.ruleCount')} value={String(detail.ruleCount)} />
      </dl>

      {detail.rules.length === 0 ? (
        <p className="text-xs text-ai-fg-muted" {...actionProps('alertingrules:detail:no-rules')}>
          {t('monitoring.ruleGroups.rule.noRules')}
        </p>
      ) : (
        <div className="flex flex-col gap-2" {...actionProps('alertingrules:detail:rules')}>
          <h3 className="text-sm font-medium text-ai-fg">
            {t('monitoring.ruleGroups.rules')} ({detail.rules.length})
          </h3>
          {/* Same fixed layout as the project detail page: the expression must wrap, not
              push the modal content past its own edge. */}
          <table className="w-full table-fixed border-collapse text-xs" data-ai-id="alertingrules:detail:rule-table">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[56%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-ai-line text-ai-fg-muted">
                <th scope="col" className="px-2 py-2 text-left font-medium">{t('monitoring.ruleGroups.rule.name')}</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">{t('monitoring.ruleGroups.rule.severity')}</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">{t('monitoring.ruleGroups.rule.duration')}</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">{t('monitoring.ruleGroups.rule.summary')}</th>
              </tr>
            </thead>
            <tbody>
              {detail.rules.map((rule) => (
                <tr key={rule.name} className="border-b border-ai-line align-top" data-ai-row={rule.name}>
                  <td className="break-all px-2 py-2 font-medium text-ai-fg">{rule.name}</td>
                  <td className="px-2 py-2 text-ai-fg-secondary">{rule.severity ? alertSeverityLabel(t, rule.severity) : '-'}</td>
                  <td className="px-2 py-2 tabular-nums text-ai-fg-secondary">{rule.duration || '-'}</td>
                  <td className="min-w-0 px-2 py-2 text-ai-fg-secondary">
                    <span className="block break-words">{rule.summary || rule.description || '-'}</span>
                    {rule.message ? <span className="mt-1 block break-words text-ai-fg-muted">{rule.message}</span> : null}
                    {rule.expression ? (
                      <code className="mt-1 block whitespace-pre-wrap break-all font-mono text-[11px] text-ai-fg-muted">{rule.expression}</code>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertMessagesTimeline
        scope={detail.scope}
        {...(detail.scope === 'project' && namespace ? { namespace } : {})}
        ruleGroup={detail.name}
      />
    </div>
  );
}
