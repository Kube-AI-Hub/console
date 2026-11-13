import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectLabel, projectsApi, selectableProjects, type Project } from '@kube-ai-hub/api-client';
import { api } from '@/api';

/**
 * Shared project data.
 *
 * One module for the whole app, mirroring the old console's `stores/project.js`
 * (`console/src/stores/project.js:43`) but fixing what it got wrong: there, every
 * `ProjectSelect` and every page built its own store and issued its own request,
 * so opening three pickers meant three identical cluster-wide queries.
 *
 * The cache key does the dedupe here. React Query holds one entry per cluster, so
 * the picker, the filter and the create dialog share a single fetch, and a page
 * that opens later off a warm cache instead of re-querying.
 */

const PROJECTS_KEY = 'projects';

/**
 * Query key for a cluster's projects.
 *
 * Exported so callers can invalidate precisely this cluster rather than the whole
 * `projects` namespace.
 */
export function projectsQueryKey(cluster: string): readonly [string, string] {
  return [PROJECTS_KEY, cluster] as const;
}

/**
 * Projects of a cluster.
 *
 * The list is walked page by page inside `projectsApi.list`, and each page is
 * published through `onPage` so the picker grows instead of staying empty while a
 * slow cluster answers: one page can take seconds.
 */
export function useProjects(cluster: string) {
  const [partial, setPartial] = React.useState<Project[] | undefined>(undefined);

  // A cluster switch must not show the previous cluster's projects.
  React.useEffect(() => {
    setPartial(undefined);
  }, [cluster]);

  const query = useQuery({
    queryKey: projectsQueryKey(cluster),
    queryFn: ({ signal }) => projectsApi(api).list({ cluster, signal, onPage: setPartial }),
    // Projects change rarely within a session and each walk is expensive.
    staleTime: 10 * 60 * 1000,
    // One retry, not the default three: three attempts turn a slow aggregation
    // into half a minute of nothing.
    retry: 1,
  });

  /*
   * A page walk publishes each page through `partial`. Dropping it on a refetch
   * (window focus, an invalidation) empties every project picker for a moment —
   * a create dialog seeded from the current project then had nothing to select.
   * Keeping the last complete result until the new one arrives avoids that blink.
   */
  return { ...query, data: query.data ?? partial };
}

/**
 * Options for a project `Select`, without the "all" entry.
 *
 * `workspace` narrows the list to the projects that enterprise space manages. A project
 * belongs to exactly one workspace, and a workspace only governs its own — a picker that
 * ignores this offers projects the reader is not governing, which is a hierarchy bug
 * rather than a convenience. Omit it only where the caller genuinely wants every project
 * in the cluster (a cluster administrator's list filter, for example).
 */
export function useProjectOptions(cluster: string, workspace?: string): Array<{ value: string; label: string }> {
  const { data } = useProjects(cluster);
  return React.useMemo(() => {
    const projects = selectableProjects(data);
    const scoped = workspace ? projects.filter((project) => project.workspace === workspace) : projects;
    return scoped.map((project) => ({ value: project.name, label: projectLabel(project) }));
  }, [data, workspace]);
}

/**
 * Every project of a cluster grouped by its enterprise space, for the workbench.
 *
 * A namespace without the `kubesphere.io/workspace` label is not a project — it is a plain
 * namespace (a system one, or one created outside the console). Those are dropped: listing
 * them under "no enterprise space" would suggest the platform has projects nobody owns.
 */
export function useProjectsByWorkspace(cluster: string): Map<string, Project[]> {
  const { data } = useProjects(cluster);
  return React.useMemo(() => {
    const grouped = new Map<string, Project[]>();
    for (const project of selectableProjects(data)) {
      if (!project.workspace) continue;
      const list = grouped.get(project.workspace);
      if (list) list.push(project);
      else grouped.set(project.workspace, [project]);
    }
    return grouped;
  }, [data]);
}

/**
 * A list filter for projects.
 *
 * Returns a plain object so a page can place it in a schema without importing
 * query machinery; every resource list gets the same picker from one line.
 */
export function useProjectFilter(
  cluster: string,
  title: string,
  allLabel: string,
  emptyText?: string,
  /** Stable automation handle for the trigger, e.g. `secrets:filter:project`. */
  aiId?: string,
) {
  const options = useProjectOptions(cluster);
  return React.useMemo(
    () => ({
      key: 'project',
      title,
      allLabel,
      options,
      // Project names are long and numerous: typing part of one is faster than
      // scrolling, and a popup without a filter is unusable past a few dozen.
      searchable: true,
      ...(emptyText ? { emptyText } : {}),
      // Wider than the default 160px so a typical name fits; the trigger still
      // ellipsises anything longer instead of stretching the toolbar.
      widthClass: 'w-full sm:w-64',
      ...(aiId ? { aiId } : {}),
    }),
    [options, title, allLabel, emptyText, aiId],
  );
}
