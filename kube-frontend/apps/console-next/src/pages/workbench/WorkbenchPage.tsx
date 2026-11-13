import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { clustersApi, workspacesApi, type ClusterSummary, type WorkspaceSummary } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Icon } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { useProjectsByWorkspace } from '@/components/projects/useProjects';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';

/**
 * 工作台 — the reader's enterprise spaces and the projects inside them.
 *
 * This is the landing page the top navigation's 工作台 entry points at. It used to be a
 * placeholder with one hard-coded link, which made "工作台" mean nothing: a project
 * console needs a project, and nothing here chose one.
 *
 * The hierarchy it shows is the one the platform actually enforces:
 *
 *   enterprise space → project (which itself lives on one cluster)
 *
 * Projects come from the cluster's namespace list (each carries its owning workspace as
 * a label) and workspaces come from the tenant API — the two are joined here rather than
 * asked of one endpoint, because the tenant endpoint lists a workspace's namespaces
 * without saying which cluster they are on.
 */
export function WorkbenchPage(): React.ReactElement {
  const t = useT();

  const clusters = useQuery({
    queryKey: ['clusters'],
    staleTime: 60_000,
    queryFn: ({ signal }) => clustersApi(apiClient).list({ signal }),
  });

  const workspaces = useQuery({
    queryKey: ['workspaces', 'all'],
    staleTime: 60_000,
    queryFn: ({ signal }) =>
      workspacesApi(apiClient).list({ cluster: 'host', namespace: '', page: 1, pageSize: 100, signal }),
  });

  const clusterNames = React.useMemo(
    () => (clusters.data?.items ?? []).map((cluster) => cluster.name),
    [clusters.data],
  );

  const state = clusters.isPending || workspaces.isPending ? 'loading' : clusters.isError || workspaces.isError ? 'error' : 'ready';

  if (state === 'error') {
    return (
      <AiSurface aiId="workbench:surface" state="error" className="flex flex-col gap-4">
        <ResourceErrorPanel
          error={clusters.error ?? workspaces.error}
          onRetry={() => {
            void clusters.refetch();
            void workspaces.refetch();
          }}
          retryAiId="workbench:retry"
        />
      </AiSurface>
    );
  }

  return (
    <AiSurface aiId="workbench:surface" state={state} className="flex flex-col gap-4" {...actionProps('workbench:surface')}>
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-ai-fg">{t('workbench.title')}</h1>
        <p className="text-sm text-ai-fg-muted">{t('workbench.description')}</p>
      </header>

      {state === 'loading' ? <p className="text-sm text-ai-fg-muted">{t('common.loading')}</p> : null}

      {state === 'ready' ? (
        <WorkspaceSections
          workspaces={workspaces.data?.items ?? []}
          clusters={clusters.data?.items ?? []}
          clusterNames={clusterNames}
        />
      ) : null}
    </AiSurface>
  );
}

/**
 * One section per enterprise space.
 *
 * A workspace with no projects is still shown: a tenant administrator whose projects all
 * belong to a cluster this session cannot read would otherwise see nothing at all and
 * conclude the page is broken.
 */
function WorkspaceSections({
  workspaces,
  clusters,
  clusterNames,
}: {
  workspaces: WorkspaceSummary[];
  clusters: ClusterSummary[];
  clusterNames: string[];
}): React.ReactElement {
  const t = useT();

  const known = React.useMemo(() => {
    const map = new Map<string, WorkspaceSummary>();
    for (const workspace of workspaces) map.set(workspace.name, workspace);
    return map;
  }, [workspaces]);

  if (clusterNames.length === 0) {
    return (
      <div className="rounded-ai-md border border-ai-line p-6 text-center" data-ai-id="workbench:empty">
        <p className="text-sm text-ai-fg">{t('workbench.emptyTitle')}</p>
        <p className="mt-1 text-xs text-ai-fg-muted">{t('workbench.emptyHint')}</p>
        <Link to="/kube-frontend/clusters" className="mt-3 inline-block text-sm text-ai-accent hover:underline">
          {t('workbench.gotoPlatform')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {clusterNames.map((cluster) => (
        <ClusterWorkspaceGroups
          key={cluster}
          cluster={cluster}
          known={known}
          clusters={clusters}
        />
      ))}
    </div>
  );
}

/** The workspaces that own at least one project on this cluster, plus their projects. */
function ClusterWorkspaceGroups({
  cluster,
  known,
  clusters,
}: {
  cluster: string;
  known: Map<string, WorkspaceSummary>;
  clusters: ClusterSummary[];
}): React.ReactElement | null {
  const t = useT();
  const grouped = useProjectsByWorkspace(cluster);

  const clusterSummary = clusters.find((item) => item.name === cluster);

  if (grouped.size === 0) return null;

  return (
    <section className="flex flex-col gap-2" data-ai-id={`workbench:cluster:${cluster}`}>
      <h2 className="flex items-center gap-2 text-sm font-medium text-ai-fg">
        <Icon name="cluster" size={14} />
        {clusterSummary?.alias || cluster}
        <span className="text-[11px] font-normal text-ai-fg-muted">{t('workbench.cluster')}</span>
      </h2>

      {[...grouped.entries()].map(([workspaceName, projects]) => (
        <div
          key={`${cluster}/${workspaceName}`}
          className="rounded-ai-md border border-ai-line p-3"
          data-ai-id={`workbench:workspace:${workspaceName}`}
        >
          <div className="flex items-center gap-2">
            <Icon name="enterprise" size={14} />
            <span className="text-sm text-ai-fg">{workspaceAlias(known, workspaceName)}</span>
            {known.has(workspaceName) ? (
              <span className="text-[11px] text-ai-fg-muted" title={workspaceName}>
                {workspaceName}
              </span>
            ) : null}
            <span className="ml-auto text-[11px] text-ai-fg-muted">
              {t('workbench.projectCount', { count: projects.length })}
            </span>
          </div>

          <ul className="mt-2 flex flex-wrap gap-2">
            {projects.map((project) => (
              <li key={project.name}>
                <Link
                  to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/configmaps"
                  params={{ workspace: workspaceName || 'system-workspace', cluster, namespace: project.name }}
                  className="inline-flex items-center gap-1.5 rounded-ai-md border border-ai-line px-2.5 py-1.5 text-sm text-ai-fg hover:border-ai-accent hover:text-ai-accent"
                  {...actionProps(`workbench:project:${cluster}/${project.name}`)}
                >
                  <Icon name="project" size={12} />
                  {project.alias || project.name}
                  {project.phase && project.phase !== 'Active' ? (
                    <Badge tone="warning">{project.phase}</Badge>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function workspaceAlias(known: Map<string, WorkspaceSummary>, name: string): string {
  // The summary carries the object name only; the alias annotation is not mapped yet, so
  // this returns the name when nothing better exists.
  return known.get(name)?.name ?? name;
}
