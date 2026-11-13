import * as React from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { clustersApi } from '@kube-ai-hub/api-client';
import { Icon, Select, cn, type SelectOption } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { useProjectOptions } from '@/components/projects/useProjects';
import { PROJECT_ROUTE_PATTERN } from '@/areas/scope';

/**
 * The context bar: 企业空间 · 集群 · 项目, in that order.
 *
 * Desktop applications keep the document and let you switch the *document*, not the
 * window. The project console works the same way: picking another project keeps the page
 * the reader is on (保密字典 stays 保密字典) and only swaps the namespace.
 *
 * The three levels are shown because they are three different scopes, and the relationship
 * between them is what the platform enforces: a project lives on one cluster and belongs
 * to one enterprise space. The project picker is therefore limited to the current
 * workspace's projects — a picker spanning every project in the cluster offers projects
 * the reader is not governing.
 *
 * It renders nothing outside project routes: there is no project to switch in the cluster
 * console, and a disabled control would only take space.
 */
export function WorkspaceBar(): React.ReactElement | null {
  const t = useT();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const match = PROJECT_ROUTE_PATTERN.exec(pathname);

  const workspace = match?.[1] ? decodeURIComponent(match[1]) : '';
  const cluster = match?.[2] ? decodeURIComponent(match[2]) : '';
  const namespace = match?.[3] ? decodeURIComponent(match[3]) : '';
  const rest = match?.[4] ?? '';

  // Hooks are called unconditionally: the bar may render nothing, hooks may not.
  const projectOptions = useProjectOptionsForBar(cluster, workspace);
  const [clusterPickerOpen, setClusterPickerOpen] = React.useState(false);
  const clusterOptions = useClusterOptionsForBar(clusterPickerOpen);

  const goTo = React.useCallback(
    (next: { workspace?: string; cluster?: string; namespace?: string }) => {
      const nextWorkspace = next.workspace ?? workspace;
      const nextCluster = next.cluster ?? cluster;
      const nextNamespace = next.namespace ?? namespace;
      if (!nextWorkspace || !nextCluster || !nextNamespace) return;
      const nextPath = `/kube-frontend/${encodeURIComponent(nextWorkspace)}/clusters/${encodeURIComponent(nextCluster)}/projects/${encodeURIComponent(nextNamespace)}${rest ? `/${rest}` : ''}`;
      void navigate({ href: nextPath });
    },
    [cluster, namespace, navigate, rest, workspace],
  );

  const onProjectChange = React.useCallback(
    (next: string) => {
      if (!next || next === namespace) return;
      goTo({ namespace: next });
    },
    [goTo, namespace],
  );

  if (!match) return null;

  const projectLabel = projectOptions.find((option) => option.value === namespace)?.label ?? namespace;

  return (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-2 border-b border-ai-line px-1 pb-2',
        // One line on a phone, scrolling sideways rather than wrapping the bar into
        // two rows that push the page down.
        'overflow-x-auto [overscroll-x-contain]',
      )}
      data-ai-id="workspace-bar"
    >
      {/* Level 1: the enterprise space. Read-only here — switching it means switching to
          another tenant's project, which is done from 工作台 or the workspace console. */}
      <span
        className="flex shrink-0 items-center gap-1.5 rounded-ai-md bg-ai-surface-2 px-2 py-1 text-[11px] text-ai-fg-secondary"
        title={`${t('workspace.workspace')}: ${workspace}`}
        data-ai-id="workspace:current-workspace"
      >
        <Icon name="enterprise" size={12} />
        {workspace}
      </span>

      {/* Level 2: the cluster. Switching keeps the page if that workspace has a project of
          the same name there; otherwise it lands on the workspace's first project. */}
      <span className="flex shrink-0 items-center gap-1 text-[11px] text-ai-fg-muted">
        <Icon name="cluster" size={12} />
      </span>
      <div className="w-40 shrink-0" {...actionProps('workspace:cluster-select')}>
        <Select
          value={cluster}
          options={clusterOptions}
          searchable
          placeholder={t('workspace.selectCluster')}
          emptyText={t('workspace.noClusters')}
          aria-label={t('workspace.cluster')}
          onOpenChange={setClusterPickerOpen}
          onValueChange={(next) => {
            if (!next || next === cluster) return;
            goTo({ cluster: next });
          }}
        />
      </div>

      {/* Level 3: the project, limited to this workspace. */}
      <span className="flex shrink-0 items-center gap-1.5 rounded-ai-md bg-ai-surface-2 px-2 py-1 text-[11px] text-ai-fg-muted">
        <Icon name="project" size={12} />
        {t('workspace.project')}
      </span>
      <div className="w-56 shrink-0" {...actionProps('workspace:project-select')}>
        <Select
          value={namespace}
          options={projectOptions}
          searchable
          placeholder={t('workspace.selectProject')}
          emptyText={t('workspace.noProjects')}
          aria-label={t('workspace.project')}
          onValueChange={onProjectChange}
        />
      </div>
      {/* The current project's display name, so a long list of similarly named
          projects does not have to be decoded from the selector's truncation. */}
      <span className="truncate text-[11px] text-ai-fg-muted" data-ai-id="workspace:current-project">
        {projectLabel}
      </span>
    </div>
  );
}

/**
 * Project options for the bar, limited to the current enterprise space.
 *
 * Thin wrapper so the hook order stays unconditional above (the bar itself is allowed to
 * render nothing, hooks may not).
 */
function useProjectOptionsForBar(cluster: string, workspace: string): SelectOption[] {
  const options = useProjectOptions(cluster, workspace);
  return React.useMemo(() => options.map((option) => ({ value: option.value, label: option.label })), [options]);
}

/**
 * Cluster options for the bar, fetched when the picker is opened.
 *
 * A project page does not need the cluster list to render — the current cluster is in the
 * URL — so asking for it on every page load adds a round trip to a page that was already
 * waiting on its own data. The current cluster is shown from the route until the popup
 * asks for the rest.
 */
function useClusterOptionsForBar(enabled: boolean): SelectOption[] {
  const query = useQuery({
    queryKey: ['clusters'],
    staleTime: 60_000,
    enabled,
    queryFn: ({ signal }) => clustersApi(apiClient).list({ signal }),
  });
  return React.useMemo(
    () => (query.data?.items ?? []).map((item) => ({ value: item.name, label: item.alias || item.name })),
    [query.data],
  );
}

/** Whether the location is a project route (used by tests and the shell). */
export function isProjectRoute(pathname: string): boolean {
  return PROJECT_ROUTE_PATTERN.test(pathname);
}
