import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ApiError, limitRangesApi, projectInfoApi, type ProjectInfo } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel, errorMessage } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { formatTimestamp } from '@/lib/time';

/**
 * 项目详情（集群作用域）.
 *
 * The cluster's project list used to end at the row: a project's name was text, so asking
 * "what is this project, what is it allowed to use, how much is it using" required the
 * platform-managed project console. This page answers the read-only half of that question
 * from the cluster console itself:
 * - the namespace object as Kubernetes stores it (name, status, created, labels, workspace);
 * - the project's ResourceQuota, used/hard per resource;
 * - its LimitRanges, i.e. the default request/limit injected into containers.
 *
 * Read-only on purpose: quota and LimitRange edits belong to the project settings pages,
 * and this cluster's write webhooks are currently unavailable anyway.
 *
 * A namespace that no longer exists is a distinct state with its own handle, not a blank
 * error page: the reader usually arrived from a stale row.
 */
export interface NamespaceDetailPageProps {
  cluster: string;
  /** The namespace (project) name from the route. */
  name: string;
}

export function NamespaceDetailPage({ cluster, name }: NamespaceDetailPageProps): React.ReactElement {
  const t = useT();

  const info = useQuery({
    queryKey: ['namespace-detail', cluster, name],
    queryFn: ({ signal }) => projectInfoApi(apiClient).get({ cluster, namespace: name, signal }),
  });
  const limits = useQuery({
    queryKey: ['namespace-detail-limitranges', name],
    queryFn: ({ signal }) => limitRangesApi(apiClient).list({ cluster, namespace: name, signal }),
  });

  const project: ProjectInfo | undefined = info.data;
  const workspace = project?.labels['kubesphere.io/workspace'] ?? project?.workspace ?? '';
  const state = info.isPending ? 'loading' : info.isError ? 'error' : 'ready';
  /*
   * A missing namespace does not arrive as 404 here: the resources proxy answers **500**
   * with `namespace "<name>" not found` in the body, so the status alone cannot tell a
   * deleted project from a broken API. The message is the only signal, and it matters:
   * a stale row should land on a "not found" state, not on a retry loop that cannot help.
   */
  const missing = info.error instanceof ApiError && (info.error.isNotFound || /not found/i.test(info.error.message));

  return (
    <AiSurface as="section" aiId="namespace-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <Link
          to="/kube-frontend/clusters/$cluster/namespaces"
          params={{ cluster }}
          className="text-sm text-ai-link hover:underline"
          data-ai-id="namespace-detail:back"
        >
          ← {t('cluster.projects.title')}
        </Link>
        <h1 className="text-lg font-semibold text-ai-fg" data-ai-id="namespace-detail:title">
          {project?.name || name}
        </h1>
        <p className="text-xs text-ai-fg-muted">{t('project.overview.description')}</p>
      </header>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}

      {missing ? (
        <div
          className="flex flex-col items-start gap-2 rounded-ai-md border border-ai-line p-8"
          data-ai-id="namespace-detail:not-found"
        >
          <p className="text-sm font-medium text-ai-fg">{t('error.notFound')}</p>
          <p className="text-xs text-ai-fg-muted">{errorMessage(t, info.error)}</p>
        </div>
      ) : null}
      {state === 'error' && !missing ? (
        <ResourceErrorPanel error={info.error} onRetry={() => void info.refetch()} retryAiId="namespace-detail:retry" />
      ) : null}

      {project ? (
        <React.Fragment>
          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="namespace-detail:basic">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('workspace.detail.basic')}</h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <DefinitionRow label={t('cluster.column.name')} value={project.name} aiId="namespace-detail:name" />
              <DefinitionRow label={t('cluster.column.createdAt')} value={project.createdAt ? formatTimestamp(project.createdAt) : ''} aiId="namespace-detail:created-at" />
            </dl>
            <dl className="mt-2 grid grid-cols-1 gap-y-2 text-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                <dt className="shrink-0 text-ai-fg-muted">{t('cluster.column.status')}</dt>
                <dd data-ai-id="namespace-detail:status">
                  <Badge tone={project.status === 'Active' ? 'success' : 'warning'}>{project.status || '-'}</Badge>
                </dd>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                <dt className="shrink-0 text-ai-fg-muted">{t('metadata.labels')}</dt>
                <dd className="flex flex-wrap gap-1" data-ai-id="namespace-detail:labels">
                  {Object.keys(project.labels).length === 0 ? (
                    <span className="text-ai-fg-secondary">-</span>
                  ) : (
                    Object.entries(project.labels).map(([key, value]) => (
                      <span key={key} className="rounded-full border border-ai-line px-2 py-0.5 font-mono text-[11px] text-ai-fg-secondary">
                        {key}={value}
                      </span>
                    ))
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="namespace-detail:quota">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('project.overview.quota')}</h2>
            {project.quota.length === 0 ? (
              <p className="text-xs text-ai-fg-muted" data-ai-id="namespace-detail:quota-empty">
                {t('projectInfo.quota.empty')}
              </p>
            ) : (
              <table className="w-full border-collapse text-xs" data-ai-id="namespace-detail:quota-table">
                <thead>
                  <tr className="border-b border-ai-line text-ai-fg-muted">
                    <th scope="col" className="px-2 py-2 text-left font-medium">{t('projectInfo.quota.resource')}</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">{t('projectInfo.quota.hard')}</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">{t('projectInfo.quota.used')}</th>
                  </tr>
                </thead>
                <tbody>
                  {project.quota.map((row) => (
                    <tr key={row.resource} className="border-b border-ai-line" data-ai-row={row.resource}>
                      <td className="px-2 py-2 font-mono text-[11px] text-ai-fg-secondary">{row.resource}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-ai-fg-secondary">{row.hard || '-'}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-ai-fg-muted">{row.used || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="namespace-detail:limits">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('project.overview.limitRanges')}</h2>
            {limits.isPending ? <Skeleton className="h-16 w-full" /> : null}
            {limits.isError ? (
              <p className="text-xs text-ai-fg-muted" data-ai-id="namespace-detail:limits-unavailable">
                {t('project.overview.limitRangesUnavailable')}
              </p>
            ) : null}
            {limits.data && limits.data.length === 0 ? (
              <p className="text-xs text-ai-fg-muted" data-ai-id="namespace-detail:limits-empty">
                {t('project.overview.noLimitRanges')}
              </p>
            ) : null}
            {limits.data && limits.data.length > 0 ? (
              <table className="w-full border-collapse text-xs" data-ai-id="namespace-detail:limits-table">
                <thead>
                  <tr className="border-b border-ai-line text-ai-fg-muted">
                    <th scope="col" className="px-2 py-2 text-left font-medium">{t('cluster.customResources.kind')}</th>
                    <th scope="col" className="px-2 py-2 text-left font-medium">{t('projectInfo.quota.resource')}</th>
                    <th scope="col" className="px-2 py-2 text-left font-medium">{t('container.field.requests')}</th>
                    <th scope="col" className="px-2 py-2 text-left font-medium">{t('container.field.limits')}</th>
                  </tr>
                </thead>
                <tbody>
                  {limits.data.flatMap((range) =>
                    range.limits.map((limit) => (
                      <tr key={range.name + '/' + limit.type + '/' + limit.resource} className="border-b border-ai-line" data-ai-row={limit.type + '/' + limit.resource}>
                        <td className="px-2 py-2 text-ai-fg-secondary">{limit.type || '-'}</td>
                        <td className="px-2 py-2 font-mono text-[11px] text-ai-fg-secondary">{limit.resource || '-'}</td>
                        <td className="px-2 py-2 font-mono text-[11px] text-ai-fg-secondary">{limit.defaultRequest || '-'}</td>
                        <td className="px-2 py-2 font-mono text-[11px] text-ai-fg-secondary">{limit.defaultLimit || '-'}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            ) : null}
          </section>

          {workspace ? (
            <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="namespace-detail:links">
              <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('project.overview.shortcuts')}</h2>
              <div className="flex flex-wrap gap-2 text-sm">
                <Link
                  to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/overview"
                  params={{ workspace, cluster, namespace: project.name }}
                  className="rounded-full border border-ai-line px-3 py-1 text-xs text-ai-fg-secondary hover:border-ai-accent hover:text-ai-accent"
                  data-ai-id="namespace-detail:link:overview"
                >
                  {t('project.overview.title')}
                </Link>
                <Link
                  to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/pods"
                  params={{ workspace, cluster, namespace: project.name }}
                  className="rounded-full border border-ai-line px-3 py-1 text-xs text-ai-fg-secondary hover:border-ai-accent hover:text-ai-accent"
                  data-ai-id="namespace-detail:link:pods"
                >
                  {t('project.overview.shortcut.pods')}
                </Link>
                <Link
                  to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/configmaps"
                  params={{ workspace, cluster, namespace: project.name }}
                  className="rounded-full border border-ai-line px-3 py-1 text-xs text-ai-fg-secondary hover:border-ai-accent hover:text-ai-accent"
                  data-ai-id="namespace-detail:link:configmaps"
                >
                  {t('project.overview.shortcut.configmaps')}
                </Link>
              </div>
            </section>
          ) : null}
        </React.Fragment>
      ) : null}
    </AiSurface>
  );
}
