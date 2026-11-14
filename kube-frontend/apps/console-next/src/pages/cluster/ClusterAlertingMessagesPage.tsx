import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { clusterAlertMessagesApi, type ClusterAlertSummary } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, Modal, ResourceList, type ListSchema } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { alertSeverityLabel, alertSourceLabel, alertStateLabel } from './alertingHelpers';

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

const PAGE_SIZE = 20;

export function ClusterAlertingMessagesPage({ cluster }: ClusterAlertingMessagesPageProps): React.ReactElement {
  const t = useT();
  const [page, setPage] = React.useState(1);

  const query = useQuery({
    queryKey: ['cluster-alert-messages', cluster, page],
    queryFn: ({ signal }) => clusterAlertMessagesApi(apiClient).list({ page, pageSize: PAGE_SIZE, signal }),
  });

  const rows = query.data?.items ?? [];
  const total = query.data?.total ?? 0;

  const schema = React.useMemo<ListSchema<ClusterAlertSummary>>(
    () => ({
      title: t('cluster.alerting.messages.title'),
      description: t('cluster.alerting.messages.description'),
      rowKey: 'id',
      rowAttributes: (row) => ({ 'data-ai-row': row.id }),
      sortableKeys: [],
      columns: [
        {
          key: 'summary',
          title: t('monitoring.column.message'),
          render: (row) => (
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-ai-fg" title={row.summary || row.name}>
                {row.summary || row.name || '-'}
              </span>
              <span className="truncate text-[11px] text-ai-fg-muted">{row.message || '-'}</span>
            </span>
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
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      pagination: { page, pageSize: PAGE_SIZE, total },
    }),
    [page, t, total],
  );

  const [detail, setDetail] = React.useState<ClusterAlertSummary | null>(null);
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  if (state === 'error') {
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
    <AiSurface as="section" aiId="cluster-alerting-messages:surface" state={state} className="min-w-0">
      <ResourceList
        schema={schema}
        rows={rows}
        loading={state === 'loading'}
        onPageChange={setPage}
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
        {detail ? <MessageDetail row={detail} /> : null}
      </Modal>
    </AiSurface>
  );
}

/** One message's fields, all already present on the list row. */
function MessageDetail({ row }: { row: ClusterAlertSummary }): React.ReactElement {
  const t = useT();
  const entries: Array<[string, string]> = [
    [t('monitoring.field.name'), row.name || '-'],
    [t('monitoring.column.message'), row.summary || '-'],
    [t('monitoring.field.message'), row.message || '-'],
    [t('monitoring.field.state'), alertStateLabel(t, row.state)],
    [t('monitoring.field.severity'), alertSeverityLabel(t, row.severity)],
    [t('monitoring.field.rule'), row.ruleGroup || '-'],
    [t('cluster.alerting.column.source'), alertSourceLabel(t, row.source)],
    [t('monitoring.field.target'), row.target || '-'],
    [t('monitoring.field.triggeredAt'), formatTimestamp(row.triggeredAt)],
  ];
  return (
    <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-[minmax(6rem,auto)_1fr]" data-ai-id="cluster-alerting-messages:detail">
      {entries.map(([label, value], index) => (
        <React.Fragment key={`${label}-${index}`}>
          <dt className="text-ai-fg-muted">{label}</dt>
          <dd className="min-w-0 break-words text-ai-fg-secondary">{value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
