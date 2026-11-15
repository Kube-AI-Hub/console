import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { clusterAlertMessagesApi, type ClusterAlertSummary } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, Button, Modal, ResourceList, type ListSchema } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { AlertDrillDown } from '@/pages/monitoring/AlertDrillDown';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { alertSeverityLabel, alertSourceLabel, alertStateLabel } from './alertingHelpers';
import { useListRefresh } from '@/components/resource/useListRefresh';

/**
 * 告警消息（集群作用域）.
 *
 * Two collections back one page: alerts raised by custom cluster rule groups
 * (`clusteralerts`) and by the installer's global groups (`globalalerts`). The old
 * console made them two tabs; here the source is a **column**, because the reader's
 * question — "what is firing in this cluster" — is not split by who owns the rule.
 *
 * The page is deliberately read-only. A cluster alert message is history owned by
 * the alerting controller; deleting a pending alert from a console would not stop
 * the controller from re-creating it on the next evaluation.
 */
export interface ClusterAlertingMessagesPageProps {
  cluster: string;
}

/** Page sizes the old console offered (`PAGESIZE_OPTION`): 10/20/50/100. */
const PAGE_SIZES = [10, 20, 50, 100] as const;
const PAGE_SIZE = 20;

export function ClusterAlertingMessagesPage({ cluster }: ClusterAlertingMessagesPageProps): React.ReactElement {
  const t = useT();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<number>(PAGE_SIZE);
  /*
   * Server-side filters, as the old console offers: state (pending/firing), severity and the
   * alerting policy. They are sent to both collections, because a page that filtered after the
   * fact would only narrow the page it happened to fetch.
   */
  const [state, setState] = React.useState('');
  const [severity, setSeverity] = React.useState('');
  const [ruleGroup, setRuleGroup] = React.useState('');

  const query = useQuery({
    queryKey: ['cluster-alert-messages', cluster, page, pageSize, state, severity, ruleGroup],
    queryFn: ({ signal }) =>
      clusterAlertMessagesApi(apiClient).list({
        page,
        pageSize,
        ...(state ? { state } : {}),
        ...(severity ? { severity } : {}),
        ...(ruleGroup ? { ruleGroup } : {}),
        signal,
      }),
  });

  const rows = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const listRefresh = useListRefresh('cluster-alerting-messages', query);

  const schema = React.useMemo<ListSchema<ClusterAlertSummary>>(
    () => ({
      title: t('cluster.alerting.messages.title'),
      sortAiPrefix: 'cluster-alerting-messages',
      refresh: listRefresh.refresh,
      description: t('cluster.alerting.messages.description'),
      filters: [
        {
          key: 'state',
          title: t('monitoring.column.state'),
          aiId: 'cluster-alerting-messages:filter:state',
          allLabel: t('monitoring.filter.allStates'),
          options: [
            { value: 'firing', label: alertStateLabel(t, 'firing') },
            { value: 'pending', label: alertStateLabel(t, 'pending') },
          ],
        },
        {
          key: 'severity',
          title: t('monitoring.column.severity'),
          aiId: 'cluster-alerting-messages:filter:severity',
          allLabel: t('monitoring.filter.allSeverities'),
          options: [
            { value: 'critical', label: alertSeverityLabel(t, 'critical') },
            { value: 'error', label: alertSeverityLabel(t, 'error') },
            { value: 'warning', label: alertSeverityLabel(t, 'warning') },
          ],
        },
      ],
      rowKey: 'id',
      rowAttributes: (row) => ({ 'data-ai-row': row.id }),
      columns: [
        {
          key: 'summary',
          title: t('monitoring.column.message'),
          render: (row) => (
            /*
             * The message title is the row's primary content. Clicking it opens the
             * drill-down, as the old console did; the three-dot menu keeps the same
             * action so keyboard users and automation have a second path.
             */
            <Button
              variant="ghost"
              className="h-auto min-w-0 justify-start p-0 text-left font-normal"
              data-ai-id="cluster-alerting-messages:open"
              onClick={() => setDetail(row)}
            >
              <span className="flex min-w-0 flex-col items-start">
                <span className="truncate font-medium text-ai-fg" title={row.summary || row.name}>
                  {row.summary || row.name || '-'}
                </span>
                <span className="truncate text-[11px] text-ai-fg-muted">{row.message || '-'}</span>
              </span>
            </Button>
          ),
        },
        {
          key: 'state',
          title: t('monitoring.column.state'),
          width: 110,
          hideBelow: 'md',
          render: (row) => (
            <Badge tone={row.state === 'firing' ? 'danger' : row.state === 'pending' ? 'warning' : 'success'}>
              {alertStateLabel(t, row.state)}
            </Badge>
          ),
        },
        {
          key: 'severity',
          title: t('monitoring.column.severity'),
          width: 100,
          hideBelow: 'lg',
          render: (row) => <span className="text-ai-fg-secondary">{alertSeverityLabel(t, row.severity)}</span>,
        },
        {
          key: 'ruleGroup',
          title: t('monitoring.field.rule'),
          width: 160,
          hideBelow: 'lg',
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.ruleGroup || '-'}</span>,
        },
        {
          key: 'source',
          title: t('cluster.alerting.column.source'),
          width: 140,
          hideBelow: 'md',
          render: (row) => <Badge tone={row.source === 'builtin' ? 'neutral' : 'info'}>{alertSourceLabel(t, row.source)}</Badge>,
        },
        {
          key: 'triggeredAt',
          title: t('monitoring.column.triggeredAt'),
          width: 200,
          hideBelow: 'xl',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.triggeredAt)}</span>,
        },
      ],
      rowActions: [{ key: 'detail', label: t('monitoring.action.detail'), aiId: 'cluster-alerting-messages:detail' }],
      empty: {
        title: t('cluster.alerting.messages.emptyTitle'),
        description: t('cluster.alerting.messages.emptyDescription'),
      },
      labels: {
        ...listRefresh.emptyLabels,
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      pagination: { page, pageSize, pageSizeOptions: [...PAGE_SIZES], total },
    }),
    [page, pageSize, query.isFetching, ruleGroup, severity, state, t, total],
  );

  const [detail, setDetail] = React.useState<ClusterAlertSummary | null>(null);
  const pageState = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  if (pageState === 'error') {
    return (
      <AiSurface as="section" aiId="cluster-alerting-messages:surface" state="error" className="min-w-0">
        <ResourceErrorPanel
          error={query.error}
          onRetry={() => void query.refetch()}
          retryAiId="cluster-alerting-messages:retry"
        />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="cluster-alerting-messages:surface" state={pageState} className="min-w-0">
      <ResourceList
        /*
         * The filter values are passed back in as controlled state. Without this the list keeps
         * its own copy and every change reports only the key that was just touched, so setting
         * severity would silently drop the state condition that was already active.
         */
        filters={{ state, severity }}
        onFiltersChange={(next) => {
          setState(next['state'] ?? '');
          setSeverity(next['severity'] ?? '');
          setRuleGroup(next['ruleGroup'] ?? '');
          setPage(1);
        }}
        schema={schema}
        onRefresh={listRefresh.onRefresh}
        rows={rows}
        loading={pageState === 'loading'}
        onPageChange={(next) => { setPage(next); }}
        onPageSizeChange={(next) => { setPageSize(next); setPage(1); }}
        onAction={(action, row) => {
          if (!row) return;
          if (action === 'detail') setDetail(row as ClusterAlertSummary);
        }}
      />

      <Modal
        open={detail !== null}
        onOpenChange={(open) => !open && setDetail(null)}
        title={t('monitoring.action.detail')}
        size="md"
      >
        {detail ? <MessageDetail row={detail} cluster={cluster} /> : null}
      </Modal>
    </AiSurface>
  );
}

/** Label keys shown in the drill-down, in display order. */
const DETAIL_LABELS = [
  'alertname',
  'severity',
  'rule_group',
  'rule_type',
  'rule_level',
  'namespace',
  'pod',
  'container',
  'node',
  'workload',
  'instance',
  'resource',
  'group',
  'version',
  'verb',
] as const;

/** Annotation keys shown in the drill-down; anything else stays unrendered. */
const DETAIL_ANNOTATIONS = ['summary', 'message', 'description', 'runbook_url'] as const;

/**
 * Allowlisted key/value summary.
 *
 * The aggregated alert item is a controller record, not an audit document: the
 * drill-down renders the operational labels and annotations it needs and nothing
 * else. A raw-object dump would expose unrelated metadata and grow with every
 * label the platform adds, so keys are listed explicitly rather than filtered out.
 */
function summarize(record: Record<string, string>, keys: readonly string[]): Array<[string, string]> {
  return keys
    .map((key): [string, string] => [key, record[key] ?? ''])
    .filter(([, value]) => value !== '');
}

/** One message's drill-down: identifying fields, then label and annotation summaries. */
function MessageDetail({ row, cluster }: { row: ClusterAlertSummary; cluster: string }): React.ReactElement {
  const t = useT();
  const entries: Array<[string, string]> = [
    [t('monitoring.field.name'), row.name || '-'],
    [t('cluster.alerting.field.summary'), row.summary || '-'],
    [t('monitoring.field.message'), row.message || '-'],
    [t('monitoring.field.state'), alertStateLabel(t, row.state)],
    [t('monitoring.field.severity'), alertSeverityLabel(t, row.severity)],
    [t('monitoring.field.rule'), row.ruleGroup || '-'],
    [t('cluster.alerting.field.ruleType'), row.ruleType || '-'],
    [t('cluster.alerting.column.source'), alertSourceLabel(t, row.source)],
    [t('monitoring.field.target'), row.target || '-'],
    [t('monitoring.field.triggeredAt'), formatTimestamp(row.triggeredAt)],
    [t('cluster.alerting.field.value'), row.value || '-'],
  ];
  return (
    <div className="flex flex-col gap-5 text-xs" data-ai-id="cluster-alerting-messages:detail">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(6rem,auto)_1fr]">
        {entries.map(([label, value], index) => (
          <React.Fragment key={`${label}-${index}`}>
            <dt className="text-ai-fg-muted">{label}</dt>
            <dd className="min-w-0 break-words text-ai-fg-secondary">{value}</dd>
          </React.Fragment>
        ))}
      </dl>
      {/* Cluster-scope messages name no workspace: the component resolves it from the alert's
          namespace, which is what makes the policy and object links reachable from here. */}
      <AlertDrillDown message={row} cluster={cluster} fallbackNamespace="" />
      <SummarySection
        aiId="cluster-alerting-messages:detail:labels"
        title={t('cluster.alerting.detail.labels')}
        entries={summarize(row.labels, DETAIL_LABELS)}
      />
      <SummarySection
        aiId="cluster-alerting-messages:detail:annotations"
        title={t('cluster.alerting.detail.annotations')}
        entries={summarize(row.annotations, DETAIL_ANNOTATIONS)}
      />
    </div>
  );
}

function SummarySection({
  aiId,
  title,
  entries,
}: {
  aiId: string;
  title: string;
  entries: Array<[string, string]>;
}): React.ReactElement {
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
