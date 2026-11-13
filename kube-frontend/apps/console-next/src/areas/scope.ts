/**
 * Scope roots: where each kind of page lives, derived from the URL.
 *
 * A page path never contains an area segment (DEC-AREA-01 — the URL keeps the old
 * console's shape so an old bookmark maps on by adding `/kube-frontend`). What a
 * page *is* — project resource, cluster resource, platform setting — comes from
 * the prefix, so the shell and the layouts must agree on these exact strings.
 * They live here, once, rather than being re-spelled in every layout, sidebar and
 * breadcrumb.
 */

export interface ProjectScope {
  workspace: string;
  cluster: string;
  namespace: string;
}

export const PROJECT_ROUTE_PATTERN =
  /^\/kube-frontend\/([^/]+)\/clusters\/([^/]+)\/projects\/([^/]+)(?:\/(.*))?$/;

export const CLUSTER_ROUTE_PATTERN = /^\/kube-frontend\/clusters\/(?:([^/]+)\/)?(.*)$/;

/**
 * Every top-level segment that is not a project route.
 *
 * Read by the cluster layout: `/kube-frontend/clusters/<id>/<page>` and
 * `/kube-frontend/clusters/<page>` are both valid old-console URLs (the platform
 * admin has a cluster console of its own), so the layout decides which it is.
 */
export const PLATFORM_AREAS = ['clusters', 'access', 'apps-manage', 'settings'] as const;

/** Prefix of a project URL, as the route tree spells it. */
export function projectRoot(scope: ProjectScope): string {
  return `/kube-frontend/${scope.workspace}/clusters/${scope.cluster}/projects/${scope.namespace}`;
}

/** Prefix of a cluster-scoped URL. Member clusters use `clusters/<id>`; the host uses no segment. */
export function clusterRoot(cluster: string): string {
  return cluster === 'host' ? '/kube-frontend/clusters' : `/kube-frontend/clusters/${encodeURIComponent(cluster)}`;
}

/** The last path segment; empty for a trailing slash. */
export function lastSegment(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

/** The page segment of a project URL: the segment right after the namespace. */
export function projectPageSegment(pathname: string): string {
  const match = PROJECT_ROUTE_PATTERN.exec(pathname);
  const rest = match?.[4] ?? '';
  return rest.split('/').filter(Boolean)[0] ?? '';
}
