import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ruleGroupsApi,
  ruleGroupsWriteApi,
  type RuleGroupDetail,
  type RuleGroupSummary,
} from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Modal, ResourceList, Skeleton, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { useProjectFilter } from '@/components/projects/useProjects';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { RuleGroupDialog } from './RuleGroupDialog';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { formatTimestamp } from '@/lib/time';

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
 */
export interface RuleGroupsPageProps {
  cluster: string;
  namespace: string;
}

const PAGE_SIZE = 10;

type SortKey = 'name' | 'ruleCount' | 'createTime';

export function RuleGroupsPage({ cluster, namespace }: RuleGroupsPageProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const list = useResourceListState<SortKey>({ defaultSortBy: 'name', resetOn: [cluster, namespace] });
  const [projectFilter, setProjectFilter] = React.useState(namespace);
  React.useEffect(() => setProjectFilter(namespace), [cluster, namespace]);

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

  const [detail, setDetail] = React.useState<RuleGroupSummary | null>(null);
  const [editing, setEditing] = React.useState<RuleGroupSummary | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<RuleGroupSummary | null>(null);

  const remove = useMutation({
    mutationFn: (group: RuleGroupSummary) =>
      ruleGroupsWriteApi(apiClient).remove({ namespace: projectFilter, name: group.name }),
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
  const detailQuery = useQuery({
    enabled: detail !== null,
    queryKey: ['rule-group', cluster, detail?.scope, detail?.name],
    queryFn: ({ signal }) =>
      ruleGroupsApi(apiClient).get({
        name: detail?.name ?? '',
        scope: detail?.scope ?? 'global',
        ...(detail?.scope === 'project' ? { namespace: projectFilter } : {}),
        signal,
      }),
  });

  const projectFilterControl = useProjectFilter(
    cluster,
    t('monitoring.filter.projectLabel'),
    t('monitoring.filter.project'),
    undefined,
    'alertingrules:filter:project',
  );

  const all = groups.data?.items ?? [];
  const keyword = list.search.trim().toLowerCase();
  const filtered = keyword ? all.filter((group) => group.name.toLowerCase().includes(keyword)) : all;
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
  const rows = sorted.slice((list.page - 1) * PAGE_SIZE, list.page * PAGE_SIZE);

  const schema = React.useMemo<ListSchema<RuleGroupSummary>>(
    () => ({
      title: t('monitoring.ruleGroups.title'),
      description: t('monitoring.ruleGroups.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('monitoring.searchPlaceholder'), aiId: 'alertingrules:search' },
      filters: [projectFilterControl],
      sortableKeys: ['name', 'ruleCount', 'createTime'],
      sortAiPrefix: 'alertingrules',
      sort: { key: list.sortBy, order: list.order },
      columns: [
        {
          key: 'name',
          title: t('monitoring.column.name'),
          render: (row: RuleGroupSummary) => (
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-ai-fg">{row.name}</span>
              <span className="truncate text-[11px] text-ai-fg-muted">{scopeLabel(t, row.scope)}</span>
            </span>
          ),
        },
        {
          key: 'enabled',
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
          title: t('monitoring.ruleGroups.ruleCount'),
          width: 110,
          hideBelow: 'lg',
          render: (row: RuleGroupSummary) => <span className="tabular-nums text-ai-fg-secondary">{row.ruleCount}</span>,
        },
        {
          key: 'type',
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
          title: t('cluster.column.createdAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row: RuleGroupSummary) => (
            <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>
          ),
        },
      ],
      ...(projectFilter
        ? {
            primaryAction: {
              key: 'create',
              label: t('monitoring.ruleGroups.create'),
              aiId: 'monitoring-alerts:create',
            },
          }
        : {}),
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
          visible: (row: RuleGroupSummary) => row.enabled,
        },
        {
          key: 'enable',
          label: t('monitoring.action.enable'),
          aiId: 'monitoring-alerts:enable',
          visible: (row: RuleGroupSummary) => !row.enabled,
        },
        /*
         * Edit and delete appear only where they can succeed. Builtin and
         * cluster-scoped groups are installer-owned, so those rows do not offer the
         * actions at all; the editor itself edits the whole rule list, so rule count
         * is no longer a gate.
         */
        { key: 'edit', label: t('common.edit'), aiId: 'monitoring-alerts:edit', visible: (row: RuleGroupSummary) => canEdit(row) },
        {
          key: 'delete',
          label: t('common.delete'),
          aiId: 'monitoring-alerts:delete',
          tone: 'danger' as const,
          visible: (row: RuleGroupSummary) => canEdit(row),
        },
      ],
      empty: {
        title: t('monitoring.ruleGroups.emptyTitle'),
        description: t('monitoring.ruleGroups.emptyDescription'),
      },
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
    [canEdit, list, projectFilterControl, t, total],
  );

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
        onPageChange={list.setPage}
        onSortChange={(next: { key: string; order: SortOrder } | undefined) => {
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
          if (action === 'detail') setDetail(row);
          if (action === 'edit') setEditing(row);
          if (action === 'delete') setDeleting(row);
          if (action === 'enable' || action === 'disable') {
            toggle.mutate({ group: row, enabled: action === 'enable' });
          }
        }}
      />

      <MutationAlert error={toggle.error ?? remove.error} />

      <RuleGroupDialog
        open={creating || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
        cluster={cluster}
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

      <Modal
        open={detail !== null}
        onOpenChange={(open) => !open && setDetail(null)}
        title={detail?.name ?? t('monitoring.action.detail')}
        size="lg"
      >
        {detailQuery.data ? <RuleGroupBody detail={detailQuery.data} /> : <Skeleton className="h-40 w-full" />}
      </Modal>
    </AiSurface>
  );
}

function scopeLabel(t: ReturnType<typeof useT>, scope: RuleGroupSummary['scope']): string {
  const map = {
    global: 'monitoring.ruleGroups.scope.global',
    cluster: 'monitoring.ruleGroups.scope.cluster',
    project: 'monitoring.ruleGroups.scope.project',
  } as const;
  return t(map[scope]);
}

/**
 * One group's rules.
 *
 * The expression is shown in full rather than truncated: it is the thing a reader
 * opens this panel to read, and a PromQL expression cut at 80 characters usually
 * loses exactly the condition that matters.
 */
export function RuleGroupBody({ detail }: { detail: RuleGroupDetail }): React.ReactElement {
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
          <table className="w-full border-collapse text-xs" data-ai-id="alertingrules:detail:rule-table">
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
                  <td className="px-2 py-2 font-medium text-ai-fg">{rule.name}</td>
                  <td className="px-2 py-2 text-ai-fg-secondary">{rule.severity || '-'}</td>
                  <td className="px-2 py-2 tabular-nums text-ai-fg-secondary">{rule.duration || '-'}</td>
                  <td className="min-w-0 px-2 py-2 text-ai-fg-secondary">
                    <span className="block break-words">{rule.summary || rule.description || '-'}</span>
                    {rule.message ? <span className="mt-1 block break-words text-ai-fg-muted">{rule.message}</span> : null}
                    {rule.expression ? (
                      <code className="mt-1 block break-words font-mono text-[11px] text-ai-fg-muted">{rule.expression}</code>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}