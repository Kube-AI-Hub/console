import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  ruleGroupsApi,
  ruleGroupsWriteApi,
  type RuleGroupRuntimeStatus,
  type RuleGroupSummary,
} from '@kube-ai-hub/api-client';
import {
  AiSurface,
  Badge,
  Button,
  Modal,
  ResourceList,
  Skeleton,
  Tabs,
  TabsContent,
  type ListSchema,
  type SortOrder,
} from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { MutationAlert, ResourceErrorPanel, errorMessage } from '@/components/resource/ResourceErrorPanel';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { DialogSuspense } from '@/components/resource/DialogSuspense';
import { toYaml } from '@/components/resource/yaml';
import { formatTimestamp } from '@/lib/time';
import { useListRefresh } from '@/components/resource/useListRefresh';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { RuleGroupDialog } from '@/pages/monitoring/RuleGroupDialog';
import { useRuleGroupPermissions } from '@/pages/monitoring/permissions';
import { ruleStateTone } from '@/pages/monitoring/alertLabels';

/*
 * The YAML editor is 188 KB gzip of CodeMirror; a list page must not pay for it before
 * a dialog opens (DEC-CORE-KUBE_FRONTEND-04).
 */
const LazyYamlDialog = React.lazy(async () => {
  const module = await import('@/components/resource/YamlDialog');
  return { default: module.YamlDialog };
});

/**
 * 告警策略（集群作用域）.
 *
 * Two tabs, matching the two collections the API serves and the old console's split:
 * **自定义策略** are `clusterrulegroups` (cluster-wide policies an operator creates),
 * **内置策略** are `globalrulegroups`, installed by the platform. They are presented as
 * tabs rather than one merged list because ownership is the question here — "can I
 * change this policy" — while the project page's merged list answers "what policies does
 * this project have".
 *
 * Reading goes through the **aggregated kapis** path, which is the only one that carries
 * each group's runtime status (rule states, evaluation time, last evaluation). The raw
 * CRD path returns the same objects with no status at all; a page that read it would show
 * every policy as "0 firing", which is a claim the API never made.
 *
 * Writing is ownership-gated. Custom cluster groups are the operator's own policies: the
 * page creates, edits (info + rules), edits YAML, enables/disables, bulk-toggles and
 * deletes them. Global groups are installer-owned: enable/disable writes the same
 * `alerting.kubesphere.io/enable` label the old console patched, reset restores the
 * installer's initial configuration, and edit/delete are not offered because the next
 * reconcile would undo them.
 */
export interface ClusterAlertingPoliciesPageProps {
  cluster: string;
}

type Tab = 'custom' | 'builtin';
type SortKey = 'name' | 'createTime';
type RuleStateKey = 'firing' | 'pending' | 'inactive' | 'disabled';

/** Page sizes the old console offered: 10/20/50/100. */
const PAGE_SIZES = [10, 20, 50, 100] as const;

/** Rule states the old list counted, in its display order: 未触发/验证中/已触发/已禁用. */
const RULE_STATES: RuleStateKey[] = ['inactive', 'pending', 'firing', 'disabled'];

const RULE_STATE_LOCALE = {
  inactive: 'monitoring.ruleGroupState.inactive',
  pending: 'monitoring.ruleGroupState.pending',
  firing: 'monitoring.ruleGroupState.firing',
  disabled: 'monitoring.ruleGroupState.disabled',
} as const;

/**
 * Seconds → the old console's "0.002 秒" number.
 *
 * Exported for the unit test: the distinction that matters is zero (a real
 * measurement) versus missing (unknown) — the UI must not render "0.000" for a status
 * the API never reported.
 */
export function formatEvaluationTime(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '-';
  return value.toFixed(3);
}

function displayName(group: RuleGroupSummary): string {
  return group.alias || group.name;
}

/** One rule-state badge with its count; only states the API reported get a badge. */
export function RuleStateCell({ status }: { status: RuleGroupRuntimeStatus | undefined }): React.ReactElement {
  const t = useT();
  if (!status) {
    // The API did not report status (or the read path does not enrich it): unknown, not zero.
    return <span className="text-ai-fg-muted" data-ai-id="cluster-alerting-policies:no-status">-</span>;
  }
  const present = RULE_STATES.filter((state) => status.stats[state] !== undefined);
  if (present.length === 0) {
    return <span className="text-ai-fg-muted" data-ai-id="cluster-alerting-policies:no-status">-</span>;
  }
  return (
    <span className="flex flex-wrap gap-1" data-ai-id="cluster-alerting-policies:rule-state">
      {present.map((state) => {
        const count = status.stats[state] ?? 0;
        const tone = count > 0 ? ruleStateTone(state) : 'neutral';
        return (
          <Badge key={state} tone={tone}>
            {t(RULE_STATE_LOCALE[state])} {count}
          </Badge>
        );
      })}
    </span>
  );
}

export function ClusterAlertingPoliciesPage({ cluster }: ClusterAlertingPoliciesPageProps): React.ReactElement {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  /*
   * Default 50: the built-in collection is 18 policies on this deployment, and the
   * page's own AC counts the tab's rows against the collection. A 10-row default
   * would show half of them; 10/20/50/100 remain selectable. (The old console
   * defaulted to 10; the delivered AC here chose 50, and this page keeps that.)
   */
  const list = useResourceListState<SortKey>({ defaultSortBy: 'createTime', defaultOrder: 'desc', defaultPageSize: 50, resetOn: [cluster] });
  const permissions = useRuleGroupPermissions({ cluster, namespace: '' });

  const [tab, setTab] = React.useState<Tab>('custom');
  const [filters, setFilters] = React.useState<Record<string, string>>({});
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<RuleGroupSummary | null>(null);
  const [deleting, setDeleting] = React.useState<RuleGroupSummary | null>(null);
  const [resetting, setResetting] = React.useState<RuleGroupSummary | null>(null);
  const [resetDone, setResetDone] = React.useState('');
  const [resetError, setResetError] = React.useState('');
  const [yamlTarget, setYamlTarget] = React.useState<RuleGroupSummary | null>(null);
  const [yamlError, setYamlError] = React.useState('');
  const [disabling, setDisabling] = React.useState<RuleGroupSummary[] | null>(null);
  const [disableError, setDisableError] = React.useState('');
  const [bulkResult, setBulkResult] = React.useState<{ ok: number; failed: string[] } | null>(null);
  const [selectedKeys, setSelectedKeys] = React.useState<string[]>([]);

  React.useEffect(() => {
    setTab('custom');
    setFilters({});
    setSelectedKeys([]);
    setBulkResult(null);
    setResetDone('');
  }, [cluster]);

  const custom = useQuery({
    queryKey: ['cluster-rule-groups', cluster, 'custom'],
    queryFn: ({ signal }) => ruleGroupsApi(apiClient).listScope({ scope: 'cluster', cluster, withStatus: true, signal }),
  });
  const builtin = useQuery({
    queryKey: ['cluster-rule-groups', cluster, 'builtin'],
    queryFn: ({ signal }) => ruleGroupsApi(apiClient).listScope({ scope: 'global', cluster, withStatus: true, signal }),
  });

  const active = tab === 'custom' ? custom : builtin;
  const allRows = active.data?.items ?? [];

  /*
   * Filtering, sorting and paging are local because the collection is fetched whole for
   * its status, and the rule-state filter is not a server parameter (probed: kapis ignores
   * `state`). The page-size control still drives the page: only the rows of the current
   * page render, so the table behaves like every other list.
   */
  const needle = list.search.trim().toLowerCase();
  const enableFilter = filters['enable'] ?? '';
  const ruleStateFilter = (filters['ruleState'] ?? '') as RuleStateKey | '';
  const rows = React.useMemo(() => {
    let filtered = allRows;
    if (needle) {
      filtered = filtered.filter((row) =>
        [row.name, row.alias, row.description].some((value) => value && value.toLowerCase().includes(needle)),
      );
    }
    if (enableFilter === 'true' || enableFilter === 'false') {
      filtered = filtered.filter((row) => row.enabled === (enableFilter === 'true'));
    }
    if (ruleStateFilter) {
      filtered = filtered.filter((row) => (row.status?.stats[ruleStateFilter] ?? 0) > 0);
    }
    const direction = list.order === 'asc' ? 1 : -1;
    const sorted = [...filtered];
    if (list.sortBy === 'createTime') sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt) * direction);
    else sorted.sort((a, b) => displayName(a).localeCompare(displayName(b)) * direction);
    return sorted;
  }, [allRows, enableFilter, list.order, list.sortBy, needle, ruleStateFilter]);

  const pageRows = rows.slice((list.page - 1) * list.pageSize, list.page * list.pageSize);

  /*
   * A filter or search can shrink the result below the current page. Land on the last
   * page instead of rendering an empty table that looks like "no policies".
   */
  React.useEffect(() => {
    const pages = Math.max(1, Math.ceil(rows.length / list.pageSize));
    if (list.page > pages) list.setPage(pages);
  }, [list.page, list.pageSize, rows.length, list.setPage]);

  const yamlQuery = useQuery({
    enabled: yamlTarget !== null,
    queryKey: ['rule-group-detail', cluster, 'cluster', yamlTarget?.name],
    queryFn: ({ signal }) => ruleGroupsApi(apiClient).get({ name: yamlTarget?.name ?? '', scope: 'cluster', signal }),
  });

  const toggle = useMutation({
    mutationFn: (input: { group: RuleGroupSummary; enabled: boolean }) =>
      ruleGroupsApi(apiClient).setEnabled({
        name: input.group.name,
        scope: input.group.scope,
        ...(input.group.scope === 'project' ? { namespace: '' } : {}),
        enabled: input.enabled,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cluster-rule-groups', cluster] });
      void queryClient.invalidateQueries({ queryKey: ['rule-group-detail', cluster] });
    },
  });

  const disable = useMutation({
    mutationFn: async (groups: RuleGroupSummary[]) => {
      const failed: string[] = [];
      let ok = 0;
      for (const group of groups) {
        try {
          await ruleGroupsApi(apiClient).setEnabled({ name: group.name, scope: group.scope, enabled: false });
          ok += 1;
        } catch {
          failed.push(group.name);
        }
      }
      return { ok, failed };
    },
    onSuccess: (result) => {
      setBulkResult(result.failed.length > 0 ? result : null);
      setDisabling(null);
      setDisableError('');
      void queryClient.invalidateQueries({ queryKey: ['cluster-rule-groups', cluster] });
      void queryClient.invalidateQueries({ queryKey: ['rule-group-detail', cluster] });
    },
    onError: (error) => setDisableError(errorMessage(t, error)),
  });

  /*
   * Selection drives writes, so it is cleared whenever the visible set changes:
   * acting on a row that is no longer on screen is how a bulk action hits the wrong
   * policy.
   */
  const visibleKey = JSON.stringify([
    tab,
    list.page,
    list.pageSize,
    list.search,
    list.sortBy,
    list.order,
    filters['enable'] ?? '',
    filters['ruleState'] ?? '',
  ]);
  React.useEffect(() => setSelectedKeys([]), [visibleKey]);

  const bulkEnable = useMutation({
    mutationFn: async (groups: RuleGroupSummary[]) => {
      const failed: string[] = [];
      let ok = 0;
      for (const group of groups) {
        try {
          await ruleGroupsApi(apiClient).setEnabled({ name: group.name, scope: group.scope, enabled: true });
          ok += 1;
        } catch {
          failed.push(group.name);
        }
      }
      return { ok, failed };
    },
    onSuccess: (result) => {
      setBulkResult(result);
      void queryClient.invalidateQueries({ queryKey: ['cluster-rule-groups', cluster] });
    },
  });

  const reset = useMutation({
    mutationFn: (group: RuleGroupSummary) =>
      ruleGroupsApi(apiClient).resetToInitial({ name: group.name, scope: group.scope }),
    onSuccess: (_data, group) => {
      void queryClient.invalidateQueries({ queryKey: ['cluster-rule-groups', cluster] });
      void queryClient.invalidateQueries({ queryKey: ['rule-group-detail', cluster] });
      setResetting(null);
      setResetDone(group.name);
    },
    onError: (error) => setResetError(errorMessage(t, error)),
  });

  const remove = useMutation({
    mutationFn: (group: RuleGroupSummary) =>
      ruleGroupsWriteApi(apiClient).remove({ scope: 'cluster', name: group.name }),
    onSuccess: () => {
      setDeleting(null);
      void queryClient.invalidateQueries({ queryKey: ['cluster-rule-groups', cluster] });
    },
  });

  const replaceYaml = useMutation({
    mutationFn: async (input: { group: RuleGroupSummary; object: Record<string, unknown> }) =>
      ruleGroupsWriteApi(apiClient).replace({
        scope: 'cluster',
        name: input.group.name,
        // A YAML editor opened from the aggregated read may carry the injected status;
        // the CRD has no status subresource, so writing it back would be rejected.
        object: (() => {
          const object = { ...input.object } as Record<string, unknown>;
          delete object['status'];
          return object;
        })(),
      }),
    onSuccess: () => {
      setYamlTarget(null);
      setYamlError('');
      void queryClient.invalidateQueries({ queryKey: ['cluster-rule-groups', cluster] });
      void queryClient.invalidateQueries({ queryKey: ['rule-group-detail', cluster] });
    },
    onError: (error) => setYamlError(errorMessage(t, error)),
  });

  const refreshing = custom.isFetching || builtin.isFetching;
  const refetchAll = React.useCallback(() => {
    void custom.refetch();
    void builtin.refetch();
  }, [builtin, custom]);
  const listRefresh = useListRefresh('cluster-alerting-policies', { isFetching: refreshing, refetch: refetchAll });

  const canEdit = (row: RuleGroupSummary): boolean => row.scope === 'cluster' && !row.builtin && permissions.update.cluster;
  const canDelete = (row: RuleGroupSummary): boolean => row.scope === 'cluster' && !row.builtin && permissions.deleteCluster;

  const schema: ListSchema<RuleGroupSummary> = React.useMemo(
    () => ({
      rowKey: 'name',
      refresh: listRefresh.refresh,
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('monitoring.ruleGroups.searchPlaceholder'), aiId: 'cluster-alerting-policies:search' },
      filters: [
        {
          key: 'enable',
          title: t('monitoring.ruleGroups.filter.enable'),
          allLabel: t('monitoring.ruleGroups.filter.all'),
          aiId: 'cluster-alerting-policies:filter:enable',
          options: [
            { value: 'true', label: t('monitoring.status.enabled') },
            { value: 'false', label: t('monitoring.status.disabled') },
          ],
        },
        {
          key: 'ruleState',
          title: t('monitoring.ruleGroups.filter.ruleState'),
          allLabel: t('monitoring.ruleGroups.filter.all'),
          aiId: 'cluster-alerting-policies:filter:rule-state',
          options: RULE_STATES.map((state) => ({ value: state, label: t(RULE_STATE_LOCALE[state]) })),
        },
      ],
      sortableKeys: ['name', 'createTime'],
      sortAiPrefix: 'cluster-alerting-policies',
      sort: { key: list.sortBy, order: list.order },
      columnVisibility: {
        label: t('node.list.columns'),
        resetLabel: t('node.list.resetColumns'),
        aiId: 'cluster-alerting-policies:columns',
      },
      columns: [
        {
          key: 'name',
          title: t('monitoring.column.name'),
          width: 240,
          render: (row) => (
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-ai-fg">{displayName(row)}</span>
              {row.alias ? <span className="truncate text-[11px] text-ai-fg-muted">{row.name}</span> : null}
              <span className="truncate text-[11px] text-ai-fg-muted">{row.description || '-'}</span>
            </span>
          ),
        },
        {
          key: 'enabled',
          hideable: true,
          title: t('monitoring.column.ruleStatus'),
          width: 120,
          hideBelow: 'md',
          render: (row) => (
            <Badge tone={row.enabled ? 'success' : 'neutral'}>
              {row.enabled ? t('monitoring.status.enabled') : t('monitoring.status.disabled')}
            </Badge>
          ),
        },
        {
          key: 'ruleState',
          hideable: true,
          title: t('monitoring.column.ruleState'),
          width: 230,
          render: (row) => <RuleStateCell status={row.status} />,
        },
        {
          key: 'evaluationTime',
          hideable: true,
          title: t('monitoring.ruleGroups.evaluationTime'),
          width: 100,
          hideBelow: 'lg',
          render: (row) => {
            const value = formatEvaluationTime(row.status?.evaluationTime);
            return (
              <span className="tabular-nums text-ai-fg-secondary" data-ai-id={`cluster-alerting-policies:time:${row.name}`}>
                {value === '-' ? value : `${value} ${t('monitoring.ruleGroups.seconds')}`}
              </span>
            );
          },
        },
        {
          key: 'lastEvaluation',
          hideable: true,
          title: t('monitoring.ruleGroups.lastEvaluation'),
          width: 170,
          hideBelow: 'xl',
          render: (row) => (
            <span className="whitespace-nowrap tabular-nums text-ai-fg-muted">
              {row.status?.lastEvaluation ? formatTimestamp(row.status.lastEvaluation) : '-'}
            </span>
          ),
        },
        {
          key: 'ruleCount',
          hideable: true,
          title: t('monitoring.ruleGroups.ruleCount'),
          width: 90,
          hideBelow: 'lg',
          render: (row) => <span className="tabular-nums text-ai-fg-secondary">{row.ruleCount}</span>,
        },
        {
          key: 'createdAt',
          hideable: true,
          title: t('cluster.column.createdAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row) => <span className="whitespace-nowrap tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
        },
      ],
      ...(tab === 'custom' && permissions.createCluster
        ? {
            primaryAction: {
              key: 'create',
              label: t('monitoring.ruleGroups.create'),
              aiId: 'cluster-alerting-policies:create',
            },
          }
        : {}),
      selection: 'multiple' as const,
      isRowSelectable: (row) => Boolean(permissions.update[row.scope]),
      actions: [
        { key: 'enable', label: t('monitoring.action.enable'), aiId: 'cluster-alerting-policies:bulk-enable' },
        { key: 'disable', label: t('monitoring.action.disable'), aiId: 'cluster-alerting-policies:bulk-disable' },
      ],
      rowActions: [
        { key: 'detail', label: t('monitoring.action.detail'), aiId: 'cluster-alerting-policies:detail' },
        /*
         * Mutually exclusive entries, not one label that changes: a row action's label is
         * static, so a single entry would claim the wrong state for half the rows.
         */
        {
          key: 'disable',
          label: t('monitoring.action.disable'),
          aiId: 'cluster-alerting-policies:disable',
          visible: (row) => row.enabled && permissions.update[row.scope],
        },
        {
          key: 'enable',
          label: t('monitoring.action.enable'),
          aiId: 'cluster-alerting-policies:enable',
          visible: (row) => !row.enabled && permissions.update[row.scope],
        },
        { key: 'edit', label: t('common.edit'), aiId: 'cluster-alerting-policies:edit', visible: (row) => canEdit(row) },
        { key: 'yaml', label: t('resource.action.editYaml'), aiId: 'cluster-alerting-policies:yaml', visible: (row) => canEdit(row) },
        {
          key: 'reset',
          label: t('cluster.alerting.policies.reset'),
          aiId: 'cluster-alerting-policies:reset',
          visible: (row) => row.builtin && row.resettable,
        },
        {
          key: 'delete',
          label: t('common.delete'),
          aiId: 'cluster-alerting-policies:delete',
          tone: 'danger' as const,
          visible: (row) => canDelete(row),
        },
      ],
      empty: {
        title: t('cluster.alerting.policies.emptyTitle'),
        description: t('cluster.alerting.policies.emptyDescription'),
      },
      labels: {
        ...listRefresh.emptyLabels,
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
        range: (from, to, all) => t('table.range', { from, to, total: all }),
      },
      pagination: { page: list.page, pageSize: list.pageSize, pageSizeOptions: [...PAGE_SIZES], total: rows.length },
    }),
    [
      canDelete,
      canEdit,
      list.page,
      list.pageSize,
      list.sortBy,
      list.order,
      listRefresh,
      permissions,
      rows.length,
      t,
      tab,
    ],
  );

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('cluster-alerting-policies', columnKeys);

  const state = active.isPending ? 'loading' : active.isError ? 'error' : pageRows.length === 0 ? 'empty' : 'ready';

  const onAction = (action: string, row?: RuleGroupSummary): void => {
    if (action === 'create') {
      setCreating(true);
      return;
    }
    if (!row) return;
    if (action === 'detail') {
      void navigate({
        to: '/kube-frontend/clusters/$cluster/alerting-policies/$name',
        params: { cluster, name: row.name },
        search: { scope: row.scope === 'global' ? 'global' : 'cluster' },
      });
      return;
    }
    if (action === 'enable') toggle.mutate({ group: row, enabled: true });
    if (action === 'disable') {
      setDisableError('');
      setDisabling([row]);
    }
    if (action === 'edit') setEditing(row);
    if (action === 'yaml') {
      setYamlError('');
      setYamlTarget(row);
    }
    if (action === 'delete') setDeleting(row);
    if (action === 'reset') {
      setResetDone('');
      setResetError('');
      setResetting(row);
    }
  };

  if (active.isError) {
    return (
      <AiSurface as="section" aiId="cluster-alerting-policies:surface" state="error" className="min-w-0">
        <ResourceErrorPanel
          error={active.error}
          onRetry={() => void active.refetch()}
          retryAiId="cluster-alerting-policies:retry"
        />
      </AiSurface>
    );
  }

  const tabs = [
    {
      value: 'custom',
      label: t('cluster.alerting.tab.custom'),
      aiId: 'cluster-alerting-policies:tab:custom',
      ...(custom.data ? { count: custom.data.total } : {}),
    },
    {
      value: 'builtin',
      label: t('cluster.alerting.tab.builtin'),
      aiId: 'cluster-alerting-policies:tab:builtin',
      ...(builtin.data ? { count: builtin.data.total } : {}),
    },
  ];

  const bulkGroups = allRows.filter((row) => selectedKeys.includes(row.name));

  const onBulkAction = (action: string): void => {
    if (action !== 'enable' && action !== 'disable') return;
    setBulkResult(null);
    if (action === 'enable') {
      bulkEnable.mutate(bulkGroups.filter((row) => !row.enabled));
      return;
    }
    setDisableError('');
    setDisabling(bulkGroups.filter((row) => row.enabled));
  };

  return (
    <AiSurface
      as="section"
      aiId="cluster-alerting-policies:surface"
      state={state}
      className="flex min-w-0 flex-col gap-4"
      data-ai-id="cluster-alerting-policies:body"
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-ai-fg">{t('cluster.alerting.policies.title')}</h1>
        <p className="text-xs text-ai-fg-muted">{t('cluster.alerting.policies.description')}</p>
      </header>

      {tab === 'custom' && !permissions.createCluster ? (
        <p className="text-xs text-ai-fg-muted" data-ai-id="cluster-alerting-policies:no-create-permission">
          {t('cluster.alerting.policies.createDenied')}
        </p>
      ) : null}

      {resetDone ? (
        <p role="status" className="text-xs text-ai-success" data-ai-id="cluster-alerting-policies:reset-success">
          {t('cluster.alerting.policies.resetSuccess', { name: resetDone })}
        </p>
      ) : null}

      {bulkResult ? (
        <p
          role="status"
          className={bulkResult.failed.length ? 'text-xs text-ai-danger' : 'text-xs text-ai-fg-secondary'}
          data-ai-id="cluster-alerting-policies:bulk-result"
        >
          {bulkResult.failed.length
            ? t('monitoring.ruleGroups.bulkPartial', { ok: bulkResult.ok, failed: bulkResult.failed.join(', ') })
            : t('monitoring.ruleGroups.bulkDone', { ok: bulkResult.ok })}
        </p>
      ) : null}

      <Tabs
        value={tab}
        onValueChange={(next) => {
          setTab(next as Tab);
          list.setPage(1);
          setSelectedKeys([]);
          setBulkResult(null);
          setResetDone('');
          setFilters({});
        }}
        items={tabs}
      >
        <TabsContent value="custom">
          {custom.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <ResourceList
              {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
              onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys}
              schema={schema}
              onRefresh={listRefresh.onRefresh}
              selectedKeys={selectedKeys}
              onSelectionChange={setSelectedKeys}
              onBulkAction={onBulkAction}
              rows={pageRows}
              loading={false}
              filters={filters}
              onFiltersChange={(next) => {
                setFilters(next);
                list.setPage(1);
              }}
              searchValue={list.keyword}
              onSearchChange={list.setKeyword}
              onPageChange={list.setPage}
              onPageSizeChange={list.setPageSize}
              onSortChange={(next: { key: string; order: SortOrder } | undefined) => {
                if (next) list.setSort(next);
              }}
              onAction={onAction}
            />
          )}
        </TabsContent>
        <TabsContent value="builtin">
          {/*
           * The hint is the probe result in one sentence: the switch is writable, but the
           * object is still owned by the installer for everything else.
           */}
          <p className="mb-2 text-xs text-ai-fg-muted" data-ai-id="cluster-alerting-policies:builtin-hint">
            {t('cluster.alerting.policies.builtinHint')}
          </p>
          {builtin.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <ResourceList
              schema={schema}
              onRefresh={listRefresh.onRefresh}
              selectedKeys={selectedKeys}
              onSelectionChange={setSelectedKeys}
              onBulkAction={onBulkAction}
              rows={pageRows}
              loading={false}
              filters={filters}
              onFiltersChange={(next) => {
                setFilters(next);
                list.setPage(1);
              }}
              searchValue={list.keyword}
              onSearchChange={list.setKeyword}
              onPageChange={list.setPage}
              onPageSizeChange={list.setPageSize}
              onSortChange={(next: { key: string; order: SortOrder } | undefined) => {
                if (next) list.setSort(next);
              }}
              onAction={onAction}
            />
          )}
        </TabsContent>
      </Tabs>

      <MutationAlert error={toggle.error ?? remove.error ?? disable.error} />

      <RuleGroupDialog
        open={creating || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
        cluster={cluster}
        scope="cluster"
        {...(editing ? { group: editing } : {})}
      />

      {yamlTarget ? (
        yamlQuery.isPending ? (
          <Modal open onOpenChange={(open) => !open && setYamlTarget(null)} title={t('resource.action.editYaml')} size="lg">
            <Skeleton className="h-64 w-full" />
          </Modal>
        ) : yamlQuery.isError ? (
          <Modal open onOpenChange={(open) => !open && setYamlTarget(null)} title={t('resource.action.editYaml')} size="lg">
            <ResourceErrorPanel
              error={yamlQuery.error}
              onRetry={() => void yamlQuery.refetch()}
              retryAiId="cluster-alerting-policies:yaml-retry"
            />
          </Modal>
        ) : yamlQuery.data ? (
          <DialogSuspense>
            <LazyYamlDialog
              open
              onOpenChange={(open) => !open && setYamlTarget(null)}
              initialYaml={toYaml(yamlQuery.data.raw)}
              lockName={yamlTarget.name}
              title={t('resource.action.editYaml')}
              submitLabel={t('common.confirm')}
              pending={replaceYaml.isPending}
              onSubmit={async (object) => {
                await replaceYaml.mutateAsync({ group: yamlTarget, object });
              }}
            />
          </DialogSuspense>
        ) : null
      ) : null}

      {yamlError ? (
        <p role="alert" className="text-xs text-ai-danger" data-ai-id="cluster-alerting-policies:yaml-error">
          {yamlError}
        </p>
      ) : null}

      {deleting ? (
        <DeleteDialog
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          names={[deleting.name]}
          resource="alertingrules"
          noun={t('monitoring.ruleGroups.title')}
          pending={remove.isPending}
          {...(remove.error ? { error: errorMessage(t, remove.error) } : {})}
          onConfirm={async () => {
            await remove.mutateAsync(deleting);
          }}
        />
      ) : null}

      <Modal
        open={resetting !== null}
        onOpenChange={(open) => {
          if (!open && !reset.isPending) {
            setResetting(null);
            setResetError('');
          }
        }}
        title={t('cluster.alerting.policies.resetTitle')}
        size="md"
      >
        {resetting ? (
          <div className="flex flex-col gap-4 text-xs" data-ai-id="cluster-alerting-policies:reset-dialog">
            <p className="text-ai-fg-secondary">{t('cluster.alerting.policies.resetDesc', { name: resetting.name })}</p>
            {resetError ? (
              <p role="alert" className="text-ai-danger" data-ai-id="cluster-alerting-policies:reset-error">
                {resetError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={reset.isPending}
                {...actionProps('cluster-alerting-policies:reset-cancel')}
                onClick={() => {
                  setResetting(null);
                  setResetError('');
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                size="sm"
                disabled={reset.isPending}
                {...actionProps('cluster-alerting-policies:reset-confirm')}
                onClick={() => {
                  setResetError('');
                  reset.mutate(resetting);
                }}
              >
                {t('cluster.alerting.policies.resetConfirm')}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={disabling !== null}
        onOpenChange={(open) => {
          if (!open && !disable.isPending) {
            setDisabling(null);
            setDisableError('');
          }
        }}
        title={t('cluster.alerting.policies.disableTitle')}
        size="md"
      >
        {disabling ? (
          <div className="flex flex-col gap-4 text-xs" data-ai-id="cluster-alerting-policies:disable-dialog">
            <p className="text-ai-fg-secondary">
              {disabling.length === 1
                ? t('cluster.alerting.policies.disableDesc', { name: disabling[0]?.name ?? '' })
                : t('cluster.alerting.policies.disableBulkDesc', { count: disabling.length })}
            </p>
            {disableError ? (
              <p role="alert" className="text-ai-danger" data-ai-id="cluster-alerting-policies:disable-error">
                {disableError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={disable.isPending}
                {...actionProps('cluster-alerting-policies:disable-cancel')}
                onClick={() => {
                  setDisabling(null);
                  setDisableError('');
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={disable.isPending}
                {...actionProps('cluster-alerting-policies:disable-confirm')}
                onClick={() => {
                  setDisableError('');
                  disable.mutate(disabling);
                }}
              >
                {t('monitoring.action.disable')}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </AiSurface>
  );
}
