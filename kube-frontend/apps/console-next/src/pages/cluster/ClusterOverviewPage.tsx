import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  clusterAgentApi,
  clusterApi,
  componentMetricsApi,
  type ClusterDetail,
} from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Button, DescriptionList, Icon, Panel, Skeleton, type DescriptionItem, type IconName } from '@kube-ai-hub/ui';
import type { LocaleKey } from '@kube-ai-hub/locales';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel, errorMessage } from '@/components/resource/ResourceErrorPanel';
import { useAuth } from '@/shell/AuthProvider';
import { OverviewComponents } from './OverviewComponents';
import { NodeRankingPanel } from './NodeRankingPanel';
import { UserKubeconfigDialog } from './UserKubeconfigDialog';
import { OverviewResourcePanel, NodeSummaryPanel } from './OverviewResourcePanel';
import { useOverviewRefresh } from './useOverviewRefresh';
import { KubectlConsoleDialog } from '@/components/resource/KubectlConsoleDialog';

/**
 * 集群概览.
 *
 * Two independent reads, and the page is built so that losing the second one does not
 * take the first down with it:
 *
 * - The cluster object says **what the cluster is** — provider, versions, readiness,
 *   and which optional modules the installation has enabled.
 * - The monitoring API says **how busy it is**.
 *
 * Installations exist without a monitoring backend (the old console's own cluster
 * overview degrades the same way). Failing the whole page because a *usage* panel has no
 * data would hide the version and module information, which is static and always
 * available. So the usage panel states that metrics are unavailable and everything else
 * renders normally.
 */
export interface ClusterOverviewPageProps {
  cluster: string;
}

export function ClusterOverviewPage({ cluster }: ClusterOverviewPageProps): React.ReactElement {
  const t = useT();
  const { user } = useAuth();
  const [configOwner, setConfigOwner] = React.useState<string | null>(null);
  const [terminalOwner, setTerminalOwner] = React.useState<string | null>(null);
  const owner = `${cluster}/${user?.name ?? ''}`;
  React.useEffect(() => { setConfigOwner(null); setTerminalOwner(null); }, [owner]);
  const detail = useQuery({
    queryKey: ['cluster-detail', cluster],
    queryFn: ({ signal }) => clusterApi(apiClient).get({ cluster, signal }),
  });
  const refresh = useOverviewRefresh(cluster);

  if (detail.isError) {
    return <ResourceErrorPanel error={detail.error} onRetry={() => void detail.refetch()} retryAiId="overview:retry" />;
  }

  const state = detail.isLoading ? 'loading' : 'ready';

  return (
    <AiSurface
      aiId="overview:surface"
      state={detail.data ? state : 'loading'}
      className="flex min-w-0 flex-col gap-5"
      {...actionProps('overview:surface')}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold text-ai-fg">{cluster} · {t('cluster.overview.title')}</h1>
        <p className="text-sm text-ai-fg-muted">{t('cluster.overview.description')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" aria-pressed={refresh.auto}
            aria-label={t(refresh.auto ? 'cluster.overview.autoPauseLabel' : 'cluster.overview.autoResumeLabel')}
            title={t(refresh.auto ? 'cluster.overview.autoPauseLabel' : 'cluster.overview.autoResumeLabel')}
            data-ai-id="overview:auto-refresh" onClick={() => refresh.setAuto(!refresh.auto)}>
            <Icon name={refresh.auto ? 'pause' : 'start'} />
            {t(refresh.auto ? 'cluster.overview.autoOn' : 'cluster.overview.autoOff')}
          </Button>
          <Button size="sm" variant="ghost" loading={refresh.busy} data-ai-id="overview:refresh"
            onClick={() => void refresh.refresh()}>
            {!refresh.busy ? <Icon name="refresh" /> : null}{t('common.refresh')}
          </Button>
          <Button variant="primary" disabled={!user} data-ai-id="overview:shortcut:kubectl" onClick={() => setTerminalOwner(owner)}>
            <Icon name="terminal" />{t('cluster.overview.shortcut.kubectl')}
          </Button>
        </div>
      </header>
      {refresh.failed ? <p role="alert" className="text-xs text-ai-warning" data-ai-id="overview:refresh-failed">
        {t('cluster.overview.refreshFailed')}
      </p> : null}
      {/*
       * A slow read, not a failed one. The distinction matters on a member cluster reached
       * through the agent: the same endpoint answers in 0.1s or in 30s depending on the
       * link, and a reader who sees an unchanged skeleton for half a minute has no way to
       * tell "still working" from "broken". Saying so once, in a muted line, is cheaper
       * than a spinner that has to animate for 30 seconds to make the same point.
       */}
      {refresh.slow && !refresh.failed ? <p role="status" className="text-xs text-ai-fg-muted" data-ai-id="overview:slow-read">
        {t('cluster.overview.slowRead')}
      </p> : null}
      {!detail.data ? <Skeleton className="h-64" /> : null}
      {/*
       * A cluster that is not ready has nothing to report: no metrics, no nodes, no
       * module status. Rendering the normal page anyway would fill it with panels that
       * say "unavailable" and leave the reader hunting for the one block that matters.
       * The old console swaps the whole overview for its Initializing view; this does
       * the same, so the next step is the only thing on screen.
       *
       * The header above stays: it carries the cluster name and the refresh controls,
       * which are still meaningful while waiting.
       */}
      {detail.data && !detail.data.ready ? (
        <WaitingForCluster cluster={cluster} detail={detail.data} />
      ) : null}
      {detail.data && detail.data.ready ? (
        <div className="min-w-0 space-y-4">
          <OverviewResourcePanel key={cluster} cluster={cluster} refreshAt={refresh.refreshAt} />
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]" data-ai-id="overview:node-row">
            <NodeSummaryPanel key={`${cluster}:nodes`} cluster={cluster} />
            <NodeRankingPanel cluster={cluster} preview />
          </div>
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]" data-ai-id="overview:secondary">
          <aside className="min-w-0 space-y-4" data-ai-id="overview:identity-column">
            <BasicInfoPanel detail={detail.data} />
            <KubernetesStatusPanel cluster={cluster} />
          </aside>
          <div className="min-w-0 space-y-4">
          <OverviewComponents cluster={cluster} />
          <ModulesPanel detail={detail.data} />
          <OverviewPanel title={t('cluster.overview.shortcuts')} icon="wrench" aiId="overview:shortcuts">
            <nav className="grid grid-cols-2 items-stretch gap-2" aria-label={t('cluster.overview.shortcuts')}>
              {(['nodes', 'gpus', 'monitor'] as const).map((page) => <Button key={page} asChild
                variant="secondary" className="h-12 w-full justify-start px-4 text-left">
                <Link to={`/kube-frontend/clusters/$cluster/${page}`} params={{ cluster }}
                  data-ai-id={`overview:shortcut:${page}`}>
                  <Icon name={page === 'gpus' ? 'gpu' : page === 'monitor' ? 'monitor' : 'nodes'} />
                  <span>{t(`cluster.overview.shortcut.${page}`)}</span>
                </Link>
              </Button>)}
              <Button variant="secondary" disabled={!user} data-ai-id="overview:kubeconfig-open"
                className="h-12 w-full justify-start px-4 text-left"
                onClick={() => setConfigOwner(owner)}><Icon name="file" /><span>kubeconfig</span></Button>
            </nav>
          </OverviewPanel>
          </div>
          </div>
        </div>
      ) : null}
      {configOwner === owner && user ? <UserKubeconfigDialog key={owner} cluster={cluster} username={user.name}
        onClose={() => setConfigOwner(null)} /> : null}
      {terminalOwner === owner && user ? <KubectlConsoleDialog key={owner} cluster={cluster}
        onClose={() => setTerminalOwner(null)} /> : null}
    </AiSurface>
  );
}

/** A titled block; every panel on this page has the same shape. */
function OverviewPanel({ title, children, icon = 'resource', aiId, actions, className }: {
  title: string; children: React.ComponentProps<typeof Panel>['children'];
  icon?: IconName; aiId?: string; actions?: React.ComponentProps<typeof Panel>['actions']; className?: string;
}): React.ReactElement {
  return (
    <Panel title={title} icon={icon} titleLevel={2} className={className}
      {...(aiId ? { 'data-ai-id': aiId } : {})} {...(actions ? { actions } : {})}>
      {children}
    </Panel>
  );
}

/**
 * 等待集群加入：what the overview shows instead of itself while a cluster is not ready.
 *
 * A cluster that has not joined yet has nothing to report — no metrics, no nodes, no
 * module status — so the normal page would be a wall of "unavailable" panels with the
 * one block that matters buried among them. The old console replaces the whole overview
 * with its Initializing view (`Overview/index.jsx` renders `<Initializing>` when
 * `!isReady`); this keeps that decision and ports its three-step agent guide.
 *
 * Two shapes, because two things can be wrong:
 *
 * - **proxy** without an agent: the reader still has to apply a manifest, so the steps
 *   are the page. The manifest comes from the platform's agent service; when that is not
 *   installed the endpoint answers 404 mentioning `tower`, and saying so explains why the
 *   cluster will never become ready — better than "not found".
 * - **anything else**: the cluster is expected to join on its own (a direct cluster still
 *   initialising, or a proxy cluster whose agent was just applied). There is no action to
 *   take, so the page says it is waiting and refreshes itself.
 */
function WaitingForCluster({ cluster, detail }: {
  cluster: string;
  detail: ClusterDetail;
}): React.ReactElement {
  const t = useT();
  const isProxy = detail.connectionType === 'proxy';
  const query = useQuery({
    queryKey: ['cluster-agent', cluster],
    enabled: isProxy,
    staleTime: 60_000,
    retry: false,
    queryFn: ({ signal }) => clusterAgentApi(apiClient).deployment({ cluster, signal }),
  });

  /*
   * The old copy wraps a command in `<span class="code">` inline. `t()` returns a plain
   * string, so the sentence is split on the placeholder and the command re-inserted as a
   * real element — the translation stays a sentence, not markup.
   *
   * The placeholder name and the command are separate arguments: passing the command to
   * `t()` as a param would substitute it as plain text, and splitting on the command
   * itself would find nothing.
   */
  const step = (key: LocaleKey, placeholder: string, command: string): React.ReactNode => {
    const [before, after = ''] = t(key).split(`{${placeholder}}`);
    return <>{before}<code className="rounded-ai-sm bg-ai-surface-2 px-1.5 py-0.5 font-ai-mono text-[11px] text-ai-fg">{command}</code>{after}</>;
  };

  return (
    <Panel title={t('cluster.overview.waitTitle')} icon="cluster" titleLevel={2} data-ai-id="overview:waiting">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 animate-spin text-ai-link motion-reduce:animate-none" aria-hidden="true">
            <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
            <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div className="min-w-0">
            <p className="text-sm text-ai-fg">{t('cluster.overview.waitDesc')}</p>
            {/*
             * The controller's own sentence when it has one ("Agent has connected…").
             * Otherwise stay silent: the refresh control below already says the page
             * keeps itself current, and repeating that here reads as two separate facts.
             */}
            {detail.readyMessage ? (
              <p className="mt-1 text-xs text-ai-fg-muted" data-ai-id="overview:waiting-hint">
                {detail.readyMessage}
              </p>
            ) : null}
          </div>
        </div>

        {isProxy ? (
          /*
           * Numbered by the list itself, not by the copy: the old console put "1." inside
           * the translation string, which forces every locale to keep the same
           * punctuation and makes the number impossible to restyle. `list-decimal` plus a
           * marker style does the same job and leaves the sentence a sentence.
           */
          <ol className="flex list-decimal flex-col gap-2 pl-6 marker:font-medium marker:text-ai-fg-muted" data-ai-id="overview:agent-steps">
            <li className="rounded-ai-md border border-ai-line bg-ai-surface-1 p-3 text-sm text-ai-fg-secondary">
              <span className="block">{step('cluster.overview.agentStep1', 'cmd', 'vi agent.yaml')}</span>
            </li>
            <li className="rounded-ai-md border border-ai-line bg-ai-surface-1 p-3" data-ai-id="overview:agent-manifest-step">
              <span className="block text-sm text-ai-fg-secondary">
                {step('cluster.overview.agentStep2', 'file', 'agent.yaml')}
              </span>
              {query.isError ? (
                <div className="mt-2 flex flex-col gap-1" role="alert" data-ai-id="overview:agent-unavailable">
                  <p className="text-xs text-ai-danger">{t('cluster.add.agentUnavailable')}</p>
                  <p className="text-[11px] text-ai-fg-muted">{errorMessage(t, query.error)}</p>
                </div>
              ) : null}
              {query.data ? (
                <div className="mt-2 flex flex-col gap-2">
                  {/*
                   * The manifest is YAML, so it is shown in the shared editor rather than a
                   * `<pre>`: syntax highlighting and line numbers make a 30-line document
                   * readable, and the same component is what the add-cluster dialog and the
                   * YAML edit dialogs use, so it looks like the rest of the product.
                   *
                   * Lazy, like those dialogs: CodeMirror is ~188 KB gzip and a reader who
                   * never sees a waiting cluster should not download it.
                   */}
                  <React.Suspense fallback={<div className="h-[28rem] animate-pulse rounded-ai-md bg-ai-surface-2" />}>
                    <ManifestEditor value={query.data} ariaLabel={t('cluster.add.agentTitle')}
                      copyLabel={t('yaml.copy')} copiedLabel={t('yaml.copied')} />
                  </React.Suspense>
                </div>
              ) : query.isPending ? (
                <p className="mt-2 text-xs text-ai-fg-muted">{t('common.loading')}</p>
              ) : null}
            </li>
            <li className="rounded-ai-md border border-ai-line bg-ai-surface-1 p-3" data-ai-id="overview:agent-apply-step">
              <span className="block text-sm text-ai-fg-secondary">
                {step('cluster.overview.agentStep3', 'cmd', 'kubectl create -f agent.yaml')}
              </span>
              <span className="mt-1 block text-xs text-ai-fg-muted">{t('cluster.overview.agentStep3Hint')}</span>
            </li>
          </ol>
        ) : null}

        {/*
         * No refresh button and no "this page refreshes itself" line: the header above
         * already carries the button, and the spinner beside the description is what
         * says the page is still working. A sentence repeating that is a third way of
         * stating one fact.
         */}
      </div>
    </Panel>
  );
}

/**
 * The read-only YAML view for the join manifest.
 *
 * Kept as its own lazy component for the same reason `AddClusterDialog` does it: the
 * editor pulls CodeMirror in, and the overview is a page people open constantly while
 * only a not-ready proxy cluster needs this. Importing it at module scope would put
 * ~188 KB gzip into the overview chunk for everyone.
 *
 * `height` is generous rather than tight: the manifest is ~30 lines, and a box that shows
 * a third of it forces scrolling to check a single field. A fixed height still keeps the
 * three-step list from jumping as the document loads.
 */
const ManifestEditor = React.lazy(() =>
  import('@kube-ai-hub/ui/editor').then((module) => ({
    default: ({ value, ariaLabel, copyLabel, copiedLabel }: {
      value: string; ariaLabel: string; copyLabel: string; copiedLabel: string;
    }) => (
      <div data-ai-id="overview:agent-manifest">
        <module.YamlEditor value={value} readOnly height="28rem" ariaLabel={ariaLabel}
          copyLabel={copyLabel} copiedLabel={copiedLabel} />
      </div>
    ),
  })),
);

function BasicInfoPanel({ detail }: { detail: ClusterDetail }): React.ReactElement {
  const t = useT();
  const status = !detail.enabled
    ? t('cluster.overview.disabled')
    : detail.ready
      ? t('cluster.overview.ready')
      : t('cluster.overview.notReady');
  const visibility = detail.visibility === 'public'
    ? { short: t('cluster.visibility.public'), hint: t('cluster.visibility.publicHint') }
    : { short: t('cluster.visibility.private'), hint: t('cluster.visibility.privateHint') };
  /*
   * Readiness first: it is the one line that decides whether anything else on this page
   * is actionable.
   *
   * The condition message is shown only when the cluster is **not** ready. On a ready
   * cluster the controller reports something like "Cluster is available now", which says
   * nothing the green badge has not already said — the same rule the cluster list uses.
   * When it is not ready, that sentence is the only thing that tells an administrator what
   * to do, so it stays and sits beside the badge.
   *
   * The message is part of the value, not a `hint`: automation reads this field's text to
   * decide whether the controller's own explanation is on screen, and a hint outside the
   * value node would be invisible to it.
   */
  const healthy = detail.ready && detail.enabled;
  const items: DescriptionItem[] = [
    {
      label: t('cluster.column.status'),
      value: (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge tone={healthy ? 'success' : 'warning'}>{status}</Badge>
          {!healthy && detail.readyMessage ? <span className="text-[11px] text-ai-fg-muted">{detail.readyMessage}</span> : null}
        </span>
      ),
      aiId: 'overview:status',
    },
    { label: t('cluster.overview.provider'), value: detail.provider || '-', aiId: 'overview:provider' },
    { label: t('cluster.overview.kubernetesVersion'), value: detail.kubernetesVersion || '-', aiId: 'overview:kubernetes-version' },
    { label: t('cluster.overview.productVersion'), value: detail.kubeSphereVersion || '-', aiId: 'overview:product-version' },
    { label: t('cluster.overview.nodeCount'), value: String(detail.nodeCount), aiId: 'overview:node-count' },
    {
      label: t('cluster.visibility.title'),
      value: (
        <span className="flex flex-col gap-0.5">
          <span>{visibility.short}</span>
          <span className="text-[11px] text-ai-fg-muted">{visibility.hint}</span>
        </span>
      ),
      aiId: 'overview:visibility',
    },
    { label: t('cluster.overview.connectionType'), value: detail.connectionType || '-', aiId: 'overview:connection' },
    { label: t('cluster.overview.apiEndpoint'), value: detail.kubernetesAPIEndpoint || '-', aiId: 'overview:api-endpoint' },
    ...(detail.description
      ? [{ label: t('cluster.overview.description_'), value: detail.description, aiId: 'overview:description' }]
      : []),
  ];
  return (
    <OverviewPanel title={t('cluster.overview.basicInfo')} icon="cluster" aiId="overview:basic">
      <DescriptionList items={items} variant="dense" divided />
    </OverviewPanel>
  );
}

/**
 * Kubernetes 状态.
 *
 * Three control-plane numbers the old console's dashboard also shows, and the reason
 * they belong next to resource usage: capacity and health are independent. A cluster
 * with 400 free cores still cannot run anything if its scheduler is refusing pods, and
 * "unschedulable" climbing is the only visible symptom of that.
 */
function KubernetesStatusPanel({ cluster }: { cluster: string }): React.ReactElement {
  const t = useT();
  const status = useQuery({
    queryKey: ['kubernetes-status', cluster],
    queryFn: ({ signal }) => componentMetricsApi(apiClient).kubernetesStatus({ cluster, signal }),
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const items: DescriptionItem[] = status.isLoading || !status.data ? [] : [
    {
      label: t('cluster.overview.requestRate'),
      value: status.data.requestRate === undefined
        ? '-'
        : `${round(status.data.requestRate)} ${t('cluster.overview.requestRateUnit')}`,
      aiId: 'overview:request-rate',
    },
    {
      label: t('cluster.overview.requestLatency'),
      value: status.data.requestLatencySeconds === undefined ? '-' : formatLatency(status.data.requestLatencySeconds),
      aiId: 'overview:request-latency',
    },
    {
      label: t('cluster.overview.scheduled'),
      value: status.data.scheduled === undefined ? '-' : String(status.data.scheduled),
      aiId: 'overview:scheduled',
    },
    /*
     * Emphasised only when non-zero: a scheduler refusing pods is the one number here
     * that means "something needs attention right now".
     */
    {
      label: t('cluster.overview.scheduleError'),
      value: status.data.error === undefined
        ? '-'
        : <StatusValue value={status.data.error} tone={status.data.error ? 'warning' : undefined} />,
      aiId: 'overview:schedule-error',
    },
    {
      label: t('cluster.overview.unschedulable'),
      value: status.data.unschedulable === undefined
        ? '-'
        : <StatusValue value={status.data.unschedulable} tone={status.data.unschedulable ? 'warning' : undefined} />,
      aiId: 'overview:unschedulable',
    },
  ];
  return (
    <OverviewPanel title={t('cluster.overview.kubernetesStatus')} icon="kubernetes" aiId="overview:kubernetes-status">
      {status.isError ? (
        <div className="flex flex-col gap-1 text-sm" {...actionProps('overview:no-kubernetes-status')}>
          <span className="text-ai-fg">{t('cluster.overview.noMetrics')}</span>
        </div>
      ) : status.isLoading || !status.data ? (
        <Skeleton className="h-28" />
      ) : (
        <DescriptionList items={items} variant="dense" divided />
      )}
    </OverviewPanel>
  );
}

/**
 * A scheduler count.
 *
 * The number itself is what a reader compares, so it is set in tabular figures and, when
 * non-zero, carries the warning colour plus a short bar on the left: colour alone would
 * be invisible to a reader who cannot distinguish it, and the bar survives a greyscale
 * screenshot.
 */
function StatusValue({ value, tone }: { value: number; tone?: 'warning' | undefined }): React.ReactElement {
  if (tone !== 'warning') return <span className="tabular-nums">{value}</span>;
  return (
    <span className="flex items-center gap-2 font-medium tabular-nums text-ai-warning">
      <span aria-hidden className="h-3 w-0.5 rounded-ai-pill bg-ai-warning" />
      {value}
    </span>
  );
}

/** A latency of 5.2ms is written as 5.2 ms; a full second or more as seconds. */
function formatLatency(seconds: number): string {
  if (seconds < 1) return `${round(seconds * 1000)} ms`;
  return `${round(seconds)} s`;
}

/** Two significant decimals without trailing zeros: 56.2166 → 56.22. */
function round(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/**
 * Installed modules.

 * The old console draws these as icons for the six modules it ships with. Reading
 * "status.configz" instead shows exactly what the installation reports — including
 * modules the old console never had a picture for, and excluding ones it always drew
 * (this build has no DevOps, and a grey DevOps icon invites support questions about a
 * module that is simply not part of the product).
 */
function ModulesPanel({ detail }: { detail: ClusterDetail }): React.ReactElement {
  const t = useT();
  const enabled = detail.modules.filter((m) => m.enabled);
  const disabled = detail.modules.filter((m) => !m.enabled);
  return (
    <OverviewPanel title={t('cluster.overview.modules')} icon="components"
      actions={<span className="text-xs tabular-nums text-ai-fg-muted" data-ai-id="overview:module-count">
        {enabled.length}/{detail.modules.length}
      </span>}>
      <ul className="flex flex-wrap gap-1.5" {...actionProps('overview:modules')}>
        {enabled.map((module) => (
          <li key={module.key} title={module.key}>
            <Badge tone="success">{moduleLabel(t, module.key)}</Badge>
          </li>
        ))}
      </ul>
      {disabled.length > 0 ? (
        <div className="mt-3 flex flex-col gap-1.5 border-t border-ai-line pt-3">
          <span className="text-[11px] text-ai-fg-muted">
            {t('cluster.overview.notInstalled')} ({disabled.length})
          </span>
          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {disabled.map((module) => (
              <li key={module.key} className="text-[11px] text-ai-fg-muted" title={module.key}>
                {moduleLabel(t, module.key)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </OverviewPanel>
  );
}

/**
 * A module's own name in the reader's language, falling back to the raw `configz` key.
 *
 * The raw key stays in the tooltip. `configz` is open-ended — any installed plugin may
 * add one — so an unknown key must still render, but a known one reads better as 日志
 * than as `logging`.
 */
const KNOWN_MODULES: Record<string, LocaleKey> = {
  alerting: 'cluster.overview.module.alerting',
  auditing: 'cluster.overview.module.auditing',
  authentication: 'cluster.overview.module.authentication',
  authorization: 'cluster.overview.module.authorization',
  cache: 'cluster.overview.module.cache',
  devops: 'cluster.overview.module.devops',
  edgeruntime: 'cluster.overview.module.edgeruntime',
  events: 'cluster.overview.module.events',
  gateway: 'cluster.overview.module.gateway',
  gpu: 'cluster.overview.module.gpu',
  kubeedge: 'cluster.overview.module.kubeedge',
  kubernetes: 'cluster.overview.module.kubernetes',
  logging: 'cluster.overview.module.logging',
  metering: 'cluster.overview.module.metering',
  monitoring: 'cluster.overview.module.monitoring',
  multicluster: 'cluster.overview.module.multicluster',
  network: 'cluster.overview.module.network',
  notification: 'cluster.overview.module.notification',
  openpitrix: 'cluster.overview.module.openpitrix',
  servicemesh: 'cluster.overview.module.servicemesh',
  terminal: 'cluster.overview.module.terminal',
};

function moduleLabel(t: ReturnType<typeof useT>, key: string): string {
  // `configz` reports sub-modules too (`network.ippool`, `openpitrix.appstore`), so an exact match
  // is not enough: fall back to the module's first segment, and only then to the raw key. Showing
  // `network.ippool` to a reader is a missing label, not a feature.
  const localeKey = KNOWN_MODULES[key] ?? KNOWN_MODULES[key.split('.')[0] ?? ''];
  return localeKey ? t(localeKey) : key;
}
