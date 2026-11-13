import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { limitRangesApi, projectInfoApi, type ProjectInfo } from '@kube-ai-hub/api-client';
import { AiSurface, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { formatTimestamp } from '@/lib/time';
import { formatCpu, formatBytes } from '@/lib/quantity';

export interface ProjectOverviewPageProps {
  workspace: string;
  cluster: string;
  namespace: string;
}

/**
 * 项目概览（项目作用域的落地页）.
 *
 * The old console's overview is project information, the quota in force, the limit ranges and
 * a usage ranking. The first three are reads this console can make; the ranking needs the
 * monitoring range query and is not part of this page — a card that says "no data" on every
 * project would be worse than not having it.
 *
 * Quota rows are shown as used/hard with a bar, because "2 / 4 cores" is only meaningful next
 * to how close that is to the limit.
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

  const state = info.isPending ? 'loading' : info.isError ? 'error' : 'ready';
  const project: ProjectInfo | undefined = info.data;

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