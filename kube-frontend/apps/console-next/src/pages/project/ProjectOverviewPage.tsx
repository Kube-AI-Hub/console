import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  limitRangesApi,
  projectInfoApi,
  workloadRankingApi,
  type ProjectInfo,
  type WorkloadRankMetric,
} from '@kube-ai-hub/api-client';
import { AiButton, AiSurface, Skeleton, Tabs, TabsContent } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { formatTimestamp } from '@/lib/time';
import { formatCpu, formatBytes, formatCount } from '@/lib/quantity';

export interface ProjectOverviewPageProps {
  workspace: string;
  cluster: string;
  namespace: string;
}

/**
 * 项目概览（项目作用域的落地页）.
 *
 * The old console's overview is project information, the quota in force, the limit ranges, a
 * resource-usage block and a usage ranking. The ranking is still out of scope (it needs
 * per-workload metrics and a "who is hot" reading); the **usage** block is not: it answers
 * "how much is this project actually using against its quota", which is the first question a
 * project administrator asks.
 *
 * Usage and quota are two different reads, and the page keeps them distinct: the quota rows
 * come from the project's ResourceQuota, while usage comes from the monitoring namespace
 * endpoint. Monitoring can be absent or have no sample for this namespace; those are not the
 * same state as "zero", so the card has an explicit unavailable state (with retry) and an
 * explicit empty state, and never prints a fake 0.
 *
 * The quota chart below the card still shows used/hard with a bar, because "2 / 4 cores" is
 * only meaningful next to how close that is to the limit.
 */
export function ProjectOverviewPage({ workspace, cluster, namespace }: ProjectOverviewPageProps): React.ReactElement {
  const t = useT();
  const info = useQuery({
    queryKey: ['project-info', cluster, namespace],
    queryFn: ({ signal }) => projectInfoApi(apiClient).get({ cluster, namespace, signal }),
  });
  const limits = useQuery({
    queryKey: ['limitranges', namespace],
    queryFn: ({ signal }) => limitRangesApi(apiClient).list({ namespace, signal }),
  });

  /*
   * Usage snapshot, read from the monitoring namespace endpoint.
   *
   * The window is resolved once at mount: a range recomputed on every render would change
   * the query key and refetch forever (the same trap the cluster monitor page avoids).
   * Five minutes at a one-minute step yields one or two samples, and the card only needs
   * the latest one.
   */
  const [usageRange] = React.useState(() => {
    const end = Math.floor(Date.now() / 1000) * 1000;
    return { start: end - 5 * 60 * 1000, end };
  });
  const usage = useQuery({
    queryKey: ['project-usage', cluster, namespace, usageRange.start],
    queryFn: async ({ signal }): Promise<Record<string, number>> => {
      const body = await apiClient.request<{
        results?: Array<{
          metric_name?: string;
          data?: { result?: Array<{ values?: Array<[number, string]> }> };
        }>;
      }>(`/kapis/monitoring.kubesphere.io/v1alpha3/namespaces/${encodeURIComponent(namespace)}`, {
        query: {
          metrics_filter: USAGE_METRICS.map((metric) => `${metric}$`).join('|'),
          start: Math.round(usageRange.start / 1000),
          end: Math.round(usageRange.end / 1000),
          step: '60s',
          cluster,
        },
        ...(signal ? { signal } : {}),
      });
      /*
       * The range answer is a matrix per metric; the latest sample is the current usage.
       * A metric the backend does not have is **absent**, never zero — the caller decides
       * what an absent value means for its card.
       */
      const values: Record<string, number> = {};
      for (const result of body?.results ?? []) {
        const name = result.metric_name;
        if (!name) continue;
        const samples = result.data?.result ?? [];
        let latest: [number, string] | undefined;
        for (const sample of samples) {
          for (const point of sample.values ?? []) {
            if (!latest || point[0] > latest[0]) latest = point;
          }
        }
        const parsed = latest ? Number.parseFloat(latest[1]) : Number.NaN;
        if (Number.isFinite(parsed)) values[name] = parsed;
      }
      return values;
    },
    staleTime: 60_000,
    retry: false,
  });

  const state = info.isPending ? 'loading' : info.isError ? 'error' : 'ready';
  const project: ProjectInfo | undefined = info.data;
  const usageValues: Record<string, number> = usage.data ?? {};

  return (
    <AiSurface as="section" aiId="project-overview:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-ai-fg">{project?.alias || namespace}</h1>
        <p className="text-xs text-ai-fg-muted">{t('project.overview.description')}</p>
      </header>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={info.error} onRetry={() => void info.refetch()} retryAiId="project-overview:retry" />
      ) : null}

      {project ? (
        <React.Fragment>
          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="project-overview:basic">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('platform.user.detail.basic')}</h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <DefinitionRow label={t('project.overview.name')} value={project.name} />
              <DefinitionRow label={t('project.overview.alias')} value={project.alias || '-'} />
              <DefinitionRow label={t('project.overview.creator')} value={project.creator || '-'} />
              <DefinitionRow label={t('project.overview.createdAt')} value={formatTimestamp(project.createdAt)} />
            </dl>
            <dl className="mt-2 grid grid-cols-1 gap-y-2 text-sm">
              <DefinitionRow label={t('project.overview.projectDescription')} value={project.description || '-'} />
            </dl>
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="project-overview:usage">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('project.overview.usage.title')}</h2>
            {usage.isPending ? <Skeleton className="h-20 w-full" /> : null}
            {usage.isError ? (
              <div className="flex flex-col items-start gap-2" data-ai-id="project-overview:usage:unavailable">
                <p className="text-xs text-ai-fg-muted">{t('project.overview.usage.unavailable')}</p>
                <AiButton aiId="project-overview:usage:retry" size="sm" variant="secondary" onClick={() => void usage.refetch()}>
                  {t('common.retry')}
                </AiButton>
              </div>
            ) : null}
            {usage.isSuccess && Object.keys(usageValues).length === 0 ? (
              <p className="text-xs text-ai-fg-muted" data-ai-id="project-overview:usage:empty">
                {t('project.overview.usage.empty')}
              </p>
            ) : null}
            {usage.isSuccess && Object.keys(usageValues).length > 0 ? (
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {USAGE_ITEMS.map((item) => {
                  const row = usageRow(item, usageValues, project?.quota ?? []);
                  return (
                    <div key={item.key} className="rounded-ai-md border border-ai-line p-3">
                      <dt className="text-[11px] text-ai-fg-muted">{t(item.labelKey)}</dt>
                      <dd className="mt-1 flex items-baseline gap-1">
                        {/* The handle sits on the used value, not the card: automation asserts a
                            number, and the label/hard limit are context around it. */}
                        <span
                          className="truncate text-base font-semibold tabular-nums text-ai-fg"
                          data-ai-id={`project-overview:usage:${item.key}`}
                        >
                          {row.used ?? '-'}
                        </span>
                        {row.hard ? <span className="truncate text-[11px] text-ai-fg-faint">/ {row.hard}</span> : null}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            ) : null}
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="project-overview:quota">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('project.overview.quota')}</h2>
            {project.quota.length === 0 ? (
              <p className="text-xs text-ai-fg-muted">{t('project.overview.noQuota')}</p>
            ) : (
              <ul className="flex flex-col gap-3" data-ai-id="project-overview:quota-list">
                {project.quota.map((row) => {
                  const used = quantityNumber(row.used, row.resource);
                  const hard = quantityNumber(row.hard, row.resource);
                  const percent = hard > 0 ? Math.min(100, Math.round((used / hard) * 100)) : 0;
                  return (
                    <li key={row.resource} className="flex flex-col gap-1" data-ai-row={row.resource}>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="truncate text-ai-fg-secondary">{row.resource}</span>
                        <span className="tabular-nums text-ai-fg-muted">
                          {formatQuantity(row.used, row.resource)} / {formatQuantity(row.hard, row.resource)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ai-surface-2">
                        <div
                          className={percent >= 90 ? 'h-full rounded-full bg-ai-danger' : 'h-full rounded-full bg-ai-accent'}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="project-overview:limitranges">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('project.overview.limitRanges')}</h2>
            {limits.isPending ? <Skeleton className="h-16 w-full" /> : null}
            {limits.isError ? <p className="text-xs text-ai-fg-muted">{t('project.overview.limitRangesUnavailable')}</p> : null}
            {limits.data && limits.data.length === 0 ? (
              <p className="text-xs text-ai-fg-muted">{t('project.overview.noLimitRanges')}</p>
            ) : null}
            {limits.data && limits.data.length > 0 ? (
              <ul className="flex flex-col gap-2 text-xs" data-ai-id="project-overview:limitrange-list">
                {limits.data.map((range) => (
                  <li key={range.name} className="flex flex-col gap-1" data-ai-row={range.name}>
                    <span className="font-medium text-ai-fg">{range.name}</span>
                    <span className="text-ai-fg-muted">
                      {range.limits
                        .map((limit) => `${limit.type} ${limit.resource}${limit.defaultLimit ? ` ${limit.defaultLimit}` : ''}`)
                        .join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <UsageRankingSection cluster={cluster} namespace={namespace} workspace={workspace} />

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="project-overview:links">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('project.overview.shortcuts')}</h2>
            <div className="flex flex-wrap gap-2 text-sm">
              {(['pods', 'deployments', 'configmaps', 'persistentvolumeclaims', 'members'] as const).map((segment) => (
                <Link
                  key={segment}
                  to={segment === 'members'
                    ? '/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/members'
                    : `/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/${segment}`}
                  params={{ workspace, cluster, namespace }}
                  className="rounded-full border border-ai-line px-3 py-1 text-xs text-ai-fg-secondary hover:border-ai-accent hover:text-ai-accent"
                >
                  {t(`project.overview.shortcut.${segment}`)}
                </Link>
              ))}
            </div>
          </section>
        </React.Fragment>
      ) : null}
    </AiSurface>
  );
}


/**
 * 资源使用排行（项目内 Top 5）.
 *
 * The old console puts this at the bottom of the project overview: which workloads are
 * actually consuming the project's CPU and memory. It answers a different question from the
 * usage card above — that one is "how much is used", this one is "by whom".
 *
 * Two metrics, switched by tabs rather than two stacked tables: they rank the same set of
 * workloads, so showing both at once doubles the height for one extra click saved.
 *
 * A workload the monitoring backend cannot name is not listed — inventing a row for it would
 * put a name the reader cannot act on into a ranking of names.
 */
const RANK_METRICS: ReadonlyArray<{ key: WorkloadRankMetric; labelKey: 'project.overview.ranking.cpu' | 'project.overview.ranking.memory' }> = [
  { key: 'workload_cpu_usage', labelKey: 'project.overview.ranking.cpu' },
  { key: 'workload_memory_usage_wo_cache', labelKey: 'project.overview.ranking.memory' },
];

/**
 * The list route for a workload kind, as a literal.
 *
 * The router's `to` is a typed union of every declared path, so it cannot be built from a
 * template string at runtime; the three kinds that have a list page are spelled out here.
 */
function workloadListRoute(segment: 'deployments' | 'statefulsets' | 'daemonsets') {
  switch (segment) {
    case 'deployments':
      return '/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/deployments' as const;
    case 'statefulsets':
      return '/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/statefulsets' as const;
    default:
      return '/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/daemonsets' as const;
  }
}

/** Route segment for a workload kind, or null when the kind has no list page of its own. */
function workloadRoute(kind: string): 'deployments' | 'statefulsets' | 'daemonsets' | null {
  switch (kind.toLowerCase()) {
    case 'deployment':
      return 'deployments';
    case 'statefulset':
      return 'statefulsets';
    case 'daemonset':
      return 'daemonsets';
    default:
      return null;
  }
}

function UsageRankingSection({
  workspace,
  cluster,
  namespace,
}: {
  workspace: string;
  cluster: string;
  namespace: string;
}): React.ReactElement {
  const t = useT();
  const [metric, setMetric] = React.useState<WorkloadRankMetric>(RANK_METRICS[0]!.key);
  const ranking = useQuery({
    queryKey: ['project-workload-ranking', cluster, namespace, metric],
    queryFn: ({ signal }) => workloadRankingApi(apiClient).list({ cluster, namespace, metric, limit: 5, signal }),
  });
  const rows = ranking.data?.items ?? [];
  const format = (value: number): string =>
    metric === 'workload_cpu_usage' ? formatCpu(String(value)) : formatBytes(String(value));

  return (
    <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="project-overview:ranking">
      <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('project.overview.ranking.title')}</h2>
      <Tabs
        value={metric}
        onValueChange={(next) => setMetric(next as WorkloadRankMetric)}
        items={RANK_METRICS.map((item) => ({
          value: item.key,
          label: t(item.labelKey),
          aiId: `project-overview:ranking:tab:${item.key === 'workload_cpu_usage' ? 'cpu' : 'memory'}`,
        }))}
      >
      {RANK_METRICS.map((item) => (
        <TabsContent key={item.key} value={item.key}>
          {ranking.isPending ? <Skeleton className="mt-3 h-20 w-full" /> : null}
          {ranking.isError ? (
            <div className="mt-3 flex flex-col items-start gap-2" data-ai-id="project-overview:ranking:error">
              <p className="text-xs text-ai-fg-muted">{t('project.overview.ranking.unavailable')}</p>
              <AiButton
                aiId="project-overview:ranking:retry"
                size="sm"
                variant="secondary"
                onClick={() => void ranking.refetch()}
              >
                {t('common.retry')}
              </AiButton>
            </div>
          ) : null}
          {ranking.isSuccess && rows.length === 0 ? (
            <p className="mt-3 text-xs text-ai-fg-muted" data-ai-id="project-overview:ranking:empty">
              {t('project.overview.ranking.empty')}
            </p>
          ) : null}
          {rows.length > 0 ? (
            <ol className="mt-3 flex flex-col gap-2 text-xs" data-ai-id="project-overview:ranking:list">
              {rows.map((row, index) => {
                const segment = workloadRoute(row.kind);
                const label = (
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="tabular-nums text-ai-fg-muted">{index + 1}</span>
                    <span className="truncate font-medium text-ai-fg" data-ai-id={`project-overview:ranking:name:${row.name}`}>
                      {row.name}
                    </span>
                    {row.kind ? <span className="text-[11px] text-ai-fg-muted">{row.kind}</span> : null}
                  </span>
                );
                return (
                  <li key={row.workload} className="flex items-center justify-between gap-3" data-ai-row={row.workload}>
                    {segment ? (
                      <Link
                        to={workloadListRoute(segment)}
                        params={{ workspace, cluster, namespace }}
                        className="min-w-0 hover:text-ai-accent"
                      >
                        {label}
                      </Link>
                    ) : (
                      label
                    )}
                    <span className="shrink-0 tabular-nums text-ai-fg-secondary">{format(row.value)}</span>
                  </li>
                );
              })}
            </ol>
          ) : null}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
/**
 * The four usage items the card shows, each with the metrics that can answer it and the
 * quota keys that cap it.
 *
 * Storage is the awkward one: this deployment's monitoring backend does not expose a
 * namespace storage-usage metric (probed: the series are absent), so the item falls back to
 * the ResourceQuota's `status.used` for `requests.storage`. When neither exists the value is
 * `-`; it is never printed as 0.
 */
const USAGE_ITEMS = [
  {
    key: 'cpu',
    labelKey: 'project.overview.usage.cpu',
    kind: 'cpu',
    metrics: ['namespace_cpu_usage'],
    quotaKeys: ['requests.cpu', 'cpu', 'limits.cpu'],
  },
  {
    key: 'memory',
    labelKey: 'project.overview.usage.memory',
    kind: 'bytes',
    metrics: ['namespace_memory_usage_wo_cache', 'namespace_memory_usage'],
    quotaKeys: ['requests.memory', 'memory', 'limits.memory'],
  },
  {
    key: 'storage',
    labelKey: 'project.overview.usage.storage',
    kind: 'bytes',
    metrics: ['namespace_pvc_usage', 'namespace_storage_usage'],
    quotaKeys: ['requests.storage', 'storage', 'ephemeral-storage'],
  },
  {
    key: 'pods',
    labelKey: 'project.overview.usage.pods',
    kind: 'count',
    metrics: ['namespace_pod_count', 'namespace_pod_running_count'],
    quotaKeys: ['pods', 'count/pods'],
  },
] as const;

/** Every metric the card asks for, in one round trip. */
const USAGE_METRICS = Array.from(new Set(USAGE_ITEMS.flatMap((item) => [...item.metrics])));

/** One usage number, in the unit its row is read in. */
function formatUsageNumber(value: number, kind: 'cpu' | 'bytes' | 'count'): string {
  if (kind === 'cpu') {
    // Cores: sub-core values are the common case for a quiet project, and "0.0" would read
    // as zero. Two decimals keeps "0.03" visible without inventing precision.
    return String(Number(value.toFixed(2)));
  }
  if (kind === 'count') return formatCount(String(Math.round(value)));
  return formatBytes(String(Math.round(value)));
}

/** A quota value formatted the same way as its usage counterpart. */
function formatQuotaNumber(value: string, kind: 'cpu' | 'bytes' | 'count'): string {
  return formatQuantity(value, kind === 'cpu' ? 'cpu' : kind === 'count' ? 'pods' : 'memory');
}


/**
 * Used/hard for one item.
 *
 * Used comes from the monitoring metric when the backend has it; storage falls back to the
 * quota's own `status.used`, which is the only storage number this deployment exposes. A
 * missing used value stays missing — the card prints `-` rather than 0.
 */
function usageRow(
  item: (typeof USAGE_ITEMS)[number],
  values: Record<string, number>,
  quota: ProjectInfo['quota'],
): { used?: string; hard?: string } {
  const row: { used?: string; hard?: string } = {};

  const metric = item.metrics.find((name) => values[name] !== undefined);
  if (metric !== undefined) row.used = formatUsageNumber(values[metric]!, item.kind);

  const quotaForKey = (keys: readonly string[]) => quota.find((entry) => keys.includes(entry.resource));
  if (row.used === undefined) {
    const usedQuota = quotaForKey(item.quotaKeys);
    if (usedQuota?.used) row.used = formatQuotaNumber(usedQuota.used, item.kind);
  }

  const hardQuota = quotaForKey(item.quotaKeys);
  if (hardQuota?.hard) row.hard = formatQuotaNumber(hardQuota.hard, item.kind);

  return row;
}

/** Numeric value of a Kubernetes quantity for the bar; 0 when it cannot be read. */
function quantityNumber(value: string, resource: string): number {
  if (!value) return 0;
  if (resource === 'cpu' || resource.endsWith('.cpu')) {
    const cores = value.endsWith('m') ? Number(value.slice(0, -1)) / 1000 : Number(value);
    return Number.isFinite(cores) ? cores : 0;
  }
  if (resource.startsWith('memory') || resource.startsWith('storage') || resource.startsWith('ephemeral')) {
    const match = /^([0-9.]+)(Ki|Mi|Gi|Ti|K|M|G|T)?$/.exec(value);
    if (!match) return 0;
    const amount = Number(match[1]);
    const unit = match[2] ?? '';
    const factor: Record<string, number> = { Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4, K: 1e3, M: 1e6, G: 1e9, T: 1e12, '': 1 };
    return Number.isFinite(amount) ? amount * (factor[unit] ?? 1) : 0;
  }
  const plain = Number(value);
  return Number.isFinite(plain) ? plain : 0;
}

/** Human value for the row: cores, bytes or a plain count, by resource name. */
function formatQuantity(value: string, resource: string): string {
  if (!value) return '-';
  if (resource === 'cpu' || resource.endsWith('.cpu')) return formatCpu(value);
  if (resource.startsWith('memory') || resource.startsWith('storage') || resource.startsWith('ephemeral')) return formatBytes(value);
  return value;
}