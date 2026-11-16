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
import { AiSurface, Badge, Button, Icon, Skeleton, type IconName } from '@kube-ai-hub/ui';
import type { LocaleKey } from '@kube-ai-hub/locales';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel, errorMessage } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { useAuth } from '@/shell/AuthProvider';
import { OverviewComponents } from './OverviewComponents';
import { NodeRankingPanel } from './NodeRankingPanel';
import { UserKubeconfigDialog } from './UserKubeconfigDialog';
import { OverviewResourcePanel } from './OverviewResourcePanel';
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
      {!detail.data ? <Skeleton className="h-64" /> : null}
      {detail.data ? (
        <div className="min-w-0 space-y-4">
          {/* A proxy cluster stays not-ready until its agent is installed, so the
              instructions are part of the page, not a separate document. */}
          <ProxyAgentPanel cluster={cluster} detail={detail.data} />
          <OverviewResourcePanel key={cluster} cluster={cluster} refreshAt={refresh.refreshAt} />
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]" data-ai-id="overview:node-row">
            <OverviewResourcePanel key={`${cluster}:nodes`} cluster={cluster} refreshAt={refresh.refreshAt} nodeOnly />
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
          <Panel title={t('cluster.overview.shortcuts')} icon="wrench" aiId="overview:shortcuts">
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
          </Panel>
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
function Panel({ title, children, icon = 'resource', aiId }: {
  title: string; children: React.ReactNode; icon?: IconName; aiId?: string;
}): React.ReactElement {
  return (
    <section className="rounded-ai-lg border border-ai-line bg-ai-surface-1 p-4" data-ai-id={aiId}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-ai-fg"><Icon name={icon} size={18} />{title}</h2>
      {children}
    </section>
  );
}

/**
 * 代理接入：the manifest a proxy-mode member cluster has to apply.
 *
 * A proxy cluster carries no kubeconfig, so nothing can be verified up front: the agent
 * dials out and the cluster becomes ready afterwards. Without this panel the reader has
 * created a cluster and has no next step — the old console shows the same document on the
 * cluster overview while it is initialising.
 *
 * Rendered only for proxy clusters that are not ready yet; a ready cluster's agent is
 * already running, and a direct cluster never had one.
 */
function ProxyAgentPanel({ cluster, detail }: { cluster: string; detail: ClusterDetail }): React.ReactElement | null {
  const t = useT();
  const [copied, setCopied] = React.useState(false);
  const isProxy = detail.connectionType === 'proxy';
  const query = useQuery({
    queryKey: ['cluster-agent', cluster],
    enabled: isProxy && !detail.ready,
    staleTime: 60_000,
    retry: false,
    queryFn: ({ signal }) => clusterAgentApi(apiClient).deployment({ cluster, signal }),
  });

  if (!isProxy || detail.ready) return null;

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(query.data ?? '');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      // Clipboard blocked (insecure origin): the text is on screen and selectable.
    }
  };

  return (
    <Panel title={t('cluster.add.agentTitle')}>
      <div className="flex flex-col gap-2" data-ai-id="overview:agent-panel">
        <p className="text-sm text-ai-fg-secondary">{t('cluster.add.agentDesc')}</p>
        {query.isError ? (
          /*
           * The manifest comes from the platform's agent service. When that service is
           * not installed the endpoint answers 404 with a message about `tower`; saying
           * so is more useful than "not found", because it explains why the cluster will
           * never become ready.
           */
          <div className="flex flex-col gap-1" role="alert" data-ai-id="overview:agent-unavailable">
            <p className="text-xs text-ai-danger">{t('cluster.add.agentUnavailable')}</p>
            <p className="text-[11px] text-ai-fg-muted">{errorMessage(t, query.error)}</p>
          </div>
        ) : null}
        {query.data ? (
          <React.Fragment>
            <Button variant="secondary" size="sm" onClick={() => void copy()} {...actionProps('overview:agent-copy')}>
              {copied ? t('cluster.add.agentCopied') : t('cluster.add.agentCopy')}
            </Button>
            <pre
              className="max-h-80 overflow-auto rounded-ai-md border border-ai-line bg-ai-surface p-3 font-mono text-[11px] text-ai-fg-secondary"
              data-ai-id="overview:agent-manifest"
            >
              {query.data}
            </pre>
          </React.Fragment>
        ) : query.isPending ? (
          <p className="text-xs text-ai-fg-muted">{t('common.loading')}</p>
        ) : null}
      </div>
    </Panel>
  );
}

function BasicInfoPanel({ detail }: { detail: ClusterDetail }): React.ReactElement {
  const t = useT();
  const status = !detail.enabled
    ? t('cluster.overview.disabled')
    : detail.ready
      ? t('cluster.overview.ready')
      : t('cluster.overview.notReady');
  return (
    <Panel title={t('cluster.overview.basicInfo')} icon="cluster" aiId="overview:basic">
      <dl className="grid grid-cols-1 gap-y-3 text-sm">
        {/*
          * Readiness first: it is the one line that decides whether anything else on
          * this page is actionable. Its message sits beside it because "not ready" alone
          * does not tell an administrator what to do.
          */}
        <div className="flex flex-col gap-1">
          <dt className="text-ai-fg-muted">{t('cluster.column.status')}</dt>
          <dd className="flex flex-wrap items-center gap-2" {...actionProps('overview:status')}>
            <Badge tone={detail.ready && detail.enabled ? 'success' : 'warning'}>{status}</Badge>
            {detail.readyMessage ? <span className="text-xs text-ai-fg-muted">{detail.readyMessage}</span> : null}
          </dd>
        </div>
        <DefinitionRow label={t('cluster.overview.provider')} value={detail.provider || '-'} aiId="overview:provider" />
        <DefinitionRow
          label={t('cluster.overview.kubernetesVersion')}
          value={detail.kubernetesVersion || '-'}
          aiId="overview:kubernetes-version"
        />
        <DefinitionRow
          label={t('cluster.overview.productVersion')}
          value={detail.kubeSphereVersion || '-'}
          aiId="overview:product-version"
        />
        <DefinitionRow label={t('cluster.overview.nodeCount')} value={String(detail.nodeCount)} aiId="overview:node-count" />
        <DefinitionRow label={t('cluster.visibility.title')} aiId="overview:visibility"
          value={t(detail.visibility === 'public' ? 'cluster.visibility.publicHint' : 'cluster.visibility.privateHint')} />
        <DefinitionRow
          label={t('cluster.overview.connectionType')}
          value={detail.connectionType || '-'}
          aiId="overview:connection"
        />
        <DefinitionRow
          label={t('cluster.overview.apiEndpoint')}
          value={detail.kubernetesAPIEndpoint || '-'}
          aiId="overview:api-endpoint"
        />
        {detail.description ? (
          <div className="flex flex-col gap-1">
            <dt className="text-ai-fg-muted">{t('cluster.overview.description_')}</dt>
            <dd className="min-w-0 break-words text-ai-fg-secondary">{detail.description}</dd>
          </div>
        ) : null}
      </dl>
    </Panel>
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

  return (
    <Panel title={t('cluster.overview.kubernetesStatus')} icon="kubernetes" aiId="overview:kubernetes-status">
      {status.isError ? (
        <div className="flex flex-col gap-1 text-sm" {...actionProps('overview:no-kubernetes-status')}>
          <span className="text-ai-fg">{t('cluster.overview.noMetrics')}</span>
        </div>
      ) : status.isLoading || !status.data ? (
        <Skeleton className="h-28" />
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <StatusNumber
            label={t('cluster.overview.requestRate')}
            value={
              status.data.requestRate === undefined
                ? '-'
                : `${round(status.data.requestRate)} ${t('cluster.overview.requestRateUnit')}`
            }
            aiId="overview:request-rate"
          />
          <StatusNumber
            label={t('cluster.overview.requestLatency')}
            value={
              status.data.requestLatencySeconds === undefined
                ? '-'
                : formatLatency(status.data.requestLatencySeconds)
            }
            aiId="overview:request-latency"
          />
          <StatusNumber
            label={t('cluster.overview.scheduled')}
            value={status.data.scheduled === undefined ? '-' : String(status.data.scheduled)}
            aiId="overview:scheduled"
          />
          {/*
            * Emphasised only when non-zero: a scheduler refusing pods is the one number
            * here that means "something needs attention right now".
            */}
          <StatusNumber
            label={t('cluster.overview.scheduleError')}
            value={status.data.error === undefined ? '-' : String(status.data.error)}
            tone={status.data.error ? 'warning' : undefined} aiId="overview:schedule-error"
          />
          <StatusNumber
            label={t('cluster.overview.unschedulable')}
            value={status.data.unschedulable === undefined ? '-' : String(status.data.unschedulable)}
            tone={status.data.unschedulable ? 'warning' : undefined}
            aiId="overview:unschedulable"
          />
        </dl>
      )}
    </Panel>
  );
}

function StatusNumber({
  label,
  value,
  tone,
  aiId,
}: {
  label: string;
  value: string;
  tone?: 'warning' | undefined;
  aiId: string;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-1" {...actionProps(aiId)}>
      <dt className="text-ai-fg-muted">{label}</dt>
      <dd className={`font-medium tabular-nums ${tone === 'warning' ? 'text-ai-warning' : 'text-ai-fg'}`}>{value}</dd>
    </div>
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
    <Panel title={t('cluster.overview.modules')} icon="components">
      <ul className="flex flex-wrap gap-2" {...actionProps('overview:modules')}>
        {enabled.map((module) => (
          <li key={module.key} title={module.key}>
            <Badge tone="success">{moduleLabel(t, module.key)}</Badge>
          </li>
        ))}
      </ul>
      {disabled.length > 0 ? (
        <div className="mt-3 flex flex-col gap-1">
          <span className="text-xs text-ai-fg-muted">
            {t('cluster.overview.notInstalled')} ({disabled.length})
          </span>
          <ul className="flex flex-wrap gap-2">
            {disabled.map((module) => (
              <li key={module.key} className="text-xs text-ai-fg-muted" title={module.key}>
                {moduleLabel(t, module.key)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
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
  const localeKey = KNOWN_MODULES[key];
  return localeKey ? t(localeKey) : key;
}
