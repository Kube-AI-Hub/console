import * as React from 'react';
import { type AlertMessage, type AlertingRuleSummary } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, Modal, ResourceList, Skeleton, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { useProjectFilter } from '@/components/projects/useProjects';
import { useResourceListState, toListParams } from '@/components/resource/useResourceListState';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { MONITORING_DESCRIPTORS, useAlertingModel, useMonitoringList, useToggleRule, type MonitoringKind } from './queries';
import { RuleGroupsPage } from './RuleGroupsPage';
import { useListRefresh } from '@/components/resource/useListRefresh';
import { alertSeverityLabel, alertStateLabel } from './alertLabels';

/**
 * The monitoring area's two lists: 告警消息 and 告警策略.
 *
 * Alert messages are **history**: they are read from the aggregated v2beta1 API and
 * open a drill-down. Rules are configuration and are toggled in place. That
 * difference lives in the descriptor, not in two pages.
 *
 * Deleting an alert message is deliberately not offered. The aggregated API exposes
 * no item route — `DELETE /kapis/alerting.kubesphere.io/v2beta1/namespaces/<ns>/alerts/<name>`
 * answers `404 Page Not Found` (probed 2026-11-15), and the old console's message
 * page had no delete action either. A delete entry here would be a button that
 * cannot succeed.
 */
export interface MonitoringListPageProps {
  kind: MonitoringKind;
  cluster: string;
  namespace: string;
}

const PAGE_SIZE = 10;

type SortKey = 'name' | 'createTime' | 'triggeredAt';

type Row = AlertMessage | AlertingRuleSummary;

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

  /*
   * Alert messages always read the URL's project: the aggregated collection is
   * namespaced, and the old project message page had no project picker either
   * (cross-project messages live on the cluster page). The legacy `alertingrules`
   * list keeps the picker because it merges scopes.
   */
  const effectiveNamespace = kind === 'alerts' ? namespace : projectFilter;

  const list = useResourceListState<SortKey>({
    defaultSortBy: kind === 'alerts' ? 'triggeredAt' : 'createTime',
    resetOn: [cluster, effectiveNamespace],
  });
  const query = useMonitoringList(kind, toListParams(list, { cluster, namespace: effectiveNamespace }, PAGE_SIZE));
  const toggle = useToggleRule({ cluster, namespace: effectiveNamespace });
  const [detail, setDetail] = React.useState<Row | null>(null);
  const projectFilterControl = useProjectFilter(cluster, t('monitoring.filter.projectLabel'), t('monitoring.filter.project'), undefined, 'monitoring:filter:project');

  const rows = (query.data?.items ?? []) as Row[];
  const total = query.data?.total ?? 0;
  const listRefresh = useListRefresh(`${kind}`, query);

  const schema = React.useMemo<ListSchema<Row>>(
    () => ({
      title: t(descriptor.titleKey),
      refresh: listRefresh.refresh,
      description: t(descriptor.descriptionKey),
      rowKey: (row: Row) => (kind === 'alerts' ? (row as AlertMessage).id : row.name),
      rowAttributes: (row) => ({ 'data-ai-row': kind === 'alerts' ? (row as AlertMessage).id : row.name }),
      search: { placeholder: t('monitoring.searchPlaceholder'), aiId: `${kind}:search` },
      ...(kind === 'alerts' ? {} : { filters: [projectFilterControl] }),
      sortableKeys: kind === 'alerts' ? ['triggeredAt'] : ['name', 'createTime'],
      sortAiPrefix: kind,
      sort: { key: list.sortBy, order: list.order },
      columns:
        kind === 'alerts'
          ? [
              {
                key: 'message',
                title: t('monitoring.column.message'),
                render: (row: Row) => {
                  const alert = row as AlertMessage;
                  return (
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-ai-fg" title={alert.summary || alert.name}>
                        {alert.summary || alert.name || '-'}
                      </span>
                      <span className="truncate text-[11px] text-ai-fg-muted">{alert.message || '-'}</span>
                    </span>
                  );
                },
              },
              {
                key: 'state',
                title: t('monitoring.column.state'),
                width: 110,
                hideBelow: 'md',
                render: (row: Row) => {
                  const alert = row as AlertMessage;
                  return <Badge tone={alert.state === 'firing' ? 'danger' : alert.state === 'pending' ? 'warning' : 'success'}>{alertStateLabel(t, alert.state)}</Badge>;
                },
              },
              {
                key: 'severity',
                title: t('monitoring.column.severity'),
                width: 100,
                hideBelow: 'lg',
                render: (row: Row) => <span className="text-ai-fg-secondary">{alertSeverityLabel(t, (row as AlertMessage).severity)}</span>,
              },
              {
                key: 'ruleGroup',
                title: t('monitoring.column.policy'),
                width: 160,
                hideBelow: 'lg',
                render: (row: Row) => <span className="truncate text-ai-fg-secondary">{(row as AlertMessage).ruleGroup || '-'}</span>,
              },
              {
                key: 'target',
                title: t('monitoring.column.target'),
                width: 170,
                hideBelow: 'xl',
                render: (row: Row) => <span className="truncate text-ai-fg-muted">{(row as AlertMessage).target || '-'}</span>,
              },
              {
                key: 'triggeredAt',
                title: t('monitoring.column.triggeredAt'),
                width: 170,
                hideBelow: 'md',
                render: (row: Row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp((row as AlertMessage).triggeredAt)}</span>,
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
        { key: 'detail', label: t('monitoring.action.detail'), aiId: `${kind}:detail` },
        /*
         * 启用/停用 are two entries whose `visible` predicates are mutually exclusive:
         * a row action's label is static, so one entry cannot rename itself per row.
         * The old console shows whichever applies; the same is done here with an
         * enabled/disabled pair.
         */
        ...(descriptor.allowToggle
          ? [
              { key: 'disable', label: t('monitoring.action.disable'), aiId: `${kind}:disable`, visible: (row: Row) => (row as AlertingRuleSummary).enabled },
              { key: 'enable', label: t('monitoring.action.enable'), aiId: `${kind}:enable`, visible: (row: Row) => !(row as AlertingRuleSummary).enabled },
            ]
          : []),
      ],
      empty: { title: t(descriptor.emptyTitleKey), description: t(descriptor.emptyDescriptionKey) },
      labels: {
        ...listRefresh.emptyLabels,
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      pagination: { page: list.page, pageSize: PAGE_SIZE, total },
    }),
    // `isFetching` comes from the query, so the schema must rebuild when the fetch state changes.
    [descriptor, kind, list, projectFilterControl, query.isFetching, t, total],
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
        onRefresh={listRefresh.onRefresh}
        rows={rows}
        loading={state === 'loading'}
        searchValue={list.keyword}
        onSearchChange={list.setKeyword}
        {...(kind === 'alerts' ? {} : { filters: { project: projectFilter } })}
        {...(kind === 'alerts'
          ? {}
          : {
              onFiltersChange: (next: Record<string, string | undefined>) => {
                setProjectFilter(next['project'] ?? '');
                list.setPage(1);
              },
            })}
        onPageChange={list.setPage}
        onSortChange={(next: { key: string; order: SortOrder } | undefined) => {
          if (next) list.setSort(next);
        }}
        onAction={(action, row) => {
          if (!row) return;
          if (action === 'detail') setDetail(row);
          if (action === 'enable' || action === 'disable') {
            // The label the platform evaluates on flips; the list refetches so the
            // status badge reflects what is now stored, not what we hoped.
            toggle.mutate({ name: row.name, enabled: action === 'enable' });
          }
        }}
      />

      <MutationAlert error={toggle.error} />

      <Modal open={detail !== null} onOpenChange={(open) => !open && setDetail(null)} title={t('monitoring.action.detail')} size="md">
        {detail ? (
          kind === 'alerts' ? (
            <AlertMessageDetail message={detail as AlertMessage} />
          ) : (
            <DetailFields row={detail} />
          )
        ) : null}
      </Modal>
    </AiSurface>
  );
}

/**
 * Drill-down for one alert message.
 *
 * Decoded from the row the list already holds: the aggregated record carries the
 * whole message, so opening it must not cost another round trip. Labels and
 * annotations are rendered as an allowlisted summary — the alert record is a
 * controller artefact and a raw dump would grow with every label the platform adds.
 */
function AlertMessageDetail({ message }: { message: AlertMessage }): React.ReactElement {
  const t = useT();
  const entries: Array<[string, string]> = [
    [t('monitoring.field.name'), message.name || '-'],
    [t('monitoring.field.summary'), message.summary || '-'],
    [t('monitoring.field.message'), message.message || '-'],
    [t('monitoring.field.state'), alertStateLabel(t, message.state)],
    [t('monitoring.field.severity'), alertSeverityLabel(t, message.severity)],
    [t('monitoring.field.rule'), message.ruleGroup || '-'],
    [t('monitoring.field.target'), message.target || '-'],
    [t('monitoring.field.value'), message.value || '-'],
    [t('monitoring.field.triggeredAt'), formatTimestamp(message.triggeredAt)],
  ];
  return (
    <div className="flex flex-col gap-4 text-xs" data-ai-id="alerts:detail">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(6rem,auto)_1fr]">
        {entries.map(([label, value], index) => (
          <React.Fragment key={`${label}-${index}`}>
            <dt className="text-ai-fg-muted">{label}</dt>
            <dd className="min-w-0 break-words text-ai-fg-secondary">{value}</dd>
          </React.Fragment>
        ))}
      </dl>
      <SummaryList aiId="alerts:detail:labels" title={t('monitoring.alerts.labels')} entries={Object.entries(message.labels)} />
      <SummaryList aiId="alerts:detail:annotations" title={t('monitoring.alerts.annotations')} entries={Object.entries(message.annotations)} />
    </div>
  );
}

function SummaryList({ aiId, title, entries }: { aiId: string; title: string; entries: Array<[string, string]> }): React.ReactElement {
  return (
    <section className="flex flex-col gap-2" data-ai-id={aiId}>
      <h3 className="text-sm font-medium text-ai-fg">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-ai-fg-muted">-</p>
      ) : (
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(6rem,auto)_1fr]">
          {entries.map(([key, value]) => (
            <React.Fragment key={key}>
              <dt className="font-mono text-[11px] text-ai-fg-muted">{key}</dt>
              <dd className="min-w-0 break-words text-ai-fg-secondary">{value}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}
    </section>
  );
}

/** Detail body for one legacy alertingrule row (3.3 model). */
function DetailFields({ row }: { row: Row }): React.ReactElement {
  const t = useT();
  const rule = row as AlertingRuleSummary;
  const entries: Array<[string, string]> = [
    [t('monitoring.field.name'), rule.name],
    [t('monitoring.field.ruleCount'), String(rule.ruleCount)],
    [t('monitoring.field.lastEvaluation'), rule.lastEvaluation ? formatTimestamp(rule.lastEvaluation) : '-'],
    [t('monitoring.field.createdAt'), formatTimestamp(rule.createdAt)],
  ];
  return (
    <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-[minmax(6rem,auto)_1fr]" data-ai-id="alertingrules-detail:fields">
      {entries.map(([label, value]) => (
        <React.Fragment key={label}>
          <dt className="text-ai-fg-muted">{label}</dt>
          <dd className="min-w-0 break-words text-ai-fg-secondary">{value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
