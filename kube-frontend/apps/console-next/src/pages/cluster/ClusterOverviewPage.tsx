import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  clusterAgentApi,
  clusterApi,
  clusterMetricsApi,
  componentMetricsApi,
  type ClusterDetail,
} from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Button } from '@kube-ai-hub/ui';
import type { LocaleKey } from '@kube-ai-hub/locales';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel, errorMessage } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';

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
  const detail = useQuery({
    queryKey: ['cluster-detail', cluster],
    queryFn: ({ signal }) => clusterApi(apiClient).get({ cluster, signal }),
  });

  if (detail.isError) {
    return <ResourceErrorPanel error={detail.error} onRetry={() => void detail.refetch()} retryAiId="overview:retry" />;
  }

  const state = detail.isLoading ? 'loading' : 'ready';

  return (
    <AiSurface
      aiId="overview:surface"
      state={detail.data ? state : 'loading'}
      className="flex flex-col gap-4"
      {...actionProps('overview:surface')}
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-ai-fg">{t('cluster.overview.title')}</h1>
        <p className="text-sm text-ai-fg-muted">{t('cluster.overview.description')}</p>
      </header>
      {detail.data ? (
        <React.Fragment>
          <BasicInfoPanel detail={detail.data} />
          {/* A proxy cluster stays not-ready until its agent is installed, so the
              instructions are part of the page, not a separate document. */}
          <ProxyAgentPanel cluster={cluster} detail={detail.data} />
          <UsagePanel cluster={cluster} />
          <KubernetesStatusPanel cluster={cluster} />
          <ModulesPanel detail={detail.data} />
        </React.Fragment>
      ) : null}
    </AiSurface>
  );
}

/** A titled block; every panel on this page has the same shape. */
function Panel({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section className="rounded-lg border border-ai-border bg-ai-surface p-4">
      <h2 className="mb-3 text-sm font-medium text-ai-fg">{title}</h2>
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
    <Panel title={t('cluster.overview.basicInfo')}>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        {/*
          * Readiness first: it is the one line that decides whether anything else on
          * this page is actionable. Its message sits beside it because "not ready" alone
          * does not tell an administrator what to do.
          */}
        <div className="flex flex-col gap-1 sm:col-span-2">
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
          label={t('cluster.overview.kubeSphereVersion')}
          value={detail.kubeSphereVersion || '-'}
          aiId="overview:kubesphere-version"
        />
        <DefinitionRow label={t('cluster.overview.nodeCount')} value={String(detail.nodeCount)} aiId="overview:node-count" />
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
          <div className="flex flex-col gap-1 sm:col-span-2">
            <dt className="text-ai-fg-muted">{t('cluster.overview.description_')}</dt>
            <dd className="min-w-0 break-words text-ai-fg-secondary">{detail.description}</dd>
          </div>
        ) : null}
      </dl>
    </Panel>
  );
}

/**
 * Resource usage.
 *
 * The three numbers are shown as used/total, not as a bare percentage: 20 cores out of
 * 512 and 20 out of 24 are the same percentage and completely different situations.
 * "Allocated" is shown next to "used" because they answer different questions — a
 * cluster can be 40% used and 100% allocated, which means new pods will not schedule.
 */
function UsagePanel({ cluster }: { cluster: string }): React.ReactElement {
  const t = useT();
  const usage = useQuery({
    queryKey: ['cluster-usage', cluster],
    queryFn: ({ signal }) => clusterMetricsApi(apiClient).usage({ cluster, signal }),
    // Metrics move; a stale figure with no visible timestamp is a lie by omission.
    staleTime: 30_000,
    retry: false,
  });

  return (
    <Panel title={t('cluster.overview.usage')}>
      {usage.isError ? (
        /*
         * Not an error page: the rest of the overview is still valid. Saying so
         * explicitly stops the empty panel from reading as "this cluster uses nothing".
         */
        <div className="flex flex-col gap-1 text-sm" {...actionProps('overview:no-metrics')}>
          <span className="text-ai-fg">{t('cluster.overview.noMetrics')}</span>
          <span className="text-xs text-ai-fg-muted">{t('cluster.overview.noMetricsHint')}</span>
        </div>
      ) : usage.isLoading || !usage.data ? (
        <p className="text-sm text-ai-fg-muted">-</p>
      ) : (
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <UsageRow
            label={t('cluster.overview.cpu')}
            used={formatCores(usage.data.cpuUsedCores)}
            total={formatCores(usage.data.cpuTotalCores)}
            allocated={formatCores(usage.data.cpuAllocatedCores)}
            ratioValue={ratio(usage.data.cpuUsedCores, usage.data.cpuTotalCores)}
            aiId="overview:usage-cpu"
          />
          <UsageRow
            label={t('cluster.overview.memory')}
            used={formatBytes(usage.data.memoryUsedBytes)}
            total={formatBytes(usage.data.memoryTotalBytes)}
            allocated={formatBytes(usage.data.memoryAllocatedBytes)}
            ratioValue={ratio(usage.data.memoryUsedBytes, usage.data.memoryTotalBytes)}
            aiId="overview:usage-memory"
          />
          <UsageRow
            label={t('cluster.overview.pods')}
            used={String(usage.data.podRunning)}
            total={String(usage.data.podCapacity)}
            ratioValue={ratio(usage.data.podRunning, usage.data.podCapacity)}
            aiId="overview:usage-pods"
          />
          <UsageRow
            label={t('cluster.overview.nodes')}
            used={String(usage.data.nodeReady)}
            total={String(usage.data.nodeTotal)}
            ratioValue={ratio(usage.data.nodeReady, usage.data.nodeTotal)}
            aiId="overview:usage-nodes"
          />
          {/*
            * GPUs only when the cluster reports a total. A cluster with none would
            * otherwise show "0 / 0", which reads as a broken GPU feature rather than as
            * a normal CPU-only cluster.
            */}
          {/*
            * GPUs are counted in cards, not percent: an administrator allocates whole
            * cards, and "6 / 15" answers "can I schedule another GPU job" while "40%"
            * does not. Compute utilisation is the extra line, because a card can be
            * reserved and idle.
            */}
          {usage.data.gpuTotal > 0 ? (
            <UsageRow
              label={t('cluster.overview.gpuCards')}
              used={String(usage.data.gpuAllocated)}
              total={String(usage.data.gpuTotal)}
              ratioValue={ratio(usage.data.gpuAllocated, usage.data.gpuTotal)}
              extra={
                usage.data.gpuUtilisation === undefined
                  ? undefined
                  : `${t('cluster.overview.gpuUtilisation')} ${percent(usage.data.gpuUtilisation)}`
              }
              aiId="overview:usage-gpu"
            />
          ) : null}
        </dl>
      )}
    </Panel>
  );
}

function UsageRow({
  label,
  used,
  total,
  allocated,
  extra,
  ratioValue,
  aiId,
}: {
  label: string;
  used: string;
  total: string;
  allocated?: string | undefined;
  /** A second measurement of the same resource, e.g. GPU compute utilisation. */
  extra?: string | undefined;
  ratioValue: number;
  aiId: string;
}): React.ReactElement {
  const t = useT();
  const clamped = Math.max(0, Math.min(1, ratioValue));
  return (
    <div className="flex flex-col gap-1" {...actionProps(aiId)}>
      <dt className="text-ai-fg-muted">{label}</dt>
      <dd className="flex flex-col gap-1">
        <span className="font-medium tabular-nums text-ai-fg">
          {used} / {total}
        </span>
        {/* Bar and number, not colour alone: colour is not readable for everyone. */}
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-ai-border">
            <span className="block h-full rounded-full bg-ai-accent" style={{ width: barWidth(clamped) }} />
          </span>
          <span className="text-xs tabular-nums text-ai-fg-muted">{Math.round(clamped * 100)}%</span>
        </span>
        {allocated ? (
          <span className="text-xs text-ai-fg-muted">
            {t('cluster.overview.allocated')} {allocated}
          </span>
        ) : null}
        {extra ? <span className="text-xs text-ai-fg-muted">{extra}</span> : null}
      </dd>
    </div>
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
  });

  return (
    <Panel title={t('cluster.overview.kubernetesStatus')}>
      {status.isError ? (
        <div className="flex flex-col gap-1 text-sm" {...actionProps('overview:no-kubernetes-status')}>
          <span className="text-ai-fg">{t('cluster.overview.noMetrics')}</span>
        </div>
      ) : status.isLoading || !status.data ? (
        <p className="text-sm text-ai-fg-muted">-</p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4">
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
    <Panel title={t('cluster.overview.modules')}>
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

function ratio(used: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return used / total;
}

function percent(value: number | undefined): string {
  if (value === undefined) return '-';
  return Math.round(value * 100) + '%';
}

function barWidth(fraction: number): string {
  return Math.round(fraction * 100) + '%';
}

function formatCores(cores: number): string {
  if (cores <= 0) return '0';
  return cores < 10 ? cores.toFixed(2) : cores.toFixed(0);
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0';
  const units = ['B', 'Ki', 'Mi', 'Gi', 'Ti'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return value.toFixed(index >= 2 ? 1 : 0) + units[index];
}
