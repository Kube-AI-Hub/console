import type { Client } from './client';

/**
 * Projects, i.e. KubeSphere namespaces.
 *
 * A module of its own rather than part of `configmaps`: projects are shared by
 * every resource page (the picker, the filter, the create dialog's target), and
 * the old console likewise keeps them in their own store
 * (`console/src/stores/project.js`) instead of under a resource.
 */

export interface Project {
  name: string;
  /** `kubesphere.io/alias-name`; empty when the user never set one. */
  alias: string;
  /** `status.phase`, e.g. `Active` or `Terminating`. */
  phase: string;
}

/** Annotation carrying the human-friendly project name. */
const ALIAS_ANNOTATION = 'kubesphere.io/alias-name';

/**
 * Ceiling on cursors walked.
 *
 * Each page is a cluster-wide aggregation, and an upstream that keeps returning a
 * cursor would otherwise loop forever. 40 pages is far more projects than any
 * picker needs to offer.
 */
const MAX_PAGES = 40;

/** Cluster segment: the host cluster has none, members are `clusters/<id>`. */
function namespacesPath(cluster: string): string {
  const prefix = cluster && cluster !== 'host' ? `clusters/${encodeURIComponent(cluster)}/` : '';
  return `/kapis/resources.kubesphere.io/v1alpha3/${prefix}namespaces`;
}

interface NamespacePage {
  items?: Array<{
    metadata?: { name?: string; annotations?: Record<string, string> };
    status?: { phase?: string };
  }>;
  totalItems?: number;
  total_count?: number;
}

export interface ListProjectsOptions {
  signal?: AbortSignal;
  /**
   * Called after each page.
   *
   * The list costs seconds per page on a real cluster, so a picker can show what it
   * has and fill in the rest instead of blocking on the whole walk.
   */
  onPage?: (projects: Project[]) => void;
  pageSize?: number;
}

export function projectsApi(client: Client) {
  return {
    /**
     * Every project in the cluster.
     *
     * Follows `metadata.continue` rather than `page`: kapis serves this list from a
     * store that ignores `page=` (page 2 returns page 1 again) and pages only
     * through the cursor. Walking with `page` would silently show the same
     * projects forever while appearing to have covered the list.
     */
    async list(params: { cluster: string } & ListProjectsOptions): Promise<Project[]> {
      const pageSize = params.pageSize ?? 50;
      const base = namespacesPath(params.cluster);
      const collected: Project[] = [];
      const seen = new Set<string>();

      /*
       * Page with `page`/`limit` and stop on the server's own total, matching the
       * old console (`console/src/stores/project.js:84-131`). It used `limit: -1`
       * to ask for everything at once; paging is used here because a large
       * cluster answers that with a timeout and a truncated body rather than an
       * error, which silently loses projects from the picker.
       */
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const body = await client.request<NamespacePage>(base, {
          query: { page, limit: pageSize },
          ...(params.signal ? { signal: params.signal } : {}),
        });

        const items = body.items ?? [];
        for (const item of items) {
          const name = item.metadata?.name ?? '';
          // A page boundary can repeat an item when the list shifts underneath;
          // dedupe so a picker never shows the same project twice.
          if (!name || seen.has(name)) continue;
          seen.add(name);
          collected.push({
            name,
            alias: item.metadata?.annotations?.[ALIAS_ANNOTATION] ?? '',
            phase: item.status?.phase ?? '',
          });
        }

        params.onPage?.([...collected].sort((a, b) => a.name.localeCompare(b.name)));

        const total = body.totalItems ?? body.total_count;
        // Stop when the server says we have them all, or when a short page means
        // there is nothing after it. Either alone can be wrong: a server may omit
        // the total, and a page can be short because of filtering.
        if (items.length < pageSize) break;
        if (typeof total === 'number' && collected.length >= total) break;
      }

      return collected.sort((a, b) => a.name.localeCompare(b.name));
    },
  };
}

export type ProjectsApi = ReturnType<typeof projectsApi>;

/** Projects that can accept new objects; a terminating one cannot. */
export function selectableProjects(projects: Project[] | undefined): Project[] {
  return (projects ?? []).filter((project) => project.phase !== 'Terminating');
}

/** `name` or `name (alias)`, the shape the console shows everywhere. */
export function projectLabel(project: Project): string {
  return project.alias ? `${project.name} (${project.alias})` : project.name;
}
