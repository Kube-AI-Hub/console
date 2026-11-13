import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { nodesApi, type NodeDetail } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { formatTimestamp } from '@/lib/time';
import { formatQuantity } from '@/lib/quantity';

/**
 * 节点详情.
 *
 * The list answers "which nodes are healthy"; this answers "what is this node" — its
 * conditions, what it can allocate, its labels and taints. Those are the four facts an
 * operator needs before cordoning or troubleshooting one, and none of them fit a row.
 *
 * The old console's node detail also has tabs for pods, per-node monitoring and events.
 * Those need a pod list filtered by node and per-node metric queries; they are recorded
 * as not migrated rather than shown as empty tabs.
 */
export interface NodeDetailPageProps {
  cluster: string;
}

export function NodeDetailPage({ cluster }: NodeDetailPageProps): React.ReactElement {
  const t = useT();
  const { name } = useParams({ from: '/kube-frontend/clusters/$cluster/nodes/$name' });

  const query = useQuery({
    queryKey: ['node-detail', cluster, name],
    queryFn: ({ signal }) => nodesApi(apiClient).get({ name, cluster, namespace: '', signal }),
  });

  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';
  const node = query.data as NodeDetail | undefined;

  return (
    <AiSurface as="section" aiId="node-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Link to="/kube-frontend/clusters/$cluster/nodes" params={{ cluster }} className="text-sm text-ai-accent hover:underline">
            ← {t('cluster.nodes.title')}
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-ai-fg">{name}</h1>
          {node ? (
            <Badge tone={node.status === 'Ready' ? 'success' : 'danger'}>{node.status}</Badge>
          ) : null}
        </div>
      </header>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="node-detail:retry" />
      ) : null}

      {node ? (
        <React.Fragment>
          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="node-detail:basic">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('node.detail.basic')}</h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <DefinitionRow label={t('cluster.column.status')} value={node.status} />
              <DefinitionRow label={t('cluster.column.role')} value={node.role} />
              <DefinitionRow label={t('node.detail.kubeletVersion')} value={node.nodeInfo.kubeletVersion || '-'} />
              <DefinitionRow label={t('node.detail.internalIP')} value={node.internalIP || '-'} />
              <DefinitionRow label={t('node.detail.osImage')} value={node.nodeInfo.osImage || '-'} />
              <DefinitionRow label={t('node.detail.kernel')} value={node.nodeInfo.kernelVersion || '-'} />
              <DefinitionRow label={t('node.detail.runtime')} value={node.nodeInfo.containerRuntimeVersion || '-'} />
              <DefinitionRow label={t('node.detail.createdAt')} value={formatTimestamp(node.createdAt)} />
            </dl>
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="node-detail:capacity">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('node.detail.capacity')}</h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              {['cpu', 'memory', 'pods', 'ephemeral-storage'].map((key) => (
                <DefinitionRow
                  key={key}
                  label={key}
                  value={`${formatQuantity(key, node.allocatable[key] ?? '')} / ${formatQuantity(key, node.capacity[key] ?? '')}`}
                />
              ))}
            </dl>
            <p className="mt-2 text-[11px] text-ai-fg-muted">{t('node.detail.capacityHint')}</p>
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="node-detail:conditions">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('node.detail.conditions')}</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {node.conditions.map((condition) => (
                <li key={condition.type} className="flex flex-wrap items-baseline gap-2" data-ai-id={`node-detail:condition:${condition.type}`}>
                  <Badge tone={condition.status === 'True' ? 'success' : 'neutral'}>{condition.status}</Badge>
                  <span className="font-medium text-ai-fg">{condition.type}</span>
                  {condition.message ? <span className="text-xs text-ai-fg-muted">{condition.message}</span> : null}
                  {condition.lastTransitionTime ? (
                    <span className="text-[11px] text-ai-fg-faint">{formatTimestamp(condition.lastTransitionTime)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="node-detail:labels">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('node.detail.labels')}</h2>
            <ul className="flex flex-wrap gap-1">
              {Object.entries(node.labels).map(([key, value]) => (
                <li key={key} className="max-w-full truncate rounded-ai-md bg-ai-surface-2 px-2 py-0.5 text-[11px] text-ai-fg-secondary" title={`${key}=${value}`}>
                  {key}={value}
                </li>
              ))}
            </ul>
            <h2 className="mb-3 mt-4 text-sm font-medium text-ai-fg">{t('node.detail.taints')}</h2>
            {node.taints.length === 0 ? (
              <p className="text-xs text-ai-fg-muted">{t('node.detail.noTaints')}</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {node.taints.map((taint) => (
                  <li key={`${taint.key}-${taint.effect}`} className="text-ai-fg-secondary">
                    {taint.key}{taint.value ? `=${taint.value}` : ''}:{taint.effect}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </React.Fragment>
      ) : null}
    </AiSurface>
  );
}