import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ApiError, logSearchApi, openPodLogStream, workloadsApi, type WorkloadDetail } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Button, Input, Skeleton, Switch } from '@kube-ai-hub/ui';
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
 * Logs are here twice over: the search-backed history block (the tenant log API, one hour
 * window) and a live tail switched on from the same block. The tail is a plain HTTP chunked
 * read of the pod's `log` subresource — `follow=true` through the BFF proxy, no WebSocket —
 * so it works with the proxy this console already has. Terminal and per-container monitoring
 * are still absent: the first needs a WebSocket exec channel, the second the monitoring range
 * query.
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

/** Lines kept in the live view. A tail is read from the bottom; history above this is dropped. */
export const MAX_LIVE_LOG_LINES = 1000;

/** How often accumulated lines are flushed into React state, in milliseconds. */
const LIVE_FLUSH_MS = 100;

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

type LiveState = 'idle' | 'connecting' | 'streaming' | 'error';

export function ContainerDetailPage({ workspace, cluster, namespace, pod, container }: ContainerDetailPageProps): React.ReactElement {
  const t = useT();
  const query = useQuery({
    queryKey: ['workload-detail', 'pods', pod, namespace],
    queryFn: ({ signal }) => workloadsApi(apiClient, 'pods').get({ name: pod, namespace, cluster, signal }),
  });

  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';
  const [logKeyword, setLogKeyword] = React.useState('');
  /*
   * Live tail is opt-in: the search block is the default because it answers
   * "what does the log say" without holding a connection open. Checking it
   * aborts the search request instead of leaving an unread query in flight.
   */
  const [live, setLive] = React.useState(false);
  const [liveAttempt, setLiveAttempt] = React.useState(0);
  const [liveLines, setLiveLines] = React.useState<string[]>([]);
  const [liveState, setLiveState] = React.useState<LiveState>('idle');
  const [liveError, setLiveError] = React.useState('');
  const liveListRef = React.useRef<HTMLDivElement | null>(null);

  const logs = useQuery({
    queryKey: ['container-logs', pod, container, logKeyword],
    queryFn: ({ signal }) => {
      const endTime = Math.floor(Date.now() / 1000);
      return logSearchApi(apiClient).search({
        namespace,
        pod,
        container,
        ...(logKeyword ? { keyword: logKeyword } : {}),
        startTime: endTime - 3600,
        endTime,
        size: 200,
        signal,
      });
    },
    // The block shows one source at a time; while the live stream owns it the
    // search result would be fetched and never rendered.
    enabled: !live,
  });

  /*
   * One streaming read per session. `liveAttempt` is what the reconnect button
   * bumps: the effect is the only place that owns the connection, so a retry is
   * a re-run rather than a second code path.
   *
   * Lines are batched into state every LIVE_FLUSH_MS: a follow stream replays
   * the container's whole log file first (see `openPodLogStream`), and one
   * setState per line on a 20k-line history is a re-render storm.
   */
  React.useEffect(() => {
    if (!live) return;
    let disposed = false;
    const stream = openPodLogStream(apiClient, {
      cluster,
      namespace,
      pod,
      ...(container ? { container } : {}),
      follow: true,
      timestamps: true,
    });
    let pending: string[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = (): void => {
      timer = undefined;
      if (disposed || pending.length === 0) return;
      const batch = pending;
      pending = [];
      setLiveLines((previous) => {
        const next = previous.concat(batch);
        return next.length > MAX_LIVE_LOG_LINES ? next.slice(-MAX_LIVE_LOG_LINES) : next;
      });
    };

    setLiveLines([]);
    setLiveError('');
    setLiveState('connecting');

    void (async () => {
      try {
        for await (const line of stream) {
          if (disposed) return;
          setLiveState('streaming');
          pending.push(line);
          if (!timer) timer = setTimeout(flush, LIVE_FLUSH_MS);
        }
        // The response ended without an error: the container restarted, the
        // stream was cut, or the log was rotated. That is a disconnect the
        // reader has to see, not a silent stop.
        if (disposed) return;
        flush();
        setLiveState('error');
      } catch (cause) {
        if (disposed) return;
        flush();
        setLiveError(cause instanceof ApiError ? cause.message : '');
        setLiveState('error');
      }
    })();

    return () => {
      disposed = true;
      // Closing the reader aborts the fetch, which closes the connection this
      // BFF hop is streaming through. Without it the upstream follow would
      // outlive the toggle.
      stream.close();
      if (timer) clearTimeout(timer);
    };
  }, [live, liveAttempt, cluster, namespace, pod, container]);

  // Leaving live mode drops the buffer: stale lines behind the search block
  // would be shown again the next time the toggle is switched on.
  React.useEffect(() => {
    if (live) return;
    setLiveLines([]);
    setLiveError('');
    setLiveState('idle');
  }, [live]);

  // A tail is read from the bottom, so keep the newest line in view.
  React.useEffect(() => {
    const list = liveListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [liveLines]);

  const stopLive = React.useCallback(() => setLive(false), []);
  const retryLive = React.useCallback(() => setLiveAttempt((attempt) => attempt + 1), []);

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
          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="container-detail:logs">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-ai-fg">
                {t('container.section.logs')}（{live ? t('container.logs.follow') : t('search.window.1h')}）
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-2 text-xs text-ai-fg-muted">
                  <span
                    className="flex min-h-11 items-center sm:min-h-0"
                    {...actionProps('container-detail:log-follow')}
                  >
                    <Switch
                      className="h-6 w-11 sm:h-5 sm:w-9"
                      checked={live}
                      aria-label={t('container.logs.follow')}
                      onCheckedChange={setLive}
                    />
                  </span>
                  {t('container.logs.follow')}
                </span>
                {live ? (
                  <Button
                    variant="secondary"
                    {...actionProps('container-detail:log-stream-stop')}
                    onClick={stopLive}
                  >
                    {t('container.logs.followStop')}
                  </Button>
                ) : null}
                <Input
                  id="container-detail:log-keyword"
                  value={logKeyword}
                  placeholder={t('search.field.keyword')}
                  disabled={live}
                  {...actionProps('container-detail:log-keyword')}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setLogKeyword(event.target.value)}
                />
              </div>
            </div>
            {live ? (
              <div
                className="flex flex-col gap-2"
                data-ai-id="container-detail:log-stream"
                data-ai-state={liveState === 'error' ? 'error' : liveState === 'streaming' ? 'ready' : 'loading'}
              >
                {liveState === 'connecting' || (liveState === 'streaming' && liveLines.length === 0) ? (
                  <p className="text-xs text-ai-fg-muted">
                    {liveState === 'streaming' ? t('container.logs.followWaiting') : t('container.logs.followConnecting')}
                  </p>
                ) : null}
                {liveState === 'error' ? (
                  <div className="flex flex-wrap items-center gap-2" data-ai-id="container-detail:log-stream-error">
                    <p className="text-xs text-ai-fg-muted">
                      {t('container.logs.followError')}
                      {liveError ? ` ${liveError}` : ''}
                    </p>
                    <Button variant="secondary" {...actionProps('container-detail:log-stream-retry')} onClick={retryLive}>
                      {t('container.logs.followRetry')}
                    </Button>
                  </div>
                ) : null}
                {liveLines.length > 0 ? (
                  <div
                    ref={liveListRef}
                    className="flex max-h-80 flex-col gap-1 overflow-y-auto font-mono text-[11px]"
                    data-ai-id="container-detail:log-stream-list"
                  >
                    {liveLines.map((line, index) => {
                      const parsed = splitLogLine(line);
                      return (
                        <div key={`${index}-${parsed.at}`} className="flex gap-2" data-ai-row={String(index)}>
                          {parsed.at ? <span className="shrink-0 tabular-nums text-ai-fg-muted">{parsed.at}</span> : null}
                          <span className="min-w-0 flex-1 whitespace-pre-wrap break-all text-ai-fg-secondary">{parsed.text}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                <p className="text-[11px] text-ai-fg-muted">{t('container.logs.followHint')}</p>
              </div>
            ) : (
              <React.Fragment>
                {logs.isPending ? <Skeleton className="h-24 w-full" /> : null}
                {logs.isError ? (
                  <p className="text-xs text-ai-fg-muted">{t('container.logsUnavailable')}</p>
                ) : null}
                {logs.data && logs.data.records.length === 0 ? (
                  <p className="text-xs text-ai-fg-muted">{t('search.logs.empty')}</p>
                ) : null}
                {logs.data && logs.data.records.length > 0 ? (
                  <div className="flex max-h-80 flex-col gap-1 overflow-y-auto font-mono text-[11px]" data-ai-id="container-detail:log-list">
                    {logs.data.records.map((record, index) => (
                      <div key={`${record.time}-${index}`} className="flex gap-2" data-ai-row={String(index)}>
                        <span className="shrink-0 tabular-nums text-ai-fg-muted">{record.time}</span>
                        <span className="min-w-0 flex-1 whitespace-pre-wrap break-all text-ai-fg-secondary">{record.log}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </React.Fragment>
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