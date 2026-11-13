import * as React from 'react';
import { type AlertSummary, type AlertingRuleSummary } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, Modal, ResourceList, Skeleton, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { useProjectFilter } from '@/components/projects/useProjects';
import { useResourceListState, toListParams } from '@/components/resource/useResourceListState';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { MONITORING_DESCRIPTORS, useAlertingModel, useDeleteAlert, useMonitoringList, useToggleRule, type MonitoringKind } from './queries';
import { RuleGroupsPage } from './RuleGroupsPage';

/**
 * The monitoring area's two lists: 告警消息 and 告警策略.
 *
 * Both are read-only surfaces over their own kapis group. Alerts are history — a
 * row opens a detail drawer and can be deleted; rules are configuration and are
 * toggled in place. That difference lives in the descriptor, not in two pages.
 */
export interface MonitoringListPageProps {
  kind: MonitoringKind;
  cluster: string;
  namespace: string;
}

const PAGE_SIZE = 10;

type SortKey = 'name' | 'createTime';

type Row = AlertSummary | AlertingRuleSummary;

export function MonitoringListPage({ kind, cluster, namespace }: MonitoringListPageProps): React.ReactElement {
  const t = useT();
  const descriptor = MONITORING_DESCRIPTORS[kind];
  /*
   * Which alerting model this cluster serves.
   *
   * 3.3 stored policies as `alertingrules`; the current API group stores rule
   * groups. Probing the API group is the only honest test — a version string says
   * nothing about which CRDs were installed, and this cluster is 3.4 while the
   * resource the page used to read does not exist at all.
   */
  const model = useAlertingModel();
  if (kind === 'alertingrules' && model.data === 'rulegroups') {
    return <RuleGroupsPage cluster={cluster} namespace={namespace} />;
  }
  if (kind === 'alertingrules' && model.isPending) {
    return (
      <AiSurface as="section" aiId="alertingrules:surface" state="loading" className="min-w-0">
        <Skeleton className="h-40 w-full" />
      </AiSurface>
    );
  }
  const [projectFilter, setProjectFilter] = React.useState(namespace);
  React.useEffect(() => setProjectFilter(namespace), [cluster, namespace]);

  const list = useResourceListState<SortKey>({ defaultSortBy: 'createTime', resetOn: [cluster, projectFilter] });
  const query = useMonitoringList(kind, toListParams(list, { cluster, namespace: projectFilter }, PAGE_SIZE));
  const remove = useDeleteAlert({ cluster, namespace: projectFilter });
  const toggle = useToggleRule({ cluster, namespace: projectFilter });
  const [toDelete, setToDelete] = React.useState<string[] | null>(null);
  const [detail, setDetail] = React.useState<Row | null>(null);
  const projectFilterControl = useProjectFilter(cluster, t('monitoring.filter.projectLabel'), t('monitoring.filter.project'), undefined, 'monitoring:filter:project');

  const rows = (query.data?.items ?? []) as Row[];
  const total = query.data?.total ?? 0;

  const schema = React.useMemo<ListSchema<Row>>(
    () => ({
      title: t(descriptor.titleKey),
      description: t(descriptor.descriptionKey),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('monitoring.searchPlaceholder'), aiId: `${kind}:search` },
      filters: [projectFilterControl],
      sortableKeys: ['name', 'createTime'],
      sortAiPrefix: kind,
      sort: { key: list.sortBy, order: list.order },
      columns:
        kind === 'alerts'
          ? [
              {
                key: 'name',
                title: t('monitoring.column.message'),
                render: (row: Row) => {
                  const alert = row as AlertSummary;
                  return (
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-ai-fg" title={alert.message}>
                        {alert.message || alert.name}
                      </span>
                      <span className="truncate text-[11px] text-ai-fg-muted">{alert.target || '-'}</span>
                    </span>
                  );
                },
              },
              {
                key: 'state',
                title: t('monitoring.column.state'),
                width: 120,
                hideBelow: 'md',
                render: (row: Row) => {
                  const alert = row as AlertSummary;
                  return <Badge tone={alert.state === 'firing' ? 'danger' : alert.state === 'pending' ? 'warning' : 'success'}>{alertStateLabel(t, alert.state)}</Badge>;
                },
              },
              {
                key: 'severity',
                title: t('monitoring.column.severity'),
                width: 110,
                hideBelow: 'lg',
                render: (row: Row) => {
                  const alert = row as AlertSummary;
                  return <span className="text-ai-fg-secondary">{severityLabel(t, alert.severity)}</span>;
                },
              },
              {
                key: 'triggeredAt',
                title: t('monitoring.column.triggeredAt'),
                width: 170,
                hideBelow: 'xl',
                render: (row: Row) => {
                  const alert = row as AlertSummary;
                  return <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(alert.triggeredAt)}</span>;
                },
              },
            ]
          : [
              {
                key: 'name',
                title: t('monitoring.column.name'),
                render: (row: Row) => {
                  const rule = row as AlertingRuleSummary;
                  return (
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-ai-fg">{rule.alias || rule.name}</span>
                      <span className="truncate text-[11px] text-ai-fg-muted">{rule.description || '-'}</span>
                    </span>
                  );
                },
              },
              {
                key: 'enabled',
                title: t('monitoring.column.ruleStatus'),
                width: 130,
                hideBelow: 'md',
                render: (row: Row) => {
                  const rule = row as AlertingRuleSummary;
                  return <Badge tone={rule.enabled ? 'success' : 'neutral'}>{rule.enabled ? t('monitoring.status.enabled') : t('monitoring.status.disabled')}</Badge>;
                },
              },
              {
                key: 'ruleCount',
                title: t('monitoring.column.ruleCount'),
                width: 110,
                hideBelow: 'lg',
                render: (row: Row) => <span className="tabular-nums text-ai-fg-secondary">{(row as AlertingRuleSummary).ruleCount}</span>,
              },
              {
                key: 'lastEvaluation',
                title: t('monitoring.column.lastEvaluation'),
                width: 170,
                hideBelow: 'xl',
                render: (row: Row) => {
                  const rule = row as AlertingRuleSummary;
                  return <span className="tabular-nums text-ai-fg-muted">{rule.lastEvaluation ? formatTimestamp(rule.lastEvaluation) : '-'}</span>;
                },
              },
            ],
      rowActions: [
        { key: 'detail', label: t('monitoring.action.detail') },
        /*
         * 启用/停用 are two entries whose `visible` predicates are mutually exclusive:
         * a row action's label is static, so one entry cannot rename itself per row.
         * The old console shows whichever applies; the same is done here with an
         * enabled/disabled pair.
         */
        ...(descriptor.allowToggle
          ? [
              { key: 'disable', label: t('monitoring.action.disable'), visible: (row: Row) => (row as AlertingRuleSummary).enabled },
              { key: 'enable', label: t('monitoring.action.enable'), visible: (row: Row) => !(row as AlertingRuleSummary).enabled },
            ]
          : []),
        ...(descriptor.allowDelete ? [{ key: 'delete', label: t('common.delete'), tone: 'danger' as const }] : []),
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
    [descriptor, kind, list, projectFilterControl, t, total],
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
        onPageChange={list.setPage}
        onSortChange={(next: { key: string; order: SortOrder } | undefined) => {
          if (next) list.setSort(next);
        }}
        onAction={(action, row) => {
          if (!row) return;
          if (action === 'delete') setToDelete([row.name]);
          if (action === 'detail') setDetail(row);
          if (action === 'enable' || action === 'disable') {
            // The label the platform evaluates on flips; the list refetches so the
            // status badge reflects what is now stored, not what we hoped.
            toggle.mutate({ name: row.name, enabled: action === 'enable' });
          }
        }}
      />

      <MutationAlert error={remove.error ?? toggle.error} />

      <Modal
        open={detail !== null}
        onOpenChange={(open) => !open && setDetail(null)}
        title={kind === 'alerts' ? t('monitoring.action.detail') : t('monitoring.action.detail')}
        size="md"
      >
        {detail ? <DetailFields kind={kind} row={detail} /> : null}
      </Modal>

      {toDelete ? (
        <DeleteDialog
          open
          onOpenChange={(open) => !open && setToDelete(null)}
          names={toDelete}
          resource={kind}
          noun={t(descriptor.titleKey)}
          pending={remove.isPending}
          onConfirm={async () => {
            await remove.mutateAsync(toDelete);
            setToDelete(null);
          }}
        />
      ) : null}
    </AiSurface>
  );
}

/** Alert state → locale key, falling back to the raw value. */
function alertStateLabel(t: (key: never) => string, state: string): string {
  const map: Record<string, string> = {
    firing: 'monitoring.state.firing',
    pending: 'monitoring.state.pending',
    resolved: 'monitoring.state.resolved',
  };
  const key = map[state.toLowerCase()];
  return key ? t(key as never) : state;
}

/** Severity → locale key, falling back to the raw value. */
function severityLabel(t: (key: never) => string, severity: string): string {
  const map: Record<string, string> = {
    critical: 'monitoring.severity.critical',
    warning: 'monitoring.severity.warning',
    info: 'monitoring.severity.info',
  };
  const key = map[severity.toLowerCase()];
  return key ? t(key as never) : severity || '-';
}

/**
 * Detail body for one message or rule.
 *
 * Rendered from the row the list already holds: these objects are small and the
 * list request carries them whole, so opening the drawer must not cost another
 * round trip — and on this cluster the alerting API is slow enough that it would.
 */
function DetailFields({ kind, row }: { kind: MonitoringKind; row: Row }): React.ReactElement {
  const t = useT();
  const entries: Array<[string, string]> =
    kind === 'alerts'
      ? [
          [t('monitoring.field.message'), (row as AlertSummary).message || '-'],
          [t('monitoring.field.state'), (row as AlertSummary).state || '-'],
          [t('monitoring.field.severity'), (row as AlertSummary).severity || '-'],
          [t('monitoring.field.rule'), (row as AlertSummary).ruleName || '-'],
          [t('monitoring.field.target'), (row as AlertSummary).target || '-'],
          [t('monitoring.field.triggeredAt'), formatTimestamp((row as AlertSummary).triggeredAt)],
        ]
      : [
          [t('monitoring.field.name'), (row as AlertingRuleSummary).name],
          [t('monitoring.field.ruleCount'), String((row as AlertingRuleSummary).ruleCount)],
          [t('monitoring.field.lastEvaluation'), (row as AlertingRuleSummary).lastEvaluation ? formatTimestamp((row as AlertingRuleSummary).lastEvaluation) : '-'],
          [t('monitoring.field.createdAt'), formatTimestamp(row.createdAt)],
        ];
  return (
    <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-[minmax(6rem,auto)_1fr]" data-ai-id={`${kind}-detail:fields`}>
      {entries.map(([label, value]) => (
        <React.Fragment key={label}>
          <dt className="text-ai-fg-muted">{label}</dt>
          <dd className="min-w-0 break-words text-ai-fg-secondary">{value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
