import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { workloadsApi, type WorkloadDetail } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';

/**
 * 容器详情.
 *
 * One container inside a pod: image, command, resources, environment, mounts, ports and
 * probes — the things an operator reads when a single container misbehaves and the pod-level
 * status is not specific enough to say why.
 *
 * Logs, terminal and per-container monitoring are not here: the first two need streaming
 * endpoints this console does not proxy, and the third needs the monitoring range query. The
 * page stops at what the pod object itself can answer rather than offering dead tabs.
 */
export interface ContainerDetailPageProps {
  workspace: string;
  cluster: string;
  namespace: string;
  pod: string;
  container: string;
}

/** A container as the pod object describes it; kept local because it is a view, not a resource. */
interface ContainerView {
  name: string;
  image: string;
  imagePullPolicy: string;
  command: string[];
  args: string[];
  requests: Array<{ key: string; value: string }>;
  limits: Array<{ key: string; value: string }>;
  env: Array<{ name: string; value: string }>;
  mounts: Array<{ name: string; mountPath: string; readOnly: boolean; source: string }>;
  ports: Array<{ name: string; port: string; protocol: string }>;
  probes: Array<{ kind: string; type: string; detail: string }>;
  state: string;
  restarts: number;
  startedAt: string;
}

export function ContainerDetailPage({ workspace, cluster, namespace, pod, container }: ContainerDetailPageProps): React.ReactElement {
  const t = useT();
  const query = useQuery({
    queryKey: ['workload-detail', 'pods', pod, namespace],
    queryFn: ({ signal }) => workloadsApi(apiClient, 'pods').get({ name: pod, namespace, cluster, signal }),
  });

  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';
  const view = query.data ? containerView(query.data, container) : undefined;
  const podLinks = { workspace, cluster, namespace };

  return (
    <AiSurface as="section" aiId="container-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <Link
          to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/pods/$name"
          params={{ ...podLinks, name: pod }}
          className="text-sm text-ai-accent hover:underline"
          {...actionProps('container-detail:back')}
        >
          ← {pod}
        </Link>
        <h1 className="text-lg font-semibold text-ai-fg">{view?.name || container}</h1>
      </header>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="container-detail:retry" />
      ) : null}
      {state === 'ready' && !view ? (
        <p className="text-sm text-ai-fg-muted" data-ai-id="container-detail:missing">
          {t('container.notFound')}
        </p>
      ) : null}

      {view ? (
        <React.Fragment>
          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="container-detail:basic">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('platform.user.detail.basic')}</h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <DefinitionRow label={t('container.field.name')} value={view.name} />
              <DefinitionRow label={t('container.field.image')} value={view.image || '-'} />
              <DefinitionRow label={t('container.field.imagePullPolicy')} value={view.imagePullPolicy || '-'} />
              <DefinitionRow label={t('container.field.state')} value={view.state || '-'} />
              <DefinitionRow label={t('container.field.restarts')} value={String(view.restarts)} />
              <DefinitionRow label={t('container.field.startedAt')} value={view.startedAt || '-'} />
              <DefinitionRow label={t('container.field.command')} value={[...view.command, ...view.args].join(' ') || '-'} />
            </dl>
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="container-detail:resources">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('container.section.resources')}</h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <DefinitionRow
                label={t('container.field.requests')}
                value={view.requests.map((entry) => `${entry.key}=${entry.value}`).join(', ') || '-'}
              />
              <DefinitionRow
                label={t('container.field.limits')}
                value={view.limits.map((entry) => `${entry.key}=${entry.value}`).join(', ') || '-'}
              />
            </dl>
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="container-detail:env">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('container.section.env')}</h2>
            {view.env.length === 0 ? (
              <p className="text-xs text-ai-fg-muted">{t('container.empty.env')}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-ai-line text-xs" data-ai-id="container-detail:env-list">
                {view.env.map((entry) => (
                  <li key={entry.name} className="flex items-start justify-between gap-3 py-1.5" data-ai-row={entry.name}>
                    <span className="font-mono text-ai-fg-secondary">{entry.name}</span>
                    <span className="max-w-[60%] break-all text-right font-mono text-ai-fg-muted">{entry.value || '-'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="container-detail:mounts">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('container.section.mounts')}</h2>
            {view.mounts.length === 0 ? (
              <p className="text-xs text-ai-fg-muted">{t('container.empty.mounts')}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-ai-line text-xs" data-ai-id="container-detail:mount-list">
                {view.mounts.map((mount) => (
                  <li key={`${mount.name}-${mount.mountPath}`} className="flex items-start justify-between gap-3 py-1.5" data-ai-row={mount.name}>
                    <span className="font-mono text-ai-fg-secondary">{mount.mountPath}</span>
                    <span className="text-right text-ai-fg-muted">
                      {mount.name}
                      {mount.readOnly ? ` · ${t('container.readOnly')}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="container-detail:ports">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('container.section.ports')}</h2>
            {view.ports.length === 0 ? (
              <p className="text-xs text-ai-fg-muted">{t('container.empty.ports')}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-ai-line text-xs" data-ai-id="container-detail:port-list">
                {view.ports.map((port) => (
                  <li key={`${port.name}-${port.port}`} className="flex items-center justify-between gap-3 py-1.5" data-ai-row={port.name || port.port}>
                    <span className="font-mono text-ai-fg-secondary">{port.name || '-'}</span>
                    <span className="text-ai-fg-muted">{port.port}/{port.protocol}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="container-detail:probes">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('container.section.probes')}</h2>
            {view.probes.length === 0 ? (
              <p className="text-xs text-ai-fg-muted">{t('container.empty.probes')}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-ai-line text-xs" data-ai-id="container-detail:probe-list">
                {view.probes.map((probe) => (
                  <li key={probe.kind} className="flex items-start justify-between gap-3 py-1.5" data-ai-row={probe.kind}>
                    <span className="text-ai-fg-secondary">{probe.kind}</span>
                    <span className="text-right text-ai-fg-muted">{[probe.type, probe.detail].filter(Boolean).join(' · ')}</span>
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

/** Pick one container out of the pod object and flatten it for display. */
export function containerView(detail: WorkloadDetail, container: string): ContainerView | undefined {
  const raw = detail.raw as unknown as { spec?: Record<string, unknown>; status?: Record<string, unknown> };
  const spec = (raw.spec ?? {}) as Record<string, unknown>;
  const status = (raw.status ?? {}) as Record<string, unknown>;
  const containers = ((spec['containers'] ?? []) as Array<Record<string, unknown>>);
  const found = containers.find((entry) => String(entry['name'] ?? '') === container);
  if (!found) return undefined;

  const statuses = ((status['containerStatuses'] ?? []) as Array<Record<string, unknown>>);
  const statusEntry = statuses.find((entry) => String(entry['name'] ?? '') === container);
  const stateBlock = ((statusEntry?.['state'] ?? {}) as Record<string, unknown>);
  const stateKey = Object.keys(stateBlock)[0] ?? '';
  const stateDetail = (stateBlock[stateKey] ?? {}) as Record<string, unknown>;

  const volumes = ((spec['volumes'] ?? []) as Array<Record<string, unknown>>);
  const sourceOf = (name: string): string => {
    const volume = volumes.find((entry) => String(entry['name'] ?? '') === name);
    if (!volume) return '';
    const key = Object.keys(volume).find((entry) => entry !== 'name') ?? '';
    return key;
  };

  const probes: ContainerView['probes'] = [];
  for (const kind of ['livenessProbe', 'readinessProbe', 'startupProbe'] as const) {
    const probe = found[kind] as Record<string, unknown> | undefined;
    if (!probe) continue;
    const handlerKey = Object.keys(probe).find((key) => key.endsWith('Probe') || key === 'exec' || key === 'httpGet' || key === 'tcpSocket' || key === 'grpc') ?? '';
    const handler = (probe[handlerKey] ?? {}) as Record<string, unknown>;
    const httpPath = (handler['path'] as string | undefined) ?? '';
    const port = handler['port'] !== undefined ? String(handler['port']) : '';
    probes.push({
      kind,
      type: handlerKey,
      detail: [httpPath, port && `:${port}`].filter(Boolean).join(''),
    });
  }

  const pairs = (value: unknown): Array<{ key: string; value: string }> =>
    Object.entries((value ?? {}) as Record<string, unknown>).map(([key, raw]) => ({ key, value: String(raw ?? '') }));

  const resources = (found['resources'] ?? {}) as Record<string, unknown>;
  const env = ((found['env'] ?? []) as Array<Record<string, unknown>>).map((entry) => {
    const valueFrom = entry['valueFrom'] as Record<string, unknown> | undefined;
    const ref = valueFrom ? Object.entries(valueFrom)[0] : undefined;
    const inner = (ref?.[1] ?? {}) as Record<string, unknown>;
    const refText = ref ? `${ref[0]}:${Object.values(inner).filter(Boolean).join('/')}` : '';
    return { name: String(entry['name'] ?? ''), value: String(entry['value'] ?? refText) };
  });

  return {
    name: String(found['name'] ?? ''),
    image: String(found['image'] ?? ''),
    imagePullPolicy: String(found['imagePullPolicy'] ?? ''),
    command: ((found['command'] ?? []) as unknown[]).map(String),
    args: ((found['args'] ?? []) as unknown[]).map(String),
    requests: pairs(resources['requests']),
    limits: pairs(resources['limits']),
    env,
    mounts: ((found['volumeMounts'] ?? []) as Array<Record<string, unknown>>).map((mount) => ({
      name: String(mount['name'] ?? ''),
      mountPath: String(mount['mountPath'] ?? ''),
      readOnly: Boolean(mount['readOnly']),
      source: sourceOf(String(mount['name'] ?? '')),
    })),
    ports: ((found['ports'] ?? []) as Array<Record<string, unknown>>).map((port) => ({
      name: String(port['name'] ?? ''),
      port: String(port['containerPort'] ?? ''),
      protocol: String(port['protocol'] ?? 'TCP'),
    })),
    probes,
    state: stateKey ? `${stateKey}${stateDetail['reason'] ? ` (${String(stateDetail['reason'])})` : ''}` : '',
    restarts: Number(statusEntry?.['restartCount'] ?? 0),
    startedAt: statusEntry?.['state'] ? String(((stateBlock['running'] ?? {}) as Record<string, unknown>)['startedAt'] ?? '') : '',
  };
}