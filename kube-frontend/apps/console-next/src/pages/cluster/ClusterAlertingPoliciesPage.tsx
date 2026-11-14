import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ruleGroupsApi, type RuleGroupSummary } from '@kube-ai-hub/api-client';
import {
  AiSurface,
  Badge,
  Modal,
  ResourceList,
  Skeleton,
  Tabs,
  TabsContent,
  type ListSchema,
} from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { RuleGroupBody } from '@/pages/monitoring/RuleGroupsPage';
import { formatTimestamp } from '@/lib/time';

/**
 * 告警策略（集群作用域）.
 *
 * Two tabs, matching the two collections the API serves and the old console's
 * split: **自定义策略** are `clusterrulegroups` (cluster-wide policies an operator
 * creates), **内置策略** are `globalrulegroups`, installed by the platform. They
 * are presented as tabs rather than one merged list because ownership is the
 * question here — "can I change this policy" — while the project page's merged
 * list answers "what policies does this project have".
 *
 * The built-in tab is read-only: those groups carry
 * `alerting.kubesphere.io/builtin: true` and the installer owns them. The custom
 * tab offers detail and enable/disable; creating and editing a cluster-scope
 * policy is not migrated yet (project-scope writing is).
 */
export interface ClusterAlertingPoliciesPageProps {
  cluster: string;
}

type Tab = 'custom' | 'builtin';

/**
 * One policy page is 50 rows, larger than the 20-row message page: a tab's row
 * count is meant to equal its collection's count, and the built-in collection has
 * 18 entries today. A page size of 10 would make the two disagree on screen.
 */
const PAGE_SIZE = 50;

export function ClusterAlertingPoliciesPage({ cluster }: ClusterAlertingPoliciesPageProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState<Tab>('custom');
  const [page, setPage] = React.useState(1);
  const [detail, setDetail] = React.useState<RuleGroupSummary | null>(null);

  const custom = useQuery({
    queryKey: ['cluster-rule-groups', cluster, 'custom'],
    queryFn: ({ signal }) => ruleGroupsApi(apiClient).listScope({ scope: 'cluster', signal }),
  });
  const builtin = useQuery({
    queryKey: ['cluster-rule-groups', cluster, 'builtin'],
    queryFn: ({ signal }) => ruleGroupsApi(apiClient).listScope({ scope: 'global', signal }),
  });

  const active = tab === 'custom' ? custom : builtin;
  const rows = active.data?.items ?? [];
  const total = active.data?.total ?? 0;
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const detailQuery = useQuery({
    enabled: detail !== null,
    queryKey: ['cluster-rule-group', cluster, detail?.scope, detail?.name],
    queryFn: ({ signal }) =>
      ruleGroupsApi(apiClient).get({ name: detail?.name ?? '', scope: detail?.scope ?? 'cluster', signal }),
  });

  const toggle = useMutation({
    mutationFn: (input: { group: RuleGroupSummary; enabled: boolean }) =>
      ruleGroupsApi(apiClient).setEnabled({
        name: input.group.name,
        scope: input.group.scope,
        enabled: input.enabled,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cluster-rule-groups', cluster] });
      void queryClient.invalidateQueries({ queryKey: ['cluster-rule-group', cluster] });
    },
  });

  const schema = React.useMemo<ListSchema<RuleGroupSummary>>(
    () => ({
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      columns: [
        {
          key: 'name',
          title: t('monitoring.column.name'),
          render: (row) => (
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-ai-fg">{row.name}</span>
              <span className="truncate text-[11px] text-ai-fg-muted">{row.description || '-'}</span>
            </span>
          ),
        },
        {
          key: 'enabled',
          title: t('monitoring.column.ruleStatus'),
          width: 130,
          hideBelow: 'md',
          render: (row) => (
            <Badge tone={row.enabled ? 'success' : 'neutral'}>
              {row.enabled ? t('monitoring.status.enabled') : t('monitoring.status.disabled')}
            </Badge>
          ),
        },
        {
          key: 'ruleCount',
          title: t('monitoring.column.ruleCount'),
          width: 110,
          hideBelow: 'lg',
          render: (row) => <span className="tabular-nums text-ai-fg-secondary">{row.ruleCount}</span>,
        },
        {
          key: 'scope',
          title: t('monitoring.ruleGroups.type'),
          width: 110,
          hideBelow: 'lg',
          render: (row) => (
            <span className="text-ai-fg-secondary">
              {row.scope === 'global' ? t('monitoring.ruleGroups.scope.global') : t('monitoring.ruleGroups.scope.cluster')}
            </span>
          ),
        },
        {
          key: 'createdAt',
          title: t('cluster.column.createdAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
        },
      ],
      rowActions: [
        { key: 'detail', label: t('monitoring.action.detail'), aiId: 'cluster-alerting-policies:detail' },
        // Built-in groups are installer-owned; offering a switch would create a
        // second source of truth that the next reconcile overwrites.
        ...(tab === 'custom'
          ? [
              { key: 'disable', label: t('monitoring.action.disable'), aiId: 'cluster-alerting-policies:disable', visible: (row: RuleGroupSummary) => row.enabled },
              { key: 'enable', label: t('monitoring.action.enable'), aiId: 'cluster-alerting-policies:enable', visible: (row: RuleGroupSummary) => !row.enabled },
            ]
          : []),
      ],
      empty: {
        title: t('cluster.alerting.policies.emptyTitle'),
        description: t('cluster.alerting.policies.emptyDescription'),
      },
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
    [page, t, tab, total],
  );

  const state = active.isPending ? 'loading' : active.isError ? 'error' : pageRows.length === 0 ? 'empty' : 'ready';

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

  return (
    <AiSurface as="section" aiId="cluster-alerting-policies:surface" state={state} className="flex min-w-0 flex-col gap-4" data-ai-id="cluster-alerting-policies:body">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-ai-fg">{t('cluster.alerting.policies.title')}</h1>
        <p className="text-xs text-ai-fg-muted">{t('cluster.alerting.policies.description')}</p>
      </header>

      <Tabs
        value={tab}
        onValueChange={(next) => {
          setTab(next as Tab);
          setPage(1);
        }}
        items={tabs}
      >
        <TabsContent value="custom">
          {custom.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <ResourceList
              schema={schema}
              rows={pageRows}
              loading={false}
              onPageChange={setPage}
              onAction={(action, row) => {
                if (!row) return;
                if (action === 'detail') setDetail(row);
                if (action === 'enable' || action === 'disable') {
                  toggle.mutate({ group: row, enabled: action === 'enable' });
                }
              }}
            />
          )}
        </TabsContent>
        <TabsContent value="builtin">
          {builtin.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <ResourceList
              schema={schema}
              rows={pageRows}
              loading={false}
              onPageChange={setPage}
              onAction={(action, row) => {
                if (!row) return;
                if (action === 'detail') setDetail(row);
              }}
            />
          )}
        </TabsContent>
      </Tabs>

      <MutationAlert error={toggle.error} />

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
