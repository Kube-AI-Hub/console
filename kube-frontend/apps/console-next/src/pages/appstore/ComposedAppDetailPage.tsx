import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { composedAppsApi, composedAppsWriteApi } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, Button, Skeleton } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { EditInfoDialog } from '@/components/resource/EditInfoDialog';
import { ComposedAppRouteDialog } from './ComposedAppRouteDialog';
import { MutationAlert } from '@/components/resource/ResourceErrorPanel';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';

/**
 * 自制应用详情.
 *
 * Basic info + the components the Application selector matched. The old console's detail had
 * resources/events/traffic/tracing tabs; the last two need servicemesh, and events are a
 * separate unit, so this page shows the pieces the list can vouch for. [N-01]
 */
export interface ComposedAppDetailPageProps {
  workspace: string;
  cluster: string;
  namespace: string;
  name: string;
}

export function ComposedAppDetailPage({ workspace, cluster, namespace, name }: ComposedAppDetailPageProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [deleting, setDeleting] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [routing, setRouting] = React.useState(false);
  const [expandedTrace, setExpandedTrace] = React.useState<string | null>(null);
  const query = useQuery({
    queryKey: ['composed-app', cluster, namespace, name],
    queryFn: ({ signal }) => composedAppsApi(apiClient).get({ namespace, name, cluster, signal }),
  });
  const updateInfo = useMutation({
    mutationFn: (annotations: Record<string, string>) =>
      composedAppsWriteApi(apiClient).updateInfo({ namespace, name, cluster, annotations }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['composed-app', cluster, namespace, name] });
      void queryClient.invalidateQueries({ queryKey: ['composed-apps', cluster, namespace] });
      setEditing(false);
    },
  });
  const app = query.data;
  const events = useQuery({
    queryKey: ['composed-app-events', cluster, namespace, name],
    queryFn: ({ signal }) =>
      composedAppsApi(apiClient).events({
        namespace,
        names: app
          ? [name, ...app.workloads.map((item) => item.name), ...app.serviceItems.map((item) => item.name), ...app.ingressItems.map((item) => item.name)]
          : [name],
        signal,
      }),
    enabled: app !== undefined,
  });
  const addRoute = useMutation({
    mutationFn: (input: { host: string; path: string; serviceName: string; servicePort: number }) =>
      composedAppsWriteApi(apiClient).addRoute({ namespace, cluster, appName: name, ...input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['composed-app', cluster, namespace, name] });
      void queryClient.invalidateQueries({ queryKey: ['composed-apps', cluster, namespace] });
      void queryClient.invalidateQueries({ queryKey: ['composed-app-events', cluster, namespace, name] });
      setRouting(false);
    },
  });
  const traffic = useQuery({
    queryKey: ['composed-app-traffic', cluster, namespace, name],
    queryFn: ({ signal }) =>
      composedAppsApi(apiClient).traffic({
        namespace,
        cluster,
        appName: name,
        workloads: app ? app.workloads.map((item) => item.name) : [],
        services: app ? app.serviceItems.map((item) => item.name) : [],
        signal,
      }),
    enabled: app !== undefined,
  });
  const tracing = useQuery({
    queryKey: ['composed-app-tracing', cluster, namespace, name],
    queryFn: ({ signal }) =>
      composedAppsApi(apiClient).tracing({
        namespace,
        cluster,
        services: app ? app.serviceItems.map((item) => item.name) : [],
        signal,
      }),
    enabled: app !== undefined,
  });
  const grayscale = useQuery({
    queryKey: ['composed-app-gray', cluster, namespace, name],
    queryFn: ({ signal }) =>
      composedAppsApi(apiClient).strategies({
        namespace,
        cluster,
        appName: name,
        services: app ? app.serviceItems.map((item) => item.name) : [],
        signal,
      }),
    enabled: app !== undefined,
  });
  const remove = useMutation({
    mutationFn: () => composedAppsApi(apiClient).remove({ namespace, name, cluster }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['composed-apps', cluster, namespace] });
      setDeleting(false);
      void navigate({
        href: '/kube-frontend/' + encodeURIComponent(workspace) + '/clusters/' + encodeURIComponent(cluster) + '/projects/' + encodeURIComponent(namespace) + '/applications/composing',
      });
    },
  });

  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="composed-app-detail:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="composed-app-detail:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="composed-app-detail:surface" state={state} className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            className="text-xs text-ai-fg-muted hover:underline"
            to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/applications/composing"
            params={{ workspace, cluster, namespace }}
            data-ai-id="composed-app-detail:back"
          >
            {t('composedApps.title')}
          </Link>
          <h2 className="mt-1 truncate text-lg font-semibold text-ai-fg">{name}</h2>
          {app?.annotations['kubesphere.io/alias-name'] ? (
            <p className="mt-1 text-sm text-ai-fg-secondary" data-ai-id="composed-app-detail:alias">
              {app.annotations['kubesphere.io/alias-name']}
            </p>
          ) : null}
          <p className="mt-1 font-mono text-xs text-ai-fg-muted">{namespace}</p>
        </div>
        <div className="flex items-center gap-2">
          {app && app.serviceItems.length > 0 ? (
            <Button variant="secondary" size="sm" {...actionProps('composed-app-detail:add-route')} onClick={() => setRouting(true)}>
              {t('composedApps.route.action')}
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" {...actionProps('composed-app-detail:edit')} onClick={() => setEditing(true)}>
            {t('resource.action.editInfo')}
          </Button>
          <Button variant="secondary" size="sm" {...actionProps('composed-app-detail:delete')} onClick={() => setDeleting(true)}>
            {t('common.delete')}
          </Button>
        </div>
        {app ? (
          <dl className="flex flex-wrap gap-6 text-xs">
            <div>
              <dt className="text-ai-fg-muted">{t('composedApps.column.health')}</dt>
              <dd className="mt-0.5"><Badge tone={app.health === 'healthy' ? 'success' : app.health === 'degraded' ? 'danger' : app.health === 'progressing' ? 'warning' : 'neutral'}>{t(('composedApps.health.' + app.health) as 'composedApps.health.healthy')} {app.healthDetail}</Badge></dd>
            </div>
            <div>
              <dt className="text-ai-fg-muted">{t('composedApps.column.version')}</dt>
              <dd className="mt-0.5 font-mono text-ai-fg">{app.version}</dd>
            </div>
            <div>
              <dt className="text-ai-fg-muted">{t('workspace.field.createdAt')}</dt>
              <dd className="mt-0.5 tabular-nums text-ai-fg">{app.createdAt ? formatTimestamp(app.createdAt) : '-'}</dd>
            </div>
          </dl>
        ) : null}
      </div>

      {state === 'loading' ? <Skeleton className="mt-4 h-40 w-full" /> : null}

      {app ? (
        <>
          <section className="mt-6">
            <h3 className="text-sm font-medium text-ai-fg">{t('composedApps.detail.selector')}</h3>
            <p className="mt-1 break-all font-mono text-[11px] text-ai-fg-secondary">
              {Object.entries(app.selector).map(([key, value]) => key + '=' + value).join(', ') || '-'}
            </p>
          </section>

          <section className="mt-6" data-ai-id="composed-app-detail:workloads">
            <h3 className="text-sm font-medium text-ai-fg">{t('composedApps.detail.workloads')}</h3>
            {app.workloads.length === 0 ? <p className="mt-1 text-xs text-ai-fg-muted">{t('composedApps.detail.empty')}</p> : (
              <table className="mt-2 w-full border-collapse text-xs">
                <thead><tr className="border-b border-ai-line text-left text-ai-fg-muted"><th className="py-2 pr-3 font-medium">{t('workspace.field.name')}</th><th className="py-2 pr-3 font-medium">Kind</th><th className="py-2 pr-3 text-right font-medium">{t('composedApps.detail.ready')}</th></tr></thead>
                <tbody>{app.workloads.map((workload) => (
                  <tr key={workload.kind + '/' + workload.name} className="border-b border-ai-line/60" data-ai-id={'composed-app-detail:workload:' + workload.name}>
                    <td className="py-2 pr-3 font-mono text-ai-fg">{workload.name}</td>
                    <td className="py-2 pr-3 text-ai-fg-secondary">{workload.kind}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-ai-fg-secondary">{workload.ready}/{workload.desired}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </section>

          <section className="mt-6" data-ai-id="composed-app-detail:services">
            <h3 className="text-sm font-medium text-ai-fg">{t('composedApps.services')}</h3>
            {app.serviceItems.length === 0 ? <p className="mt-1 text-xs text-ai-fg-muted">{t('composedApps.detail.empty')}</p> : (
              <ul className="mt-2 space-y-1 text-xs text-ai-fg-secondary">{app.serviceItems.map((service) => (
                <li key={service.name} className="font-mono" data-ai-id={'composed-app-detail:service:' + service.name}>{service.name} · {service.type} · {service.clusterIP}</li>
              ))}</ul>
            )}
          </section>

          <section className="mt-6" data-ai-id="composed-app-detail:events">
            <h3 className="text-sm font-medium text-ai-fg">{t('composedApps.detail.events')}</h3>
            {events.isPending ? <Skeleton className="mt-2 h-16 w-full" /> : null}
            {events.isError ? (
              <ResourceErrorPanel error={events.error} onRetry={() => void events.refetch()} retryAiId="composed-app-detail:events-retry" />
            ) : null}
            {events.data ? (
              events.data.length === 0 ? (
                <p className="mt-1 text-xs text-ai-fg-muted" data-ai-id="composed-app-detail:events-empty">
                  {t('composedApps.detail.eventsEmpty')}
                </p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-xs" data-ai-id="composed-app-detail:events-table">
                    <thead>
                      <tr className="border-b border-ai-line text-left text-ai-fg-muted">
                        <th className="py-2 pr-3 font-medium">{t('composedApps.detail.eventTime')}</th>
                        <th className="py-2 pr-3 font-medium">{t('composedApps.detail.eventType')}</th>
                        <th className="py-2 pr-3 font-medium">{t('composedApps.detail.eventObject')}</th>
                        <th className="py-2 pr-3 font-medium">{t('composedApps.detail.eventReason')}</th>
                        <th className="py-2 pr-3 font-medium">{t('composedApps.detail.eventMessage')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.data.map((event, index) => (
                        <tr key={index} className="border-b border-ai-line/60" data-ai-id={'composed-app-detail:event:' + index}>
                          <td className="py-2 pr-3 tabular-nums text-ai-fg-secondary">{event.lastTimestamp ? formatTimestamp(event.lastTimestamp) : '-'}</td>
                          <td className="py-2 pr-3 text-ai-fg-secondary">{event.type}</td>
                          <td className="py-2 pr-3 font-mono text-ai-fg-secondary">{event.objectKind}/{event.objectName}</td>
                          <td className="py-2 pr-3 text-ai-fg-secondary">{event.reason}</td>
                          <td className="py-2 pr-3 text-ai-fg-secondary">
                            {event.message}
                            {event.count > 1 ? ' ×' + event.count : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : null}
          </section>

          <section className="mt-6" data-ai-id="composed-app-detail:traffic">
            <h3 className="text-sm font-medium text-ai-fg">{t('composedApps.detail.traffic')}</h3>
            <p className="mt-1 text-[11px] text-ai-fg-muted">{t('composedApps.detail.trafficHint')}</p>
            {traffic.isPending ? <Skeleton className="mt-2 h-16 w-full" /> : null}
            {traffic.isError ? (
              <ResourceErrorPanel error={traffic.error} onRetry={() => void traffic.refetch()} retryAiId="composed-app-detail:traffic-retry" />
            ) : null}
            {traffic.data && !traffic.data.available ? (
              <p className="mt-2 text-xs text-ai-fg-muted" data-ai-id="composed-app-detail:traffic-unavailable">
                {t('composedApps.detail.trafficUnavailable')}
                {traffic.data.reason ? <span className="ml-1 font-mono text-[11px]">({traffic.data.reason})</span> : null}
              </p>
            ) : null}
            {traffic.data?.available && traffic.data.nodes.length === 0 ? (
              <p className="mt-2 text-xs text-ai-fg-muted" data-ai-id="composed-app-detail:traffic-empty">
                {t('composedApps.detail.trafficEmpty')}
              </p>
            ) : null}
            {traffic.data?.available && traffic.data.nodes.length > 0 ? (
              <div className="mt-2 overflow-x-auto">
                <p className="text-[11px] text-ai-fg-muted">
                  {t('composedApps.detail.trafficSummary', { nodes: traffic.data.nodes.length, edges: traffic.data.edges })}
                </p>
                <table className="mt-2 w-full min-w-[640px] border-collapse text-xs" data-ai-id="composed-app-detail:traffic-table">
                  <thead>
                    <tr className="border-b border-ai-line text-left text-ai-fg-muted">
                      <th className="py-2 pr-3 font-medium">{t('composedApps.detail.trafficType')}</th>
                      <th className="py-2 pr-3 font-medium">{t('composedApps.detail.trafficName')}</th>
                      <th className="py-2 pr-3 font-medium">{t('workspace.field.name')}</th>
                      <th className="py-2 pr-3 font-medium">{t('cluster.workloads.column.project')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {traffic.data.nodes.map((node) => (
                      <tr key={node.id} className="border-b border-ai-line/60" data-ai-id={'composed-app-detail:traffic-node:' + node.id}>
                        <td className="py-2 pr-3 text-ai-fg-secondary">{node.nodeType}{node.outside ? ' (' + t('composedApps.detail.outside') + ')' : ''}</td>
                        <td className="py-2 pr-3 font-mono text-ai-fg-secondary">{node.app || node.workload || node.service || node.id}</td>
                        <td className="py-2 pr-3 font-mono text-ai-fg-secondary">{node.workload || node.service || '-'}</td>
                        <td className="py-2 pr-3 text-ai-fg-secondary">{node.namespace || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          <section className="mt-6" data-ai-id="composed-app-detail:tracing">
            <h3 className="text-sm font-medium text-ai-fg">{t('composedApps.detail.tracing')}</h3>
            <p className="mt-1 text-[11px] text-ai-fg-muted">{t('composedApps.detail.tracingHint')}</p>
            {tracing.isPending ? <Skeleton className="mt-2 h-16 w-full" /> : null}
            {tracing.isError ? (
              <ResourceErrorPanel error={tracing.error} onRetry={() => void tracing.refetch()} retryAiId="composed-app-detail:tracing-retry" />
            ) : null}
            {tracing.data && !tracing.data.available ? (
              <p className="mt-2 text-xs text-ai-fg-muted" data-ai-id="composed-app-detail:tracing-unavailable">
                {t('composedApps.detail.tracingUnavailable')}
                {tracing.data.reason ? <span className="ml-1 font-mono text-[11px]">({tracing.data.reason})</span> : null}
              </p>
            ) : null}
            {tracing.data?.available && tracing.data.traces.length === 0 ? (
              <p className="mt-2 text-xs text-ai-fg-muted" data-ai-id="composed-app-detail:tracing-empty">
                {t('composedApps.detail.tracingEmpty')}
              </p>
            ) : null}
            {tracing.data?.available && tracing.data.traces.length > 0 ? (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-xs" data-ai-id="composed-app-detail:tracing-table">
                  <thead>
                    <tr className="border-b border-ai-line text-left text-ai-fg-muted">
                      <th className="py-2 pr-3 font-medium">{t('composedApps.detail.traceId')}</th>
                      <th className="py-2 pr-3 font-medium">{t('composedApps.route.service')}</th>
                      <th className="py-2 pr-3 text-right font-medium">{t('composedApps.detail.spanCount')}</th>
                      <th className="py-2 pr-3 text-right font-medium">{t('composedApps.detail.duration')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tracing.data.traces.map((trace) => {
                      const expanded = expandedTrace === trace.traceId;
                      const total = Math.max(trace.durationMs, 1);
                      return (
                        <React.Fragment key={trace.traceId}>
                          <tr className="border-b border-ai-line/60" data-ai-id={'composed-app-detail:trace:' + trace.traceId}>
                            <td className="py-2 pr-3 font-mono text-ai-fg-secondary">
                              <Button
                                size="sm"
                                variant="ghost"
                                {...actionProps('composed-app-detail:trace-toggle:' + trace.traceId)}
                                onClick={() => setExpandedTrace(expanded ? null : trace.traceId)}
                              >
                                {expanded ? '−' : '+'} {trace.traceId.slice(0, 16)}
                              </Button>
                            </td>
                            <td className="py-2 pr-3 text-ai-fg-secondary">{trace.service}</td>
                            <td className="py-2 pr-3 text-right tabular-nums text-ai-fg-secondary">{trace.spanCount}</td>
                            <td className="py-2 pr-3 text-right tabular-nums text-ai-fg-secondary">{trace.durationMs} ms</td>
                          </tr>
                          {expanded ? (
                            <tr className="border-b border-ai-line/60 bg-ai-surface-2/50" data-ai-id={'composed-app-detail:trace-spans:' + trace.traceId}>
                              <td colSpan={4} className="px-3 py-2">
                                <div className="flex flex-col gap-1">
                                  {trace.spans.map((span) => (
                                    <div key={span.spanId} className="grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)_4.5rem] items-center gap-2 text-[11px]"
                                      data-ai-id={'composed-app-detail:trace-span:' + span.spanId}>
                                      <span className="truncate font-mono text-ai-fg-secondary" title={span.operationName}>{span.operationName || span.spanId}</span>
                                      <span className="relative h-3 rounded-ai-sm bg-ai-surface-3">
                                        <span className="absolute inset-y-0 rounded-ai-sm bg-ai-accent/60"
                                          style={{ left: (span.startOffsetMs / total) * 100 + '%', width: Math.max(1, (span.durationMs / total) * 100) + '%' }} />
                                      </span>
                                      <span className="text-right tabular-nums text-ai-fg-muted">{span.durationMs} ms</span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          <section className="mt-6" data-ai-id="composed-app-detail:gray">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-ai-fg">{t('composedApps.detail.gray')}</h3>
              <Link
                to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/grayrelease"
                params={{ workspace, cluster, namespace }}
                className="text-xs text-ai-link hover:underline"
                {...actionProps('composed-app-detail:gray-manage')}
              >
                {t('composedApps.detail.grayManage')}
              </Link>
            </div>
            <p className="mt-1 text-[11px] text-ai-fg-muted">{t('composedApps.detail.grayHint')}</p>
            {grayscale.isPending ? <Skeleton className="mt-2 h-16 w-full" /> : null}
            {grayscale.isError ? (
              <ResourceErrorPanel error={grayscale.error} onRetry={() => void grayscale.refetch()} retryAiId="composed-app-detail:gray-retry" />
            ) : null}
            {grayscale.data && !grayscale.data.available ? (
              <p className="mt-2 text-xs text-ai-fg-muted" data-ai-id="composed-app-detail:gray-unavailable">
                {t('composedApps.detail.grayUnavailable')}
                {grayscale.data.reason ? <span className="ml-1 font-mono text-[11px]">({grayscale.data.reason})</span> : null}
              </p>
            ) : null}
            {grayscale.data?.available && grayscale.data.strategies.length === 0 ? (
              <p className="mt-2 text-xs text-ai-fg-muted" data-ai-id="composed-app-detail:gray-empty">
                {t('composedApps.detail.grayEmpty')}
              </p>
            ) : null}
            {grayscale.data?.available && grayscale.data.strategies.length > 0 ? (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-xs" data-ai-id="composed-app-detail:gray-table">
                  <thead>
                    <tr className="border-b border-ai-line text-left text-ai-fg-muted">
                      <th className="py-2 pr-3 font-medium">{t('workspace.field.name')}</th>
                      <th className="py-2 pr-3 font-medium">{t('composedApps.detail.grayType')}</th>
                      <th className="py-2 pr-3 font-medium">{t('composedApps.detail.grayHosts')}</th>
                      <th className="py-2 pr-3 font-medium">{t('composedApps.detail.graySelector')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grayscale.data.strategies.map((strategy) => (
                      <tr key={strategy.name} className="border-b border-ai-line/60" data-ai-id={'composed-app-detail:gray:' + strategy.name}>
                        <td className="py-2 pr-3 font-mono text-ai-fg-secondary">{strategy.name}</td>
                        <td className="py-2 pr-3 text-ai-fg-secondary">{t(('composedApps.detail.grayType.' + strategy.type) as 'composedApps.detail.grayType.traffic')}</td>
                        <td className="py-2 pr-3 font-mono text-ai-fg-secondary">{strategy.hosts.join(', ') || '-'}</td>
                        <td className="py-2 pr-3 font-mono text-[11px] text-ai-fg-secondary">
                          {Object.entries(strategy.selector).map(([key, value]) => key + '=' + value).join(', ') || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          <section className="mt-6" data-ai-id="composed-app-detail:ingresses">
            <h3 className="text-sm font-medium text-ai-fg">{t('composedApps.ingresses')}</h3>
            {app.ingressItems.length === 0 ? <p className="mt-1 text-xs text-ai-fg-muted">{t('composedApps.detail.empty')}</p> : (
              <ul className="mt-2 space-y-1 text-xs text-ai-fg-secondary">{app.ingressItems.map((ingress) => (
                <li key={ingress.name} className="font-mono" data-ai-id={'composed-app-detail:ingress:' + ingress.name}>{ingress.name} · {ingress.hosts.join(', ')}</li>
              ))}</ul>
            )}
          </section>
        </>
      ) : null}
      <MutationAlert error={remove.error ?? updateInfo.error ?? addRoute.error} />
      {app && routing ? (
        <ComposedAppRouteDialog
          open
          onOpenChange={(next) => !next && setRouting(false)}
          services={app.serviceItems}
          pending={addRoute.isPending}
          {...(addRoute.error ? { error: addRoute.error } : {})}
          onSubmit={async (input) => {
            await addRoute.mutateAsync(input);
          }}
        />
      ) : null}
      {app && editing ? (
        <EditInfoDialog
          open
          onOpenChange={(next) => !next && setEditing(false)}
          resource="composed-app-detail"
          name={name}
          alias={app.annotations['kubesphere.io/alias-name'] ?? ''}
          description={app.annotations['kubesphere.io/description'] ?? ''}
          annotations={app.annotations}
          pending={updateInfo.isPending}
          {...(updateInfo.error ? { error: String((updateInfo.error as { message?: string }).message ?? updateInfo.error) } : {})}
          onSubmit={async (annotations) => {
            await updateInfo.mutateAsync(annotations);
          }}
        />
      ) : null}
      {deleting ? (
        <DeleteDialog
          open
          onOpenChange={(next) => !next && setDeleting(false)}
          names={[name]}
          resource="composed-app-detail"
          noun={t('composedApps.title')}
          pending={remove.isPending}
          {...(remove.error ? { error: String((remove.error as { message?: string }).message ?? remove.error) } : {})}
          onConfirm={async () => {
            await remove.mutateAsync();
          }}
        />
      ) : null}
    </AiSurface>
  );
}
