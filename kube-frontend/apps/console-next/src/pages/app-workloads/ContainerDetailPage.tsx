import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  containerLifecycleHooks,
  podContainersOf,
  resolvePodEnv,
  workloadsApi,
  type ContainerEnvGroup,
  type LifecycleHook,
  type PodLike,
  type WorkloadDetail,
} from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Button, Skeleton, cn } from '@kube-ai-hub/ui';
import { useT, type LocaleKey } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { ContainerTerminal } from './ContainerTerminal';
import { ContainerLogsDialog } from './ContainerLogsDialog';
import { ContainerMonitorPanel } from './ContainerMonitorPanel';

/**
 * 容器详情.
 *
 * One container inside a pod: image, image ID, command, resources, environment, mounts,
 * ports, probes and lifecycle hooks — the things an operator reads when a single container
 * misbehaves and the pod-level status is not specific enough to say why.
 *
 * The page is four tabs, the same four the old console's container detail had
 * (`Pods/Containers/routes.js`): 资源状态 / 监控 / 环境变量 / 日志, with 资源状态 first
 * because it answers "what is this container". Logs and the terminal stay where they
 * were, but logs moved into their own tab and the terminal stayed page-level: the
 * terminal is a session, not a fact about the container, and switching tabs must not
 * close it.
 *
 * Logs are here twice over: the search-backed history block (the tenant log API, one hour
 * window) and a live tail switched on from the same block. The tail is a plain HTTP chunked
 * read of the pod's `log` subresource — `follow=true` through the BFF proxy.
 *
 * The terminal is the second streaming channel and goes through the one WebSocket the BFF
 * forwards: `/api/v1/.../exec?container=…&tty=true&command=/bin/sh`, protocol
 * `v5.channel.k8s.io`.
 *
 * Per-container monitoring is the fourth channel and the only one that is a plain range
 * query; it lives in `ContainerMonitorPanel` because it owns its own window and query.
 */
export interface ContainerDetailPageProps {
  workspace: string;
  cluster: string;
  namespace: string;
  pod: string;
  container: string;
}

/**
 * The four tabs. A tab only switches a panel: every read stays at the top of the page so
 * that moving between tabs never starts a request of its own (the old console re-read the
 * environment on every visit).
 */
type ContainerTab = 'resources' | 'monitor' | 'env' | 'logs';

const CONTAINER_TABS: readonly ContainerTab[] = ['resources', 'monitor', 'env', 'logs'];

const TAB_LABEL_KEYS: Record<ContainerTab, LocaleKey> = {
  resources: 'container.tab.resources',
  monitor: 'container.tab.monitor',
  env: 'container.tab.env',
  logs: 'container.tab.logs',
};

/**
 * Lifecycle handler → copy key.
 *
 * `containerLifecycleHooks` already drops handlers it does not recognise, so an unknown
 * `type` cannot reach this table; the raw value is still the fallback rather than a blank.
 */
const LIFECYCLE_TYPE_KEYS: Record<string, LocaleKey> = {
  httpGet: 'workloads.pod.lifecycle.httpGet',
  tcpSocket: 'workloads.pod.lifecycle.tcpSocket',
  exec: 'workloads.pod.lifecycle.exec',
};

/** A container as the pod object describes it; kept local because it is a view, not a resource. */
interface ContainerView {
  name: string;
  image: string;
  /** `status.containerStatuses[].imageID`; empty when the container never started. */
  imageID: string;
  imagePullPolicy: string;
  command: string[];
  args: string[];
  requests: Array<{ key: string; value: string }>;
  limits: Array<{ key: string; value: string }>;
  env: Array<{ name: string; value: string }>;
  mounts: Array<{ name: string; mountPath: string; readOnly: boolean; source: string }>;
  ports: Array<{ name: string; port: string; protocol: string }>;
  probes: Array<{ kind: string; type: string; detail: string }>;
  /** postStart / preStop, flattened by api-client; empty when the container declares none. */
  lifecycle: LifecycleHook[];
  state: string;
  restarts: number;
  startedAt: string;
}

/** Lines kept in the live view. A tail is read from the bottom; history above this is dropped. */
export const MAX_LIVE_LOG_LINES = 1000;

/**
 * Split kube's `timestamps=true` prefix off a log line.
 *
 * With timestamps on, every line starts with an RFC3339 stamp and two spaces;
 * showing it in a separate, muted column keeps the message itself readable. A
 * line without one (an older line, a different container runtime) is returned
 * whole rather than being guessed at.
 */
export function splitLogLine(line: string): { at: string; text: string } {
  const match = /^(\d{4}-\d{2}-\d{2}T\S+)\s+(.*)$/.exec(line);
  if (!match) return { at: '', text: line };
  return { at: match[1] ?? '', text: match[2] ?? line };
}

export function ContainerDetailPage({ workspace, cluster, namespace, pod, container }: ContainerDetailPageProps): React.ReactElement {
  const t = useT();
  const query = useQuery({
    queryKey: ['workload-detail', 'pods', cluster, pod, namespace],
    queryFn: ({ signal }) => workloadsApi(apiClient, 'pods').get({ name: pod, namespace, cluster, signal }),
  });

  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';
  const [activeTab, setActiveTab] = React.useState<ContainerTab>('resources');
  /*
   * The monitor panel is mounted on first visit and then kept mounted (hidden while
   * another tab is active). Its range is resolved from `Date.now()` when the window is
   * chosen, so unmounting it and mounting it again would produce a different query key
   * and a second request for the same chart — and would also forget which window the
   * reader picked. Hidden panels are the ordinary ARIA tabs pattern.
   */
  const [monitorVisited, setMonitorVisited] = React.useState(false);
  const [logsOpen, setLogsOpen] = React.useState(false);

  const view = query.data ? containerView(query.data, container) : undefined;
  const podDetail = query.data;
  const podLinks = { workspace, cluster, namespace };

  /*
   * Environment variables are resolved once, at the top of the page.
   *
   * `resolvePodEnv` reads the ConfigMaps and Secrets the `valueFrom` entries point at, so
   * resolving inside the tab would re-read those objects every time the tab is opened —
   * which is what the old console's EnvStore did. The tab only reveals the panel.
   */
  const envQuery = useQuery({
    queryKey: ['container-env', cluster, namespace, pod],
    queryFn: ({ signal }) => {
      if (!podDetail) return Promise.resolve<ContainerEnvGroup[]>([]);
      return resolvePodEnv(apiClient, {
        cluster,
        namespace,
        item: podDetail.raw as unknown as PodLike,
        signal,
      });
    },
    enabled: Boolean(podDetail),
  });

  /*
   * `resolvePodEnv` answers for every container in the pod (init containers first); this
   * page is about one of them, so only that group is shown. The heading still comes from
   * the shared copy so the two pages read the same.
   */
  const envGroup = envQuery.data?.find((group) => group.name === container);

  return (
    <AiSurface as="section" aiId="container-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <Link
          to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/pods/$name"
          params={{ ...podLinks, name: pod }}
          className="text-sm text-ai-link hover:underline"
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
          {/*
            * The tab bar. The ui package exports no Tabs primitive, so the triggers are
            * Buttons carrying the ARIA tab roles — a bare `button` element is forbidden on
            * this page, and this way the appearance stays the design system's.
            */}
          <div role="tablist" aria-label={view.name || container} className="flex flex-wrap gap-1 border-b border-ai-line">
            {CONTAINER_TABS.map((tab) => {
              const selected = tab === activeTab;
              return (
                <Button
                  key={tab}
                  role="tab"
                  size="sm"
                  variant="ghost"
                  id={`container-detail-tab-${tab}`}
                  aria-selected={selected}
                  aria-controls={`container-detail-panel-${tab}`}
                  data-ai-id={`container-detail:tab-trigger:${tab}`}
                  className={cn(
                    'rounded-none border-b-2 px-3',
                    selected ? 'border-ai-accent text-ai-accent' : 'border-transparent text-ai-fg-muted',
                  )}
                  onClick={() => {
                    setActiveTab(tab);
                    if (tab === 'monitor') setMonitorVisited(true);
                  }}
                >
                  {t(TAB_LABEL_KEYS[tab])}
                </Button>
              );
            })}
          </div>

          {activeTab === 'resources' ? (
            <div
              role="tabpanel"
              id="container-detail-panel-resources"
              aria-labelledby="container-detail-tab-resources"
              data-ai-id="container-detail:tab:resources"
              className="flex flex-col gap-4"
            >
              <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="container-detail:basic">
                <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('platform.user.detail.basic')}</h2>
                <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                  <DefinitionRow label={t('container.field.name')} value={view.name} />
                  <DefinitionRow label={t('container.field.image')} value={view.image || '-'} />
                  {/*
                    * 镜像 ID: the digest the container actually runs, which is the only way to
                    * tell two tags pointing at different builds apart. `DescriptionItem`
                    * renders `-` for an empty value, which is what a container that never
                    * started has.
                    */}
                  <DefinitionRow
                    label={t('workloads.field.imageId')}
                    value={view.imageID}
                    aiId="container-detail:image-id"
                  />
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

              {/*
                * 生命周期: only rendered when the container declares a hook. An empty block
                * would put a heading on every ordinary container, and the old console's
                * lifecycle card was conditional for the same reason.
                */}
              {view.lifecycle.length > 0 ? (
                <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="container-detail:lifecycle">
                  <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('container.section.lifecycle')}</h2>
                  <ul className="flex flex-col divide-y divide-ai-line text-xs">
                    {view.lifecycle.map((hook) => {
                      const typeKey = LIFECYCLE_TYPE_KEYS[hook.type];
                      return (
                        <li
                          key={hook.kind}
                          className="flex items-start justify-between gap-3 py-1.5"
                          data-ai-id={`container-detail:lifecycle:${hook.kind}`}
                        >
                          <span className="text-ai-fg-secondary">{t(`workloads.pod.lifecycle.${hook.kind}`)}</span>
                          <span className="max-w-[60%] break-all text-right text-ai-fg-muted">
                            {typeKey ? t(typeKey) : hook.type}
                            {hook.detail.length > 0 ? ` · ${hook.detail.join(' ')}` : ''}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}
            </div>
          ) : null}

          {/*
            * 监控: mounted only once the tab is opened, so a reader who never looks at the
            * charts costs no range query; kept mounted afterwards so returning to the tab
            * neither re-requests the same window nor resets the chosen one.
            */}
          {monitorVisited ? (
            <div
              role="tabpanel"
              id="container-detail-panel-monitor"
              aria-labelledby="container-detail-tab-monitor"
              data-ai-id="container-detail:tab:monitor"
              hidden={activeTab !== 'monitor'}
            >
              <div className="flex flex-col gap-4">
                <ContainerMonitorPanel cluster={cluster} namespace={namespace} pod={pod} container={container} />
              </div>
            </div>
          ) : null}

          {activeTab === 'env' ? (
            <div
              role="tabpanel"
              id="container-detail-panel-env"
              aria-labelledby="container-detail-tab-env"
              data-ai-id="container-detail:tab:env"
              className="flex flex-col gap-4"
            >
              <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="container-detail:env">
                <h2 className="mb-1 text-sm font-medium text-ai-fg">{t('workloads.pod.envTitle')}</h2>
                <p className="mb-3 text-xs text-ai-fg-muted">{t('workloads.pod.envHint')}</p>
                {envQuery.isPending ? <Skeleton className="h-16 w-full" /> : null}
                {(envGroup?.entries.length ?? 0) === 0 && !envQuery.isPending ? (
                  <p className="text-xs text-ai-fg-muted" data-ai-id="container-detail:env-empty">
                    {t('container.empty.env')}
                  </p>
                ) : null}
                {envGroup && envGroup.entries.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <h3 className="text-xs font-medium text-ai-fg">{t('workloads.pod.envContainer', { name: envGroup.name })}</h3>
                    <ul className="flex flex-col divide-y divide-ai-line text-xs" data-ai-id="container-detail:env-list">
                      {envGroup.entries.map((entry) => (
                        <li key={entry.name} className="flex items-start justify-between gap-3 py-1.5" data-ai-row={entry.name}>
                          <span className="font-mono text-ai-fg-secondary">{entry.name}</span>
                          <span className="max-w-[60%] break-all text-right font-mono text-ai-fg-muted">
                            {/*
                              * Three cases, three answers: a masked name never shows its
                              * value, an unresolved reference says what it points at (reading
                              * the object failed), and everything else is the value itself.
                              */}
                            {entry.masked
                              ? t('workloads.pod.envMasked')
                              : entry.value || (entry.reference ? t('workloads.pod.envUnresolved', { value: entry.reference }) : '-')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            </div>
          ) : null}

          {activeTab === 'logs' ? (
            <div
              role="tabpanel"
              id="container-detail-panel-logs"
              aria-labelledby="container-detail-tab-logs"
              data-ai-id="container-detail:tab:logs"
              className="flex flex-col gap-4"
            >
              {/*
                * The block is the old one (one button that opens the log console); only the
                * heading is new, because a whole tab of one button needs to say what it is.
                * The live tail is the dialog's, not the page's.
                */}
              <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="container-detail:logs">
                <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('container.section.logs')}</h2>
                <Button variant="secondary" {...actionProps('container-detail:logs-open')} onClick={() => setLogsOpen(true)}>
                  {t('console.logs.open')}
                </Button>
                {logsOpen ? <ContainerLogsDialog target={{ cluster, namespace, pod, container }} onClose={() => setLogsOpen(false)} /> : null}
              </section>
            </div>
          ) : null}

          {/*
            * The terminal stays outside the tabs: it is a session the reader opened, and
            * switching to another tab must not tear the shell down.
            */}
          <ContainerTerminal cluster={cluster} namespace={namespace} pod={pod} container={container} />
        </React.Fragment>
      ) : null}
    </AiSurface>
  );
}

/** Pick one container out of the pod object and flatten it for display. */
export function containerView(detail: WorkloadDetail, container: string): ContainerView | undefined {
  const item = detail.raw as unknown as PodLike;
  const spec = (item.spec ?? {}) as Record<string, unknown>;
  const status = (item.status ?? {}) as Record<string, unknown>;

  /*
   * `podContainersOf` rather than `spec.containers`: the old console's container detail
   * also opens for an init container, and that container's status lives under
   * `initContainerStatuses` — reading only the working containers made an init
   * container's page claim the container does not exist.
   */
  const found = podContainersOf(item).find((entry) => String(entry.container['name'] ?? '') === container)?.container;
  if (!found) return undefined;

  const statusEntries = [
    ...((status['containerStatuses'] ?? []) as Array<Record<string, unknown>>),
    ...((status['initContainerStatuses'] ?? []) as Array<Record<string, unknown>>),
  ];
  const statusEntry = statusEntries.find((entry) => String(entry['name'] ?? '') === container);
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
    imageID: String(statusEntry?.['imageID'] ?? ''),
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
    lifecycle: containerLifecycleHooks(found),
    state: stateKey ? `${stateKey}${stateDetail['reason'] ? ` (${String(stateDetail['reason'])})` : ''}` : '',
    restarts: Number(statusEntry?.['restartCount'] ?? 0),
    startedAt: statusEntry?.['state'] ? String(((stateBlock['running'] ?? {}) as Record<string, unknown>)['startedAt'] ?? '') : '',
  };
}
