import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { workspaceDetailApi, workspaceMembersApi, type WorkspaceMemberSummary, type WorkspaceProject } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { formatTimestamp } from '@/lib/time';

/**
 * 企业空间详情.
 *
 * A workspace is a tenant boundary: it owns projects, and its placement says which clusters
 * those projects may live on. The page answers the two questions the list row cannot — who
 * administers it, and which projects are inside — and links each project into its own console.
 *
 * Workspace members and roles are not shown: their API is a different aggregate (and the
 * members endpoint answers 404 here), so the page states the projects and stops rather than
 * showing empty tables that read as 'nobody has access'.
 */
export interface WorkspaceDetailPageProps {}

export function WorkspaceDetailPage(_props: WorkspaceDetailPageProps): React.ReactElement {
  const t = useT();
  const { name } = useParams({ from: '/kube-frontend/access/workspaces/$name' });
  const api = workspaceDetailApi(apiClient);

  const detail = useQuery({
    queryKey: ['workspace-detail', name],
    queryFn: ({ signal }) => api.get({ name, signal }),
  });
  const members = useQuery({
    queryKey: ['workspace-members', name],
    queryFn: ({ signal }) => workspaceMembersApi(apiClient).list({ workspace: name, signal }),
  });

  const projects = useQuery({
    queryKey: ['workspace-projects', name],
    queryFn: ({ signal }) => api.projects({ name, signal }),
  });

  const state = detail.isPending ? 'loading' : detail.isError ? 'error' : 'ready';
  const workspace = detail.data;
  // The first placed cluster is where its projects are reached from; a workspace can be
  // placed on several, and the project URL needs exactly one.
  const cluster = workspace?.clusters[0] ?? 'host';

  return (
    <AiSurface as="section" aiId="workspace-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <Link to="/kube-frontend/access/workspaces" className="text-sm text-ai-link hover:underline">
          ← {t('platform.workspaces.title')}
        </Link>
        <h1 className="text-lg font-semibold text-ai-fg">{workspace?.alias || name}</h1>
      </header>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={detail.error} onRetry={() => void detail.refetch()} retryAiId="workspace-detail:retry" />
      ) : null}

      {workspace ? (
        <React.Fragment>
          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="workspace-detail:basic">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('workspace.detail.basic')}</h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <DefinitionRow label={t('workspace.detail.name')} value={workspace.name} />
              <DefinitionRow label={t('workspace.detail.alias')} value={workspace.alias || '-'} />
              <DefinitionRow label={t('workspace.detail.manager')} value={workspace.manager || '-'} />
              <DefinitionRow label={t('workspace.detail.creator')} value={workspace.creator || '-'} />
              <DefinitionRow label={t('workspace.detail.createdAt')} value={formatTimestamp(workspace.createdAt)} />
              <DefinitionRow label={t('workspace.detail.clusters')} value={workspace.clusters.join(', ') || '-'} />
            </dl>
            <dl className="mt-2 grid grid-cols-1 gap-y-2 text-sm">
              <DefinitionRow label={t('workspace.detail.description')} value={workspace.description || '-'} />
            </dl>
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="workspace-detail:members">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">
              {t('workspace.detail.members')} ({members.data?.length ?? 0})
            </h2>
            {members.isPending ? <Skeleton className="h-20 w-full" /> : null}
            {members.isError ? (
              <p className="text-xs text-ai-fg-muted">{t('workspace.detail.membersUnavailable')}</p>
            ) : null}
            {members.data && members.data.length === 0 ? (
              <p className="text-xs text-ai-fg-muted">{t('workspace.detail.noMembers')}</p>
            ) : null}
            {members.data && members.data.length > 0 ? (
              <ul className="flex flex-col divide-y divide-ai-line text-sm" data-ai-id="workspace-detail:member-list">
                {members.data.map((member: WorkspaceMemberSummary) => (
                  <li key={member.username} className="flex items-center justify-between gap-3 py-2" data-ai-row={member.username}>
                    <span className="truncate font-medium text-ai-fg">{member.username}</span>
                    <span className="flex items-center gap-3 text-xs text-ai-fg-muted">
                      <span>{member.role || '-'}</span>
                      <Badge tone={member.status === 'Active' ? 'success' : 'danger'}>{member.status}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="workspace-detail:projects">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">
              {t('workspace.detail.projects')} ({projects.data?.length ?? 0})
            </h2>
            {projects.isPending ? <Skeleton className="h-20 w-full" /> : null}
            {projects.isError ? (
              <ResourceErrorPanel error={projects.error} onRetry={() => void projects.refetch()} retryAiId="workspace-projects:retry" />
            ) : null}
            {projects.data && projects.data.length === 0 ? (
              <p className="text-xs text-ai-fg-muted">{t('workspace.detail.noProjects')}</p>
            ) : null}
            {projects.data && projects.data.length > 0 ? (
              <ul className="flex flex-col divide-y divide-ai-line text-sm" data-ai-id="workspace-detail:project-list">
                {projects.data.map((project: WorkspaceProject) => (
                  <li key={project.name} className="flex items-center justify-between gap-3 py-2" data-ai-row={project.name}>
                    <Link
                      to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/configmaps"
                      params={{ workspace: name, cluster, namespace: project.name }}
                      className="truncate font-medium text-ai-link hover:underline"
                    >
                      {project.alias || project.name}
                    </Link>
                    <span className="flex items-center gap-3 text-xs text-ai-fg-muted">
                      <Badge tone={project.status === 'Active' ? 'success' : 'warning'}>{project.status || '-'}</Badge>
                      <span className="tabular-nums">{formatTimestamp(project.createdAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </React.Fragment>
      ) : null}
    </AiSurface>
  );
}