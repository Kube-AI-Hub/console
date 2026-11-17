import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  clusterMetricsApi,
  workspaceDetailApi,
  workspaceMembersApi,
  workspaceUsageApi,
  type WorkspaceClusterSummary,
  type WorkspaceProjectRankMetric,
} from '@kube-ai-hub/api-client';
import { AiSurface, Badge, Skeleton, Tabs, TabsContent } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { formatBytes, formatCpu } from '@/lib/quantity';

/**
 * 企业空间概览.
 *
 * The workspace console is its own scope in the old console (`/workspaces/:ws/*`), sitting above
 * projects and below the platform: one workspace owns many projects, and its manager is not the
 * platform admin. The new UI had only the platform's read-only copy of this page, reachable from
 * 访问控制 — which answers 'what is this workspace' for an auditor, not 'what is in it' for the
 * person who runs it.
 */
export interface WorkspaceOverviewPageProps {
  workspace: string;
}

export function WorkspaceOverviewPage({ workspace }: WorkspaceOverviewPageProps): React.ReactElement {
  const t = useT();
  /*
   * Two tabs, not three.
   *
   * The old console's overview had three sibling tabs (usage / ranking / clusters). The
   * previous delivery already merged usage and ranking into stacked sections of one page
   * and its AC asserts both; splitting them back into tabs would change delivered
   * behaviour for no reader benefit. The cluster cards are the missing tab, so they get
   * their own tab beside the combined resource view.
   */
  const [tab, setTab] = React.useState<'resources' | 'clusters'>('resources');
  const detail = useQuery({
    queryKey: ['workspace-detail', workspace],
    queryFn: ({ signal }) => workspaceDetailApi(apiClient).get({ name: workspace, signal }),
  });
  const projects = useQuery({
    queryKey: ['workspace-projects', workspace],
    queryFn: ({ signal }) => workspaceDetailApi(apiClient).projects({ name: workspace, signal }),
  });
  const members = useQuery({
    queryKey: ['workspace-members', workspace],
    queryFn: ({ signal }) => workspaceMembersApi(apiClient).list({ workspace, signal }),
  });
  /*
   * Same query key as the cluster tab, so the two readers share one request. The basic
   * information's "clusters" row uses it when it resolves: on this deployment the
   * workspace object has no `spec.placement.clusters`, so the object alone renders
   * `-` while the tab can list two clusters — one page must not say both.
   */
  const workspaceClusters = useQuery({
    queryKey: ['workspace-clusters', workspace],
    queryFn: ({ signal }) => workspaceDetailApi(apiClient).clusters({ name: workspace, signal }),
  });

  const loading = detail.isPending || projects.isPending || members.isPending;
  const failed = detail.isError || projects.isError || members.isError;
  const state = loading ? 'loading' : failed ? 'error' : 'ready';
  const data = detail.data;

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="workspace-overview:surface" state="error" className="min-w-0">
        <ResourceErrorPanel
          error={detail.error ?? projects.error ?? members.error}
          onRetry={() => void Promise.all([detail.refetch(), projects.refetch(), members.refetch()])}
          retryAiId="workspace-overview:retry"
        />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="workspace-overview:surface" state={state} className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-ai-fg" data-ai-id="workspace-overview:title">
          {data?.alias || workspace}
        </h1>
        <p className="text-xs text-ai-fg-muted">{t('workspace.overview.description')}</p>
      </header>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}

      {state === 'ready' && data ? (
        <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="workspace-overview:basic">
          <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('workspace.overview.basic')}</h2>
          <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
            {[
              [t('workspace.field.name'), data.name],
              [t('workspace.field.alias'), data.alias || '-'],
              [t('workspace.field.manager'), data.manager || '-'],
              [t('workspace.field.creator'), data.creator || '-'],
              [t('workspace.field.createdAt'), formatTimestamp(data.createdAt)],
              [
                t('workspace.field.clusters'),
                (workspaceClusters.data ?? []).map((cluster) => cluster.alias || cluster.name).join(', ') ||
                  data.clusters.join(', ') ||
                  '-',
              ],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <dt className="text-ai-fg-muted">{label}</dt>
                <dd className="truncate text-ai-fg">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {state === 'ready' ? (
        <Tabs
          value={tab}
          onValueChange={(next) => setTab(next as 'resources' | 'clusters')}
          items={[
            { value: 'resources', label: t('workspace.overview.tab.resources'), aiId: 'workspace-overview:tab:resources' },
            { value: 'clusters', label: t('workspace.overview.tab.clusters'), aiId: 'workspace-overview:tab:clusters' },
          ]}
        >
          <TabsContent value="resources" className="flex flex-col gap-6">
            <WorkspaceUsageSection workspace={workspace} />
            <WorkspaceRankingSection workspace={workspace} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="workspace-overview:projects">
                <h2 className="mb-1 text-sm font-medium text-ai-fg">{t('workspace.overview.projects')}</h2>
                <p className="text-2xl font-semibold tabular-nums text-ai-fg" data-ai-id="workspace-overview:project-count">
                  {projects.data?.length ?? 0}
                </p>
                <a className="text-xs text-ai-link hover:underline" href={`/kube-frontend/workspaces/${encodeURIComponent(workspace)}/projects`}>
                  {t('workspace.overview.viewProjects')}
                </a>
              </section>
              <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="workspace-overview:members">
                <h2 className="mb-1 text-sm font-medium text-ai-fg">{t('workspace.overview.members')}</h2>
                <p className="text-2xl font-semibold tabular-nums text-ai-fg" data-ai-id="workspace-overview:member-count">
                  {members.data?.length ?? 0}
                </p>
                <a className="text-xs text-ai-link hover:underline" href={`/kube-frontend/workspaces/${encodeURIComponent(workspace)}/members`}>
                  {t('workspace.overview.viewMembers')}
                </a>
              </section>
            </div>
          </TabsContent>
          <TabsContent value="clusters">
            <WorkspaceClustersSection workspace={workspace} />
          </TabsContent>
        </Tabs>
      ) : null}
    </AiSurface>
  );
}
/**
 * 企业空间资源用量.
 *
 * The old console puts a usage block on the workspace overview: how much CPU, memory and how many
 * pods the whole workspace consumes. The new page only had project and member counts, which say
 * nothing about load.
 *
 * Storage is deliberately absent: this deployment exposes no workspace-level storage metric
 * (probed — the series is not returned), and printing a 0 for it would claim "nothing stored"
 * rather than "not measured".
 */
function WorkspaceUsageSection({ workspace }: { workspace: string }): React.ReactElement {
  const t = useT();
  const usage = useQuery({
    queryKey: ['workspace-usage', workspace],
    queryFn: ({ signal }) => workspaceUsageApi(apiClient).usage({ workspace, signal }),
  });

  const rows: Array<{ key: string; label: string; value: string }> = [
    { key: 'cpu', label: t('workspace.overview.usage.cpu'), value: fmt(usage.data?.workspace_cpu_usage, (v) => formatCpu(String(v))) },
    { key: 'memory', label: t('workspace.overview.usage.memory'), value: fmt(usage.data?.workspace_memory_usage_wo_cache, (v) => formatBytes(String(v))) },
    { key: 'pods', label: t('workspace.overview.usage.pods'), value: fmt(usage.data?.workspace_pod_count, (v) => String(Math.round(v))) },
    {
      key: 'network',
      label: t('workspace.overview.usage.network'),
      value:
        usage.data?.workspace_net_bytes_received === undefined && usage.data?.workspace_net_bytes_transmitted === undefined
          ? '-'
          : `↓ ${fmt(usage.data?.workspace_net_bytes_received, (v) => formatBytes(String(v)))} · ↑ ${fmt(usage.data?.workspace_net_bytes_transmitted, (v) => formatBytes(String(v)))}`,
    },
  ];

  return (
    <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="workspace-overview:usage">
      <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('workspace.overview.usage.title')}</h2>
      {usage.isPending ? <Skeleton className="h-16 w-full" /> : null}
      {usage.isError ? (
        <p className="text-xs text-ai-fg-muted" data-ai-id="workspace-overview:usage:unavailable">
          {t('workspace.overview.usage.unavailable')}
        </p>
      ) : null}
      {usage.isSuccess ? (
        <dl className="grid grid-cols-2 gap-3 text-xs lg:grid-cols-4" data-ai-id="workspace-overview:usage:list">
          {rows.map((row) => (
            <div key={row.key} className="flex flex-col gap-1 rounded-ai-md border border-ai-line px-3 py-2" data-ai-row={row.key}>
              <dt className="text-ai-fg-muted">{row.label}</dt>
              <dd className="tabular-nums text-ai-fg" data-ai-id={`workspace-overview:usage:${row.key}`}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}

/** Format an optional number, or `-` when the metric is absent — never 0. */
function fmt(value: number | undefined, format: (value: number) => string): string {
  return value === undefined || !Number.isFinite(value) ? '-' : format(value);
}

/**
 * 企业空间项目用量排行（Top 5）.
 *
 * Same reading as the project overview's ranking, one scope up: which projects in this workspace
 * are consuming the most. The ranking endpoint is cluster-wide, so the rows are filtered by the
 * `workspace` label each sample carries.
 */
const WORKSPACE_RANK_METRICS: ReadonlyArray<{ key: WorkspaceProjectRankMetric; labelKey: 'workspace.overview.ranking.cpu' | 'workspace.overview.ranking.memory' }> = [
  { key: 'namespace_cpu_usage', labelKey: 'workspace.overview.ranking.cpu' },
  { key: 'namespace_memory_usage_wo_cache', labelKey: 'workspace.overview.ranking.memory' },
];

function WorkspaceRankingSection({ workspace }: { workspace: string }): React.ReactElement {
  const t = useT();
  const [metric, setMetric] = React.useState<WorkspaceProjectRankMetric>(WORKSPACE_RANK_METRICS[0]!.key);
  const ranking = useQuery({
    queryKey: ['workspace-project-ranking', workspace, metric],
    queryFn: ({ signal }) => workspaceUsageApi(apiClient).projectRanking({ workspace, metric, limit: 5, signal }),
  });
  const rows = ranking.data?.items ?? [];
  const format = (value: number): string =>
    metric === 'namespace_cpu_usage' ? formatCpu(String(value)) : formatBytes(String(value));

  return (
    <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="workspace-overview:ranking">
      <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('workspace.overview.ranking.title')}</h2>
      <Tabs
        value={metric}
        onValueChange={(next) => setMetric(next as WorkspaceProjectRankMetric)}
        items={WORKSPACE_RANK_METRICS.map((item) => ({
          value: item.key,
          label: t(item.labelKey),
          aiId: `workspace-overview:ranking:tab:${item.key === 'namespace_cpu_usage' ? 'cpu' : 'memory'}`,
        }))}
      >
        {WORKSPACE_RANK_METRICS.map((item) => (
          <TabsContent key={item.key} value={item.key}>
            {ranking.isPending ? <Skeleton className="mt-3 h-20 w-full" /> : null}
            {ranking.isError ? (
              <p className="mt-3 text-xs text-ai-fg-muted" data-ai-id="workspace-overview:ranking:unavailable">
                {t('workspace.overview.ranking.unavailable')}
              </p>
            ) : null}
            {ranking.isSuccess && rows.length === 0 ? (
              <p className="mt-3 text-xs text-ai-fg-muted" data-ai-id="workspace-overview:ranking:empty">
                {t('workspace.overview.ranking.empty')}
              </p>
            ) : null}
            {rows.length > 0 ? (
              <ol className="mt-3 flex flex-col gap-2 text-xs" data-ai-id="workspace-overview:ranking:list">
                {rows.map((row, index) => (
                  <li key={row.name} className="flex items-center justify-between gap-3" data-ai-row={row.name}>
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="tabular-nums text-ai-fg-muted">{index + 1}</span>
                      <a
                        className="truncate font-medium text-ai-fg hover:text-ai-accent"
                        href={`/kube-frontend/${encodeURIComponent(workspace)}/projects/${encodeURIComponent(row.name)}/overview`}
                        data-ai-id={`workspace-overview:ranking:name:${row.name}`}
                      >
                        {row.name}
                      </a>
                    </span>
                    <span className="shrink-0 tabular-nums text-ai-fg-secondary">{format(row.value)}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}

/**
 * 企业空间「集群信息」.
 *
 * The workspace manager's question is "where can my projects run, and are those clusters
 * healthy". The old console answered it with a tab of cluster cards and a resource radar;
 * the cards are migrated here, while the radar is not: its CPU/memory/pod/disk numbers are
 * the cluster overview's job, and duplicating them on every workspace visit would be a
 * second definition of the same facts. Each ready card links to that overview.
 *
 * Data comes from the tenant aggregate (`workspaces/<ws>/clusters`), not from the workspace
 * object's placement list: the object only carries names, so it cannot say ready/provider.
 *
 * The old radar chart is replaced by four inline ratios (CPU / memory / pods / disk) on the
 * same card: same four facts, readable without decoding an axis, and a ratio with no
 * denominator shows `-`. The card's link still goes to the cluster overview for the full
 * picture.
 */
/** `private` / `public` → the word the platform uses; unknown values stay verbatim. */
function visibilityLabel(t: (key: 'workspace.overview.clusters.visibility.private' | 'workspace.overview.clusters.visibility.public') => string, value: string): string {
  if (value === 'private') return t('workspace.overview.clusters.visibility.private');
  if (value === 'public') return t('workspace.overview.clusters.visibility.public');
  return value || '-';
}

function WorkspaceClustersSection({ workspace }: { workspace: string }): React.ReactElement {
  const t = useT();
  const clusters = useQuery({
    queryKey: ['workspace-clusters', workspace],
    queryFn: ({ signal }) => workspaceDetailApi(apiClient).clusters({ name: workspace, signal }),
  });
  const rows: WorkspaceClusterSummary[] = clusters.data ?? [];
  const state = clusters.isPending ? 'loading' : clusters.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  return (
    <section
      className="flex flex-col gap-3 rounded-lg border border-ai-border bg-ai-surface p-4"
      data-ai-id="workspace-overview:clusters"
      data-ai-state={state}
    >
      <header className="flex flex-col gap-1">
        <h2 className="text-sm font-medium text-ai-fg">{t('workspace.overview.clusters.title')}</h2>
        <p className="text-xs text-ai-fg-muted">{t('workspace.overview.clusters.description')}</p>
      </header>

      {state === 'loading' ? <Skeleton className="h-24 w-full" /> : null}

      {state === 'error' ? (
        <ResourceErrorPanel
          error={clusters.error}
          onRetry={() => void clusters.refetch()}
          retryAiId="workspace-overview:clusters:retry"
        />
      ) : null}

      {state === 'empty' ? (
        <div className="flex flex-col gap-1 text-xs" data-ai-id="workspace-overview:clusters:empty">
          <p className="text-ai-fg-secondary">{t('workspace.overview.clusters.emptyTitle')}</p>
          <p className="text-ai-fg-muted">{t('workspace.overview.clusters.emptyHint')}</p>
        </div>
      ) : null}

      {state === 'ready' ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" data-ai-id="workspace-overview:clusters:list">
          {rows.map((cluster) => (
            <WorkspaceClusterCard key={cluster.name} cluster={cluster} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
/** A used/total ratio as an integer percentage, or `-` when either side is unknown. */
function usagePercent(used: number | undefined, total: number | undefined): string {
  if (used === undefined || total === undefined) return '-';
  if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) return '-';
  return `${Math.round((used / total) * 100)}%`;
}

/** Detail string behind the ratio, e.g. "2.30 / 32.00 核"; `-` when either side is missing. */
function usageDetail(used: number | undefined, total: number | undefined, format: (value: string) => string): string {
  if (used === undefined || total === undefined) return '-';
  return `${format(String(used))} / ${format(String(total))}`;
}

/** The old card's used / allocated / total triple. Allocated is optional (pods/disk have none). */
function triDetail(
  used: number | undefined,
  allocated: number | undefined,
  total: number | undefined,
  format: (value: string) => string,
): string {
  if (used === undefined && total === undefined) return '-';
  const parts = [
    used === undefined ? '-' : format(String(used)),
    ...(allocated === undefined ? [] : [format(String(allocated))]),
    total === undefined ? '-' : format(String(total)),
  ];
  return parts.join(' / ');
}

/**
 * One workspace cluster card.
 *
 * Each card owns its cluster's metrics query, so one unreachable monitoring backend degrades
 * only the ratios on that card; identity, readiness and the link stay readable. Missing
 * numerator/denominator renders `-` — a 0% would claim an idle cluster.
 */
function WorkspaceClusterCard({ cluster }: { cluster: WorkspaceClusterSummary }): React.ReactElement {
  const t = useT();
  const usage = useQuery({
    queryKey: ['cluster-usage', cluster.name],
    queryFn: ({ signal }) => clusterMetricsApi(apiClient).usage({ cluster: cluster.name, signal }),
    // The card is a summary and the page is not a monitoring surface: a stale ratio for a
    // minute is fine, and refetching on every visit would make the tab pay the metrics bill.
    staleTime: 60_000,
    retry: false,
  });
  const data = usage.data;
  const resourceRows = [
    {
      key: 'cpu',
      label: t('workspace.overview.clusters.usage.cpu'),
      percent: usagePercent(data?.cpuUsedCores, data?.cpuTotalCores),
      detail: triDetail(
        data?.cpuUsedCores,
        data?.cpuAllocatedCores,
        data?.cpuTotalCores,
        (value) => `${formatCpu(value)} ${t('node.list.cores')}`,
      ),
    },
    {
      key: 'memory',
      label: t('workspace.overview.clusters.usage.memory'),
      percent: usagePercent(data?.memoryUsedBytes, data?.memoryTotalBytes),
      detail: triDetail(data?.memoryUsedBytes, data?.memoryAllocatedBytes, data?.memoryTotalBytes, formatBytes),
    },
    {
      key: 'pods',
      label: t('workspace.overview.clusters.usage.pods'),
      percent: usagePercent(data?.podRunning, data?.podCapacity),
      detail: usageDetail(data?.podRunning, data?.podCapacity, (value) => String(Math.round(Number(value)))),
    },
    {
      key: 'disk',
      label: t('workspace.overview.clusters.usage.disk'),
      percent: usagePercent(data?.diskUsedBytes, data?.diskTotalBytes),
      detail: usageDetail(data?.diskUsedBytes, data?.diskTotalBytes, formatBytes),
    },
  ];

  return (
    <li
      className="flex min-w-0 flex-col gap-2 rounded-ai-md border border-ai-line p-3"
      data-ai-row={cluster.name}
      data-ai-id={`workspace-overview:clusters:card:${cluster.name}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="truncate font-medium text-ai-fg">{cluster.alias || cluster.name}</span>
        {cluster.alias ? <span className="font-mono text-[11px] text-ai-fg-muted">{cluster.name}</span> : null}
        <Badge tone={cluster.ready ? 'success' : 'neutral'} data-ai-id={`workspace-overview:clusters:card:${cluster.name}:status`}>
          {cluster.ready ? t('workspace.overview.clusters.ready') : t('workspace.overview.clusters.notReady')}
        </Badge>
      </div>
      {cluster.description ? (
        <p className="truncate text-[11px] text-ai-fg-muted" title={cluster.description}>
          {cluster.description}
        </p>
      ) : null}
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <div className="flex min-w-0 flex-col">
          <dt className="text-ai-fg-muted">{t('workspace.overview.clusters.provider')}</dt>
          <dd
            className="truncate text-ai-fg-secondary"
            title={cluster.provider}
            data-ai-id={`workspace-overview:clusters:card:${cluster.name}:provider`}
          >
            {cluster.provider || '-'}
          </dd>
        </div>
        <div className="flex min-w-0 flex-col">
          <dt className="text-ai-fg-muted">{t('cluster.overview.kubernetesVersion')}</dt>
          <dd className="truncate tabular-nums text-ai-fg-secondary" data-ai-id={`workspace-overview:clusters:card:${cluster.name}:version`}>
            {cluster.kubernetesVersion || '-'}
          </dd>
        </div>
        <div className="flex min-w-0 flex-col">
          <dt className="text-ai-fg-muted">{t('workspace.overview.clusters.nodes')}</dt>
          <dd className="truncate tabular-nums text-ai-fg-secondary" data-ai-id={`workspace-overview:clusters:card:${cluster.name}:nodes`}>
            {cluster.nodeCount === undefined ? '-' : String(cluster.nodeCount)}
          </dd>
        </div>
        <div className="flex min-w-0 flex-col">
          <dt className="text-ai-fg-muted">{t('workspace.overview.clusters.visibility')}</dt>
          <dd className="truncate text-ai-fg-secondary" data-ai-id={`workspace-overview:clusters:card:${cluster.name}:visibility`}>
            {visibilityLabel(t, cluster.visibility)}
          </dd>
        </div>
      </dl>

      <dl
        className="flex flex-col gap-1 border-t border-ai-line pt-2 text-[11px]"
        data-ai-id={`workspace-overview:clusters:card:${cluster.name}:usage`}
        data-ai-state={usage.isPending ? 'loading' : usage.isError ? 'error' : 'ready'}
      >
        {resourceRows.map((row) => (
          <div key={row.key} className="flex min-w-0 items-baseline justify-between gap-3" data-ai-value={row.key}>
            <dt className="w-12 shrink-0 text-ai-fg-muted">{row.label}</dt>
            <dd className="flex min-w-0 flex-1 items-baseline justify-between gap-2 tabular-nums text-ai-fg-secondary">
              <span className="shrink-0" data-ai-id={`workspace-overview:clusters:card:${cluster.name}:usage:${row.key}`}>
                {row.percent}
              </span>
              <span
                className="truncate text-[10px] font-normal text-ai-fg-muted"
                title={row.detail}
                data-ai-id={`workspace-overview:clusters:card:${cluster.name}:usage:${row.key}:detail`}
              >
                {row.detail}
              </span>
            </dd>
          </div>
        ))}
      </dl>

      {cluster.ready ? (
        <a
          className="mt-auto text-[11px] text-ai-link hover:underline"
          href={`/kube-frontend/clusters/${encodeURIComponent(cluster.name)}/overview`}
          data-ai-id={`workspace-overview:clusters:card:${cluster.name}:link`}
        >
          {t('workspace.overview.clusters.open')}
        </a>
      ) : (
        <span className="mt-auto text-[11px] text-ai-fg-muted" data-ai-id={`workspace-overview:clusters:card:${cluster.name}:unavailable`}>
          {t('workspace.overview.clusters.unavailable')}
        </span>
      )}
    </li>
  );
}
