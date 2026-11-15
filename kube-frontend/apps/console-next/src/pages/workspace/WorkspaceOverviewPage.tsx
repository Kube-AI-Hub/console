import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  workspaceDetailApi,
  workspaceMembersApi,
  workspaceUsageApi,
  type WorkspaceProjectRankMetric,
} from '@kube-ai-hub/api-client';
import { AiSurface, Skeleton, Tabs, TabsContent } from '@kube-ai-hub/ui';
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
              [t('workspace.field.clusters'), data.clusters.join(', ') || '-'],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <dt className="text-ai-fg-muted">{label}</dt>
                <dd className="truncate text-ai-fg">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {state === 'ready' ? <WorkspaceUsageSection workspace={workspace} /> : null}

      {state === 'ready' ? <WorkspaceRankingSection workspace={workspace} /> : null}

      {state === 'ready' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="workspace-overview:projects">
            <h2 className="mb-1 text-sm font-medium text-ai-fg">{t('workspace.overview.projects')}</h2>
            <p className="text-2xl font-semibold tabular-nums text-ai-fg" data-ai-id="workspace-overview:project-count">
              {projects.data?.length ?? 0}
            </p>
            <a className="text-xs text-ai-accent hover:underline" href={`/kube-frontend/workspaces/${encodeURIComponent(workspace)}/projects`}>
              {t('workspace.overview.viewProjects')}
            </a>
          </section>
          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="workspace-overview:members">
            <h2 className="mb-1 text-sm font-medium text-ai-fg">{t('workspace.overview.members')}</h2>
            <p className="text-2xl font-semibold tabular-nums text-ai-fg" data-ai-id="workspace-overview:member-count">
              {members.data?.length ?? 0}
            </p>
            <a className="text-xs text-ai-accent hover:underline" href={`/kube-frontend/workspaces/${encodeURIComponent(workspace)}/members`}>
              {t('workspace.overview.viewMembers')}
            </a>
          </section>
        </div>
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

