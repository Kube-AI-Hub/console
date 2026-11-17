import * as React from 'react';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Empty, Icon, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { projectObjectUrl, useClusterProjectIndex } from './useClusterProjectIndex';
import { useGatewayDetail } from './gatewayDetailQueries';

/**
 * 集群网关详情.
 *
 * The gateway is one nginx release in the cluster: its Nginx/Gateway CRs say what
 * was asked for and whether it installed, the Service says where clients reach
 * it, and the Ingresses whose `ingressClassName` matches the controller's class
 * are the routes it serves. Read-only — installing, editing or deleting the
 * gateway belongs to the cluster administrator's install flow.
 */
export interface GatewayDetailPageProps {
  cluster: string;
  name: string;
}

export function GatewayDetailPage({ cluster, name }: GatewayDetailPageProps): React.ReactElement {
  const t = useT();
  const query = useGatewayDetail(cluster, name);
  const workspaceOf = useClusterProjectIndex(cluster);
  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';
  const detail = query.data?.detail;
  const ingresses = query.data?.ingresses ?? [];
  const resourceStatus = query.data?.resourceStatus;
  const logs = query.data?.logs;
  const monitoring = query.data?.monitoring;

  const formatBytes = (bytes: number): string => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0';
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
    let scaled = bytes;
    let unit = 0;
    while (scaled >= 1024 && unit < units.length - 1) {
      scaled /= 1024;
      unit += 1;
    }
    return (scaled < 10 ? scaled.toFixed(1) : Math.round(scaled).toString()) + ' ' + units[unit];
  };

  const backHref = '/kube-frontend/clusters/' + encodeURIComponent(cluster) + '/gateways/cluster';

  return (
    <AiSurface as="section" aiId="gateway-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <div>
        <a
          href={backHref}
          className="inline-flex items-center gap-1 text-xs text-ai-link hover:underline"
          {...actionProps('gateway-detail:back')}
        >
          <Icon name="chevron-left" size={12} />
          {t('cluster.clusterGateways.title')}
        </a>
      </div>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="gateway-detail:retry" />
      ) : null}

      {detail ? (
        <React.Fragment>
          <header className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-lg font-semibold text-ai-fg">{detail.name}</h1>
            <Badge tone={detail.ready ? 'success' : 'warning'}>
              {t(detail.ready ? 'settings.gateway.ready' : 'settings.gateway.pending')}
            </Badge>
          </header>

          <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="gateway-detail:attributes">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('cluster.clusterGateways.detail.attributes')}</h2>
            <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-[minmax(7rem,auto)_1fr]">
              <DefinitionRow label={t('cluster.clusterGateways.detail.namespace')} value={detail.namespace || '-'} />
              <DefinitionRow
                label={t('cluster.clusterGateways.detail.scope')}
                value={t('cluster.clusterGateways.detail.clusterScope')}
              />
              <DefinitionRow label={t('settings.gateway.type')} value={detail.type || '-'} />
              <DefinitionRow label={t('cluster.clusterGateways.detail.ingressClass')} value={detail.ingressClass || '-'} />
              <DefinitionRow
                label={t('cluster.clusterGateways.detail.address')}
                value={detail.address || t('cluster.clusterGateways.detail.addressEmpty')}
              />
              <DefinitionRow
                label={t('cluster.clusterGateways.detail.ports')}
                value={
                  detail.ports.length > 0
                    ? detail.ports
                        .map((port) => {
                          const name = port.name || String(port.port);
                          const nodePort = port.nodePort ? ' / NodePort ' + port.nodePort : '';
                          return name + ' ' + port.port + nodePort;
                        })
                        .join('; ')
                    : '-'
                }
              />
              <DefinitionRow label={t('cluster.clusterGateways.detail.clusterIP')} value={detail.clusterIP || '-'} />
              <DefinitionRow
                label={t('cluster.clusterGateways.detail.tls')}
                value={detail.tls ? t('cluster.clusterGateways.detail.tlsHint') : t('cluster.clusterGateways.detail.tlsOff')}
              />
              <DefinitionRow label={t('cluster.clusterGateways.detail.replicas')} value={detail.replicas || '-'} />
              <DefinitionRow label={t('cluster.clusterGateways.detail.image')} value={detail.image || '-'} />
              <DefinitionRow label={t('cluster.column.createdAt')} value={formatTimestamp(detail.createdAt)} />
              <DefinitionRow label={t('cluster.clusterGateways.detail.creator')} value={detail.creator || '-'} />
              <DefinitionRow
                label={t('cluster.clusterGateways.detail.tracing')}
                value={t(detail.tracing ? 'cluster.clusterGateways.detail.tracingOn' : 'cluster.clusterGateways.detail.tracingOff')}
              />
              {detail.conditions.length > 0 ? (
                <DefinitionRow
                  label={t('cluster.clusterGateways.detail.conditions')}
                  value={detail.conditions
                    .map((condition) => condition.type + '=' + condition.status)
                    .join(', ')}
                />
              ) : null}
            </dl>
            {detail.config.length > 0 ? (
              <dl className="mt-3 grid grid-cols-1 gap-2 border-t border-ai-line pt-3 text-xs sm:grid-cols-2" data-ai-id="gateway-detail:config">
                {detail.config.map((entry) => (
                  <React.Fragment key={entry.key}>
                    <dt className="text-ai-fg-muted">{entry.key}</dt>
                    <dd className="break-all text-ai-fg-secondary">{entry.value || '-'}</dd>
                  </React.Fragment>
                ))}
              </dl>
            ) : null}
          </section>

          <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="gateway-detail:ingresses">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('cluster.clusterGateways.detail.ingresses')}</h2>
            {ingresses.length === 0 ? (
              <Empty
                data-ai-id="gateway-detail:ingresses-empty"
                title={t('cluster.clusterGateways.detail.ingressesEmpty')}
                description={t('cluster.clusterGateways.detail.ingressesEmptyHint')}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-ai-line text-left text-ai-fg-muted">
                      <th className="py-2 pr-3 font-medium">{t('storage.column.name')}</th>
                      <th className="py-2 pr-3 font-medium">{t('cluster.clusterGateways.detail.namespace')}</th>
                      <th className="py-2 pr-3 font-medium">{t('cluster.clusterGateways.detail.hosts')}</th>
                      <th className="py-2 pr-3 font-medium">{t('storage.column.status')}</th>
                      <th className="py-2 font-medium">{t('cluster.column.createdAt')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ingresses.map((ingress) => {
                      const handle = ingress.namespace + '/' + ingress.name;
                      return (
                        <tr key={handle} data-ai-row={handle} data-ai-id={'gateway-detail:ingress:' + handle} className="border-b border-ai-line last:border-b-0">
                          <td className="py-2 pr-3">
                            <a
                              href={projectObjectUrl({
                                cluster,
                                workspace: workspaceOf.get(ingress.namespace) ?? 'public',
                                namespace: ingress.namespace,
                                page: 'ingresses',
                                name: ingress.name,
                              })}
                              className="font-medium text-ai-link hover:underline"
                              data-ai-id={'gateway-detail:ingress:' + handle + ':open'}
                            >
                              {ingress.name}
                            </a>
                          </td>
                          <td className="py-2 pr-3 text-ai-fg-secondary">{ingress.namespace || '-'}</td>
                          <td className="py-2 pr-3 font-mono text-[11px] text-ai-fg-secondary">{ingress.hosts.join(', ') || '-'}</td>
                          <td className="py-2 pr-3">
                            <Badge tone={ingress.hasTLS ? 'info' : 'neutral'}>
                              {ingress.hasTLS ? t('cluster.clusterGateways.detail.tls') : '-'}
                            </Badge>
                          </td>
                          <td className="py-2 tabular-nums text-ai-fg-muted">{formatTimestamp(ingress.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="gateway-detail:monitoring">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('cluster.clusterGateways.detail.monitoring')}</h2>
            {monitoring ? (
              monitoring.available ? (
                <div className="flex flex-wrap gap-6">
                  <div data-ai-id="gateway-detail:monitor-cpu">
                    <p className="text-[11px] text-ai-fg-muted">{t('cluster.clusterGateways.detail.cpu')}</p>
                    <p className="mt-1 text-lg font-medium tabular-nums text-ai-fg">{monitoring.cpuCores.toFixed(3)}</p>
                  </div>
                  <div data-ai-id="gateway-detail:monitor-memory">
                    <p className="text-[11px] text-ai-fg-muted">{t('cluster.clusterGateways.detail.memory')}</p>
                    <p className="mt-1 text-lg font-medium tabular-nums text-ai-fg">{formatBytes(monitoring.memoryBytes)}</p>
                  </div>
                  {monitoring.ingressAvailable ? (
                    <>
                      <div data-ai-id="gateway-detail:monitor-requests">
                        <p className="text-[11px] text-ai-fg-muted">{t('cluster.clusterGateways.detail.requestRate')}</p>
                        <p className="mt-1 text-lg font-medium tabular-nums text-ai-fg">{monitoring.requestRate.toFixed(2)}/s</p>
                      </div>
                      <div data-ai-id="gateway-detail:monitor-errors">
                        <p className="text-[11px] text-ai-fg-muted">{t('cluster.clusterGateways.detail.errorRate')}</p>
                        <p className="mt-1 text-lg font-medium tabular-nums text-ai-fg">{monitoring.errorRate.toFixed(2)}/s</p>
                      </div>
                    </>
                  ) : (
                    <p className="self-center text-xs text-ai-fg-muted" data-ai-id="gateway-detail:monitor-ingress-unavailable">
                      {t('cluster.clusterGateways.detail.ingressMetricsUnavailable')}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-ai-fg-muted" data-ai-id="gateway-detail:monitor-unavailable">
                  {t('cluster.clusterGateways.detail.monitorUnavailable')}
                  {monitoring.reason ? <span className="ml-1 font-mono text-[11px]">({monitoring.reason})</span> : null}
                </p>
              )
            ) : null}
          </section>

          <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="gateway-detail:resource-status">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('cluster.clusterGateways.detail.resourceStatus')}</h2>
            {resourceStatus ? (
              <>
                <p className="text-xs text-ai-fg-secondary" data-ai-id="gateway-detail:resource-deployment">
                  {resourceStatus.deploymentName}: {resourceStatus.readyReplicas}/{resourceStatus.desiredReplicas} {t('cluster.clusterGateways.detail.readyReplicas')}
                </p>
                {resourceStatus.pods.length === 0 ? (
                  <p className="mt-2 text-xs text-ai-fg-muted" data-ai-id="gateway-detail:pods-empty">
                    {t('cluster.clusterGateways.detail.podsEmpty')}
                  </p>
                ) : (
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-xs" data-ai-id="gateway-detail:pods">
                      <thead>
                        <tr className="border-b border-ai-line text-left text-ai-fg-muted">
                          <th className="py-2 pr-3 font-medium">{t('storage.column.name')}</th>
                          <th className="py-2 pr-3 font-medium">{t('storage.column.status')}</th>
                          <th className="py-2 pr-3 font-medium">{t('cluster.clusterGateways.detail.ready')}</th>
                          <th className="py-2 pr-3 text-right font-medium">{t('cluster.clusterGateways.detail.restarts')}</th>
                          <th className="py-2 font-medium">{t('cluster.column.createdAt')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resourceStatus.pods.map((pod) => (
                          <tr key={pod.name} data-ai-row={pod.name} data-ai-id={'gateway-detail:pod:' + pod.name} className="border-b border-ai-line last:border-b-0">
                            <td className="py-2 pr-3 font-mono text-ai-fg-secondary">{pod.name}</td>
                            <td className="py-2 pr-3 text-ai-fg-secondary">{pod.phase}</td>
                            <td className="py-2 pr-3 text-ai-fg-secondary">{pod.ready ? 'Ready' : 'NotReady'}</td>
                            <td className="py-2 pr-3 text-right tabular-nums text-ai-fg-secondary">{pod.restarts}</td>
                            <td className="py-2 tabular-nums text-ai-fg-muted">{formatTimestamp(pod.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : null}
          </section>

          <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="gateway-detail:logs-section">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('cluster.clusterGateways.detail.logs')}</h2>
            {logs ? (
              logs.available ? (
                <>
                  <p className="text-[11px] text-ai-fg-muted" data-ai-id="gateway-detail:logs-meta">
                    {logs.pod} · {logs.container} · {t('cluster.clusterGateways.detail.tailLines')}
                  </p>
                  <pre className="mt-2 max-h-72 overflow-auto rounded-ai-sm bg-ai-surface-2 p-3 font-mono text-[11px] leading-5 text-ai-fg-secondary" data-ai-id="gateway-detail:logs">
                    {logs.text || t('cluster.clusterGateways.detail.logsEmpty')}
                  </pre>
                </>
              ) : (
                <p className="text-xs text-ai-fg-muted" data-ai-id="gateway-detail:logs-unavailable">
                  {t('cluster.clusterGateways.detail.logsUnavailable')}
                  {logs.reason ? <span className="ml-1 font-mono text-[11px]">({logs.reason})</span> : null}
                </p>
              )
            ) : null}
          </section>

          <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="gateway-detail:metadata">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('cluster.clusterGateways.detail.metadata')}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div data-ai-id="gateway-detail:labels">
                <h3 className="mb-1 text-xs font-medium text-ai-fg-secondary">{t('cluster.clusterGateways.detail.labels')}</h3>
                {Object.keys(detail.labels).length === 0 ? (
                  <p className="text-xs text-ai-fg-muted">{t('cluster.clusterGateways.detail.emptyMetadata')}</p>
                ) : (
                  <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
                    {Object.entries(detail.labels).map(([key, value]) => (
                      <React.Fragment key={key}>
                        <dt className="break-all text-ai-fg-muted">{key}</dt>
                        <dd className="break-all text-ai-fg-secondary">{value || '-'}</dd>
                      </React.Fragment>
                    ))}
                  </dl>
                )}
              </div>
              <div data-ai-id="gateway-detail:annotations">
                <h3 className="mb-1 text-xs font-medium text-ai-fg-secondary">{t('cluster.clusterGateways.detail.annotations')}</h3>
                {Object.keys(detail.annotations).length === 0 ? (
                  <p className="text-xs text-ai-fg-muted">{t('cluster.clusterGateways.detail.emptyMetadata')}</p>
                ) : (
                  <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
                    {Object.entries(detail.annotations).map(([key, value]) => (
                      <React.Fragment key={key}>
                        <dt className="break-all text-ai-fg-muted">{key}</dt>
                        <dd className="break-all text-ai-fg-secondary">{value || '-'}</dd>
                      </React.Fragment>
                    ))}
                  </dl>
                )}
              </div>
            </div>
            <p className="mt-3 text-[11px] text-ai-fg-muted">{t('cluster.clusterGateways.detail.resourceVersion')}: {detail.resourceVersion || '-'}</p>
          </section>
        </React.Fragment>
      ) : null}
    </AiSurface>
  );
}
