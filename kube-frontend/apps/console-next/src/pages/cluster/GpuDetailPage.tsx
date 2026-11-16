import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { gpusApi } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Button, Skeleton, Tabs, TabsContent } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { formatGpuMemory, gpuHealthTone } from './gpuFormat';
import { GPU_VENDOR_LABEL_KEYS, vendorKey } from './gpuVendors';
import { GPU_MODES } from './gpuModeConfig';
import { GpuMonitorPanel } from './GpuMonitorPanel';
import { GpuPodsPanel } from './GpuPodsPanel';
import { NodeResourcesPanel } from './NodeResourcesPanel';

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
  const [tab, setTab] = React.useState('overview');
  React.useEffect(() => setTab('overview'), [cluster, name]);

  const query = useQuery({
    queryKey: ['gpu-detail', cluster, name],
    queryFn: ({ signal }) => gpusApi(apiClient).get({ cluster, uuid: name, signal }),
  });

  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';
  // `null` is the API's "this UUID is not reported any more" answer, not a failure.
  const gpu = query.data ?? null;
  const vendor = vendorKey(gpu?.vendor ?? '');
  const mode = GPU_MODES[gpu?.vendor.toLowerCase() ?? '']?.find((entry) => entry.value === gpu?.mode);

  return (
    <AiSurface as="section" aiId="gpu-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <Link
          to="/kube-frontend/clusters/$cluster/gpus"
          params={{ cluster }}
          className="text-sm text-ai-link hover:underline"
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
          <Button size="sm" variant="secondary" data-ai-id="gpu-detail:refresh" disabled={query.isFetching}
            onClick={() => void query.refetch()}>{t('common.refresh')}</Button>
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
        <Tabs value={tab} onValueChange={setTab} items={[
          { value: 'overview', label: t('node.detail.statusTab'), aiId: 'gpu-detail:tab:overview' },
          { value: 'pods', label: t('cluster.workloads.pods.title'), aiId: 'gpu-detail:tab:pods' },
          { value: 'monitor', label: t('node.detail.monitor'), aiId: 'gpu-detail:tab:monitor' },
          { value: 'events', label: t('node.detail.events'), aiId: 'gpu-detail:tab:events' },
        ]}>
          <TabsContent value="overview" className="flex flex-col gap-4">
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
                    className="text-ai-link hover:underline"
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
              <DefinitionRow label={t('cluster.gpu.detail.vendor')} value={vendor ? t(GPU_VENDOR_LABEL_KEYS[vendor]) : gpu.vendor || '-'} />
              <DefinitionRow
                label={t('cluster.gpu.detail.numa')}
                value={gpu.numa === undefined ? '-' : String(gpu.numa)}
              />
              <DefinitionRow label={t('cluster.gpu.detail.mode')} value={mode ? t(mode.labelKey) : gpu.mode || '-'} />
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
                    {gpu.memoryTotalMiB > 0 ? `${formatGpuMemory(gpu.memoryUsedMiB)} / ${formatGpuMemory(gpu.memoryTotalMiB)}` : '-'}
                  </span>
                }
                hint={gpu.memoryTotalMiB > 0 ? `${Math.round((gpu.memoryUsedMiB / gpu.memoryTotalMiB) * 100)}%` : undefined}
              />
              <DefinitionRow
                label={t('cluster.gpu.detail.core')}
                aiId="gpu-detail:core"
                value={
                  <span className="tabular-nums">
                    {gpu.coreTotal > 0 ? `${gpu.coreUsed} / ${gpu.coreTotal}` : '-'}
                  </span>
                }
                hint={gpu.coreTotal > 0 ? `${Math.round((gpu.coreUsed / gpu.coreTotal) * 100)}%` : undefined}
              />
              <DefinitionRow label={t('cluster.gpu.detail.vgpu')} value={gpu.vgpuTotal > 0 ? `${gpu.vgpuUsed} / ${gpu.vgpuTotal}` : '-'} />
            </dl>
          </section>
          </TabsContent>
          <TabsContent value="pods">{tab === 'pods' ? <GpuPodsPanel cluster={cluster} node={gpu.node} uuid={gpu.uuid} /> : null}</TabsContent>
          <TabsContent value="monitor">{tab === 'monitor' ? <GpuMonitorPanel cluster={cluster} node={gpu.node} uuid={gpu.uuid} /> : null}</TabsContent>
          <TabsContent value="events">{tab === 'events' ? <div className="flex flex-col gap-3">
            <p className="text-xs text-ai-fg-muted">{t('gpu.detail.eventsHint')}</p>
            <NodeResourcesPanel cluster={cluster} node={gpu.node} kind="events" />
          </div> : null}</TabsContent>
        </Tabs>
      ) : null}
    </AiSurface>
  );
}
