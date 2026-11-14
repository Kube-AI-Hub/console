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

  const backHref = '/kube-frontend/clusters/' + encodeURIComponent(cluster) + '/gateways/cluster';

  return (
    <AiSurface as="section" aiId="gateway-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <div>
        <a
          href={backHref}
          className="inline-flex items-center gap-1 text-xs text-ai-accent hover:underline"
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
                              className="font-medium text-ai-accent hover:underline"
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
        </React.Fragment>
      ) : null}
    </AiSurface>
  );
}
