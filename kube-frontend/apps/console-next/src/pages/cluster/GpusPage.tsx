import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { gpusApi, type GpuDevice } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, ResourceList, type ListSchema } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatGpuMemory, gpuHealthTone } from './gpuFormat';

/**
 * 集群显卡.
 *
 * One row per physical card, not per schedulable unit: the question is "which cards
 * are in this machine and can each of them be handed out", which the allocatable
 * count cannot answer. The old console's cluster page groups by vendor/model and
 * shows a health ring; this page keeps the rows and the health ratio, and drops
 * the grouping because the table is already sorted by node then index.
 *
 * Health is a verdict, not a computation: HAMi's device plugin decides it, gpu-agent
 * writes the summary into `hami.io/node-gpu-info`, and the API reports it as a bool.
 * The page never derives it from capacity or XID events.
 */
export interface GpusPageProps {
  cluster: string;
}

export function GpusPage({ cluster }: GpusPageProps): React.ReactElement {
  const t = useT();

  /*
   * One request for every card.
   *
   * `limit=-1` rather than a pager: the cluster list is bounded by the number of
   * cards in the machines (15 on B200), and the page's row count has to equal the
   * interface's item count for the acceptance case. If a cluster ever grows past a
   * few hundred cards this becomes a paged list.
   */
  const devices = useQuery({
    queryKey: ['cluster-gpus', cluster],
    queryFn: ({ signal }) => gpusApi(apiClient).list({ cluster, limit: -1, signal }),
    staleTime: 30_000,
  });

  /*
   * The overview totals come from the API's own stats endpoint, not from summing the
   * rows above: the list may be filtered or paged one day, and a sum of the visible
   * page would then silently describe only that page. The endpoint aggregates the same
   * cache the list reads, so the two cannot disagree.
   */
  const stats = useQuery({
    queryKey: ['cluster-gpus-stats', cluster],
    queryFn: ({ signal }) => gpusApi(apiClient).stats({ cluster, signal }),
    staleTime: 30_000,
    retry: false,
  });

  const rows = devices.data?.items ?? [];
  const state = devices.isPending ? 'loading' : devices.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  const schema = React.useMemo<ListSchema<GpuDevice>>(
    () => ({
      rowKey: 'uuid',
      rowAttributes: (row) => ({
        'data-ai-row': row.uuid,
        // The acceptance case targets one row by UUID; `data-ai-row` alone would make
        // an agent guess which attribute is the handle.
        'data-ai-id': `cluster-gpus:row:${row.uuid}`,
      }),
      columns: [
        {
          key: 'node',
          title: t('cluster.gpu.column.node'),
          width: 170,
          render: (row) => (
            <span className="flex min-w-0 flex-col">
              <Link
                to="/kube-frontend/clusters/$cluster/nodes/$name"
                params={{ cluster, name: row.node }}
                className="truncate font-medium text-ai-accent hover:underline"
                {...actionProps(`cluster-gpus:node:${row.node}`)}
              >
                {row.node || '-'}
              </Link>
              <span className="truncate text-[11px] text-ai-fg-muted">{row.nodeIP || '-'}</span>
            </span>
          ),
        },
        {
          key: 'index',
          title: t('cluster.gpu.column.index'),
          width: 80,
          render: (row) => <span className="tabular-nums text-ai-fg-secondary">{row.index}</span>,
        },
        {
          key: 'uuid',
          title: t('cluster.gpu.column.uuid'),
          render: (row) => (
            <Link
              to="/kube-frontend/clusters/$cluster/gpus/$name"
              params={{ cluster, name: row.uuid }}
              className="truncate font-mono text-[11px] text-ai-accent hover:underline"
              {...actionProps(`cluster-gpus:uuid:${row.uuid}`)}
            >
              {row.uuid}
            </Link>
          ),
        },
        {
          key: 'health',
          title: t('cluster.column.status'),
          width: 110,
          render: (row) => (
            <Badge tone={gpuHealthTone(row)}>
              {row.health ? t('cluster.gpu.healthy') : t('cluster.gpu.unhealthy')}
            </Badge>
          ),
        },
        {
          key: 'model',
          title: t('cluster.gpu.column.model'),
          width: 140,
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.model || '-'}</span>,
        },
        {
          key: 'memory',
          title: t('cluster.gpu.column.memory'),
          width: 210,
          hideBelow: 'md',
          render: (row) => (
            <span className="tabular-nums text-ai-fg-secondary">
              {formatGpuMemory(row.memoryUsedMiB)} / {formatGpuMemory(row.memoryTotalMiB)}
            </span>
          ),
        },
        {
          key: 'vendor',
          title: t('cluster.gpu.column.vendor'),
          width: 120,
          hideBelow: 'lg',
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.vendor || '-'}</span>,
        },
      ],
      empty: { title: t('cluster.gpu.emptyTitle'), description: t('cluster.gpu.emptyDescription') },
      labels: {
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      // One page, sized to the rows: there is no pager to wire, and a declared pager
      // whose page cannot change is the dead control the list contract tests for.
      pagination: { page: 1, pageSize: Math.max(rows.length, 10), total: rows.length },
    }),
    [cluster, rows.length, t],
  );

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="cluster-gpus:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={devices.error} onRetry={() => void devices.refetch()} retryAiId="cluster-gpus:retry" />
      </AiSurface>
    );
  }

  const health = stats.data;
  const percent = health && health.total > 0 ? Math.round((health.healthy / health.total) * 100) : 0;

  return (
    <AiSurface as="section" aiId="cluster-gpus:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-ai-fg">{t('cluster.gpu.title')}</h1>
        <p className="text-xs text-ai-fg-muted">{t('cluster.gpu.description')}</p>
      </header>

      {/*
        The health ratio is server-side (`/gpus/stats`), so it stays correct if the
        table is ever filtered or paged. The data attributes expose the two numbers
        the ratio is built from, for agents that must not parse the badge text.
      */}
      {health ? (
        <div
          className="flex flex-wrap items-center gap-3 rounded-lg border border-ai-border bg-ai-surface p-3 text-xs"
          data-ai-id="cluster-gpus:health"
          data-ai-total={String(health.total)}
          data-ai-healthy={String(health.healthy)}
        >
          <Badge tone={health.total > 0 && health.healthy === health.total ? 'success' : health.healthy === 0 ? 'danger' : 'warning'}>
            {t('cluster.gpu.health')} {percent}%
          </Badge>
          <span className="text-ai-fg-secondary">
            {t('cluster.gpu.summary', { healthy: health.healthy, total: health.total })}
          </span>
          {health.byModel.map((entry) => (
            <span key={`${entry.vendor}-${entry.model}`} className="font-mono text-[11px] text-ai-fg-muted">
              {entry.vendor ? `${entry.vendor}-${entry.model}` : entry.model} × {entry.count}
            </span>
          ))}
        </div>
      ) : null}

      <ResourceList schema={schema} rows={rows} loading={state === 'loading'} />
    </AiSurface>
  );
}
