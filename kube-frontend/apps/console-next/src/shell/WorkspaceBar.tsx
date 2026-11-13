import * as React from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { Icon, Select, cn, type SelectOption } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { useT } from '@/i18n';
import { useProjectOptions } from '@/components/projects/useProjects';
import { PROJECT_ROUTE_PATTERN } from '@/areas/scope';

/**
 * The workspace bar: which project (or cluster) the tabs on screen belong to.
 *
 * Desktop applications keep the document and let you switch the *document*, not
 * the window. The project console works the same way: picking another project
 * keeps the page the reader is on (保密字典 stays 保密字典) and only swaps the
 * namespace — which is the single most common context switch in the console and
 * is why it deserves a permanent control instead of a URL edit.
 *
 * It renders nothing outside project routes: there is no project to switch in the
 * cluster console, and a disabled control would only take space.
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

  // Every namespace has the same picker data, so the hook is called unconditionally.
  const options = useProjectsForBar(cluster);

  const onProjectChange = React.useCallback(
    (next: string) => {
      if (!next || next === namespace) return;
      const nextPath = `/kube-frontend/${encodeURIComponent(workspace)}/clusters/${encodeURIComponent(cluster)}/projects/${encodeURIComponent(next)}${rest ? `/${rest}` : ''}`;
      void navigate({ href: nextPath });
    },
    [cluster, namespace, navigate, rest, workspace],
  );

  if (!match) return null;

  const projectLabel = options.find((option) => option.value === namespace)?.label ?? namespace;

  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-2 border-b border-ai-line px-1 pb-2',
        // One line on a phone, scrolling sideways rather than wrapping the bar into
        // two rows that push the page down.
        'overflow-x-auto [overscroll-x-contain]',
      )}
      data-ai-id="workspace-bar"
    >
      <span className="flex shrink-0 items-center gap-1.5 rounded-ai-md bg-ai-surface-2 px-2 py-1 text-[11px] text-ai-fg-muted">
        <Icon name="project" size={12} />
        {t('workspace.project')}
      </span>
      <div className="w-56 shrink-0" {...actionProps('workspace:project-select')}>
        <Select
          value={namespace}
          options={options}
          searchable
          placeholder={t('workspace.selectProject')}
          emptyText={t('workspace.noProjects')}
          aria-label={t('workspace.project')}
          onValueChange={onProjectChange}
        />
      </div>
      <span className="flex shrink-0 items-center gap-1 rounded-ai-md px-2 py-1 text-[11px] text-ai-fg-faint">
        <Icon name="cluster" size={12} />
        {cluster}
      </span>
      {/* The current project's display name, so a long list of similarly named
          projects does not have to be decoded from the selector's truncation. */}
      <span className="truncate text-[11px] text-ai-fg-muted" data-ai-id="workspace:current-project">
        {projectLabel}
      </span>
    </div>
  );
}

/**
 * Project options for the bar.
 *
 * Thin wrapper so the hook order stays unconditional above (the bar itself is
 * allowed to render nothing, hooks may not). The label falls back to the bare
 * name: the bar is a navigation control, not a prefix match over `Project`.
 */
function useProjectsForBar(cluster: string): SelectOption[] {
  const options = useProjectOptions(cluster);
  return React.useMemo(() => options.map((option) => ({ value: option.value, label: option.label })), [options]);
}

/** Whether the location is a project route (used by tests and the shell). */
export function isProjectRoute(pathname: string): boolean {
  return PROJECT_ROUTE_PATTERN.test(pathname);
}
