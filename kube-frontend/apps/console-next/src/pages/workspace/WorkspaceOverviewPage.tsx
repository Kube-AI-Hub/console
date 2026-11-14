import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { workspaceDetailApi, workspaceMembersApi } from '@kube-ai-hub/api-client';
import { AiSurface, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';

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