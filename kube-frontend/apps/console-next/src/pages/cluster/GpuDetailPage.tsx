import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { gpusApi } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { formatGpuMemory, gpuHealthTone } from './gpuFormat';

/**
 * 单卡详情.
 *
 * The URL parameter is the card UUID. There is no per-card endpoint (`/gpus/<uuid>`
 * is a 404), so the read is the cluster list filtered by `uuid`; the API already
 * knows the node from its cache and returns it on the item, which is why this page
 * needs no second request to resolve the node name.
 *
 * A UUID that is no longer reported means the card was removed from the node (or
 * the device plugin stopped reporting it). That is shown as an explicit message,
 * not as an empty page: a blank detail page is indistinguishable from a broken read.
 */
export interface GpuDetailPageProps {
  cluster: string;
}

export function GpuDetailPage({ cluster }: GpuDetailPageProps): React.ReactElement {
  const t = useT();
  const { name } = useParams({ from: '/kube-frontend/clusters/$cluster/gpus/$name' });

  const query = useQuery({
    queryKey: ['gpu-detail', cluster, name],
    queryFn: ({ signal }) => gpusApi(apiClient).get({ cluster, uuid: name, signal }),
  });

  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';
  // `null` is the API's "this UUID is not reported any more" answer, not a failure.
  const gpu = query.data ?? null;

  return (
    <AiSurface as="section" aiId="gpu-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <Link
          to="/kube-frontend/clusters/$cluster/gpus"
          params={{ cluster }}
          className="text-sm text-ai-accent hover:underline"
          {...actionProps('gpu-detail:back')}
        >
          ← {t('cluster.gpu.title')}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="break-all font-mono text-lg font-semibold text-ai-fg" data-ai-id="gpu-detail:uuid">
            {gpu?.uuid || name}
          </h1>
          {gpu ? (
            <span data-ai-id="gpu-detail:health">
              <Badge tone={gpuHealthTone(gpu)}>
                {gpu.health ? t('cluster.gpu.healthy') : t('cluster.gpu.unhealthy')}
              </Badge>
            </span>
          ) : null}
        </div>
      </header>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="gpu-detail:retry" />
      ) : null}
      {state === 'ready' && !gpu ? (
        <p className="text-sm text-ai-fg-muted" data-ai-id="gpu-detail:missing">
          {t('cluster.gpu.detail.notFound')}
        </p>
      ) : null}

      {gpu ? (
        <React.Fragment>
          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="gpu-detail:basic">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('cluster.gpu.detail.basic')}</h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <DefinitionRow
                label={t('cluster.gpu.detail.health')}
                value={
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone={gpuHealthTone(gpu)}>
                      {gpu.health ? t('cluster.gpu.healthy') : t('cluster.gpu.unhealthy')}
                    </Badge>
                    <span className="text-[11px] text-ai-fg-muted">{t('cluster.gpu.detail.healthHint')}</span>
                  </span>
                }
              />
              <DefinitionRow
                label={t('cluster.gpu.detail.node')}
                aiId="gpu-detail:node"
                value={
                  <Link
                    to="/kube-frontend/clusters/$cluster/nodes/$name"
                    params={{ cluster, name: gpu.node }}
                    className="text-ai-accent hover:underline"
                    {...actionProps(`gpu-detail:node-link:${gpu.node}`)}
                  >
                    {gpu.node || '-'}
                  </Link>
                }
              />
              <DefinitionRow label={t('cluster.gpu.detail.nodeIP')} value={gpu.nodeIP || '-'} />
              <DefinitionRow label={t('cluster.gpu.detail.uuid')} value={gpu.uuid || '-'} />
              <DefinitionRow label={t('cluster.gpu.detail.index')} value={String(gpu.index)} />
              <DefinitionRow label={t('cluster.gpu.detail.model')} value={gpu.model || '-'} />
              <DefinitionRow label={t('cluster.gpu.detail.vendor')} value={gpu.vendor || '-'} />
              <DefinitionRow
                label={t('cluster.gpu.detail.numa')}
                value={gpu.numa === undefined ? '-' : String(gpu.numa)}
              />
              <DefinitionRow label={t('cluster.gpu.detail.mode')} value={gpu.mode || '-'} />
            </dl>
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="gpu-detail:usage">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('cluster.gpu.detail.utilization')}</h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <DefinitionRow
                label={t('cluster.gpu.detail.memory')}
                aiId="gpu-detail:memory"
                value={
                  <span className="tabular-nums">
                    {formatGpuMemory(gpu.memoryUsedMiB)} / {formatGpuMemory(gpu.memoryTotalMiB)}
                  </span>
                }
                hint={gpu.memoryTotalMiB > 0 ? `${Math.round((gpu.memoryUsedMiB / gpu.memoryTotalMiB) * 100)}%` : undefined}
              />
              <DefinitionRow
                label={t('cluster.gpu.detail.core')}
                aiId="gpu-detail:core"
                value={
                  <span className="tabular-nums">
                    {gpu.coreUsed} / {gpu.coreTotal}
                  </span>
                }
                hint={gpu.coreTotal > 0 ? `${Math.round((gpu.coreUsed / gpu.coreTotal) * 100)}%` : undefined}
              />
              <DefinitionRow label={t('cluster.gpu.detail.vgpu')} value={`${gpu.vgpuUsed} / ${gpu.vgpuTotal}`} />
            </dl>
          </section>
        </React.Fragment>
      ) : null}
    </AiSurface>
  );
}
