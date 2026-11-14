import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { ipPoolsApi, type IpPoolDetail } from '@kube-ai-hub/api-client';
import { workloadsApi } from '@/api';
import { AiSurface, Badge, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { formatTimestamp } from '@/lib/time';

/**
 * Pod IP 池详情.
 *
 * The old console's detail page has two tabs: which workspaces are drawing from the pool
 * (with how many addresses each holds), and the pods that currently use it. Both answer
 * "can I hand this pool to another workspace", which the list row cannot.
 *
 * The workspace figures are one read — the object reports them under `status.workspaces` —
 * so this is not a second query. The pods are a filtered list, linked rather than embedded:
 * the cluster-level pod page already exists and can be filtered by pool, and embedding a
 * six-row preview would duplicate it.
 */
export interface IpPoolDetailPageProps {
  cluster: string;
}

export function IpPoolDetailPage({ cluster }: IpPoolDetailPageProps): React.ReactElement {
  const t = useT();
  const { name } = useParams({ from: '/kube-frontend/clusters/$cluster/ippools/$name' });

  const query = useQuery({
    queryKey: ['ip-pool-detail', cluster, name],
    queryFn: ({ signal }) => ipPoolsApi(apiClient).get({ cluster, namespace: "", name, signal }),
  });

  /*
   * Pods using the pool. The pool stamps each pod with
   * `ippool.network.kubesphere.io/name`, so this is one fieldSelector instead of reading
   * every pod in the cluster and filtering here.
   */
  const pods = useQuery({
    queryKey: ['ip-pool-pods', cluster, name],
    queryFn: ({ signal }) =>
      workloadsApi(apiClient, 'pods').list({
        cluster,
        namespace: '',
        page: 1,
        pageSize: 20,
        fieldSelector: `ippool.network.kubesphere.io/name=${name}`,
        signal,
      }),
  });

  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';
  const pool = query.data as IpPoolDetail | undefined;
  const usage = pool?.workspaceUsage ?? [];

  return (
    <AiSurface as="section" aiId="ip-pool-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <Link to="/kube-frontend/clusters/$cluster/ippools" params={{ cluster }} className="text-sm text-ai-accent hover:underline">
          ← {t('cluster.network.ipPools.title')}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-ai-fg" data-ai-id="ip-pool-detail:name">
            {pool?.alias || name}
          </h1>
          {pool?.isDefault ? <Badge tone="info">{t('cluster.network.ipPools.default')}</Badge> : null}
          {pool?.disabled ? <Badge tone="neutral">{t('cluster.network.ipPools.disabled')}</Badge> : null}
        </div>
      </header>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="ip-pool-detail:retry" />
      ) : null}

      {pool ? (
        <React.Fragment>
          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="ip-pool-detail:basic">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('cluster.network.ipPools.detail.basic')}</h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <DefinitionRow label={t('cluster.network.ipPools.cidr')} value={pool.cidr || '-'} />
              <DefinitionRow
                label={t('cluster.network.ipPools.range')}
                value={pool.rangeStart || pool.rangeEnd ? `${pool.rangeStart || '?'} ~ ${pool.rangeEnd || '?'}` : '-'}
              />
              <DefinitionRow
                label={t('cluster.network.ipPools.usage')}
                value={pool.capacity > 0 ? `${pool.used} / ${pool.capacity}` : String(pool.used)}
                aiId="ip-pool-detail:usage"
              />
              <DefinitionRow label={t('cluster.network.ipPools.blockSize')} value={pool.blockSize > 0 ? String(pool.blockSize) : '-'} />
              <DefinitionRow label={t('cluster.network.ipPools.gateway')} value={pool.gateway || '-'} />
              <DefinitionRow label={t('cluster.column.workspace')} value={pool.workspace || '-'} />
              <DefinitionRow label={t('cluster.column.createdAt')} value={formatTimestamp(pool.createdAt)} />
            </dl>
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="ip-pool-detail:workspaces">
            <h2 className="mb-1 text-sm font-medium text-ai-fg">{t('cluster.network.ipPools.detail.workspaces')}</h2>
            <p className="mb-3 text-xs text-ai-fg-muted">{t('cluster.network.ipPools.detail.workspacesHint')}</p>
            {usage.length === 0 ? (
              <p className="text-sm text-ai-fg-muted" data-ai-id="ip-pool-detail:workspaces-empty">
                {t('cluster.network.ipPools.detail.workspacesEmpty')}
              </p>
            ) : (
              <ul className="flex flex-col gap-2" data-ai-id="ip-pool-detail:workspaces-list">
                {usage.map((entry) => (
                  <li
                    key={entry.workspace}
                    className="flex items-center justify-between gap-3 rounded-ai-sm border border-ai-line px-3 py-2 text-xs"
                    data-ai-row={entry.workspace}
                  >
                    <span className="truncate font-medium text-ai-fg-secondary">{entry.workspace}</span>
                    <span className="tabular-nums text-ai-fg-muted">
                      {t('cluster.network.ipPools.detail.allocations', { count: entry.allocations })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="ip-pool-detail:pods">
            <h2 className="mb-1 text-sm font-medium text-ai-fg">{t('cluster.network.ipPools.detail.pods')}</h2>
            <p className="mb-3 text-xs text-ai-fg-muted">{t('cluster.network.ipPools.detail.podsHint')}</p>
            {pods.isPending ? (
              <Skeleton className="h-16 w-full" />
            ) : pods.isError ? (
              <p className="text-xs text-ai-fg-muted">{t('cluster.network.ipPools.detail.podsUnavailable')}</p>
            ) : (pods.data?.items ?? []).length === 0 ? (
              <p className="text-sm text-ai-fg-muted" data-ai-id="ip-pool-detail:pods-empty">
                {t('cluster.network.ipPools.detail.podsEmpty')}
              </p>
            ) : (
              <ul className="flex flex-col gap-2" data-ai-id="ip-pool-detail:pods-list">
                {(pods.data?.items ?? []).map((pod) => {
                  const row = pod as { name: string; namespace: string; status?: string; podIP?: string };
                  return (
                    <li
                      key={`${row.namespace}/${row.name}`}
                      className="flex items-center justify-between gap-3 rounded-ai-sm border border-ai-line px-3 py-2 text-xs"
                      data-ai-row={row.name}
                    >
                      <span className="truncate font-medium text-ai-fg-secondary">{row.name}</span>
                      <span className="truncate text-ai-fg-muted">{row.namespace}</span>
                      <span className="truncate font-mono text-[11px] text-ai-fg-muted">{row.podIP || '-'}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </React.Fragment>
      ) : null}
    </AiSurface>
  );
}
