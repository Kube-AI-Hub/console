import { useQueries, useQuery } from '@tanstack/react-query';
import { workspacesApi } from '@kube-ai-hub/api-client';
import { api } from '@/api';

/**
 * Federated project reads.
 *
 * A federated project is a FederatedNamespace: one object carries both the namespace
 * and the placement (which clusters receive it). The tenant proxy's
 * /workspaces/<ws>/federatednamespaces collection answers 0 for it on this cluster —
 * the tenant list looks for the workspace label on the object while this object
 * carries it on the template — so the page reads the federated API directly and joins
 * it with the tenant workspace list for the workspace's display name.
 */
const FEDERATED_API = '/apis/types.kubefed.io/v1beta1';

interface RawFederatedNamespace {
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
  };
  spec?: {
    placement?: { clusters?: Array<{ name?: string }> };
    template?: { metadata?: { labels?: Record<string, string>; annotations?: Record<string, string> } };
  };
  status?: {
    clusters?: Array<{ name?: string }>;
    conditions?: Array<{ type?: string; status?: string }>;
  };
}

/** One row / the detail of a federated project. */
export interface FederatedProject {
  name: string;
  namespace: string;
  /** Workspace label from the federated template; empty when the object carries none. */
  workspace: string;
  clusters: string[];
  createdAt: string;
  creator: string;
  /** `Propagation` condition: `true` when the federation control plane reports True. */
  propagated: boolean | undefined;
  raw: RawFederatedNamespace;
}

function workspaceOf(item: RawFederatedNamespace): string {
  // The workspace label lives on the federated template (that is the metadata the
  // control plane propagates); older objects may carry it on the object itself.
  const template = item.spec?.template?.metadata?.labels ?? {};
  return template['kubesphere.io/workspace'] ?? item.metadata?.labels?.['kubesphere.io/workspace'] ?? '';
}

export function toFederatedProject(item: RawFederatedNamespace): FederatedProject {
  const clusters = (item.status?.clusters ?? item.spec?.placement?.clusters ?? [])
    .map((entry) => String(entry.name ?? ''))
    .filter(Boolean);
  const propagation = (item.status?.conditions ?? []).find((condition) => condition.type === 'Propagation');
  return {
    name: item.metadata?.name ?? '',
    namespace: item.metadata?.namespace ?? item.metadata?.name ?? '',
    workspace: workspaceOf(item),
    clusters,
    createdAt: item.metadata?.creationTimestamp ?? '',
    creator: item.spec?.template?.metadata?.annotations?.['kubesphere.io/creator'] ?? '',
    propagated: propagation ? String(propagation.status) === 'True' : undefined,
    raw: item,
  };
}

/** The workspace's federated projects, name-sorted. */
export function useFederatedProjects(workspace: string) {
  return useQuery({
    queryKey: ['federated-projects', workspace],
    queryFn: async ({ signal }): Promise<FederatedProject[]> => {
      const body = await api.request<{ items?: RawFederatedNamespace[] }>(FEDERATED_API + '/federatednamespaces', { signal });
      return (body?.items ?? [])
        .map(toFederatedProject)
        .filter((project) => project.workspace === workspace)
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

/**
 * One federated project by name.
 *
 * FederatedNamespace is a namespaced resource, and the object's namespace equals its
 * name, but the route only carries the name. Reading the (cluster-wide) collection and
 * picking the name avoids a second namespace lookup and a stale namespaced GET: the
 * cluster-wide list is the same read the list page already proves works.
 */
export function useFederatedProject(workspace: string, name: string) {
  return useQuery({
    queryKey: ['federated-project', workspace, name],
    enabled: Boolean(name),
    queryFn: async ({ signal }): Promise<FederatedProject | null> => {
      const body = await api.request<{ items?: RawFederatedNamespace[] }>(FEDERATED_API + '/federatednamespaces', { signal });
      const item = (body?.items ?? []).find((entry) => entry.metadata?.name === name);
      return item ? toFederatedProject(item) : null;
    },
  });
}

/** Workspace name → alias, for the detail's workspace field. */
export function useWorkspaceAliases() {
  return useQuery({
    queryKey: ['federated-workspace-aliases'],
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }): Promise<ReadonlyMap<string, string>> => {
      const body = await workspacesApi(api).list({ cluster: 'host', namespace: '', page: 1, pageSize: 200, signal });
      const aliases = new Map<string, string>();
      for (const workspace of body.items) aliases.set(workspace.name, workspace.alias || workspace.name);
      return aliases;
    },
  });
}

/** One federated resource type the federation API serves for a namespace. */
export interface FederatedResourceType {
  kind: string;
  plural: string;
}

/** One federated object inside a project's namespace. */
export interface FederatedResourceObject {
  name: string;
  /** e.g. `FederatedDeployment`; the row's type column. */
  kind: string;
  createdAt: string;
}

/**
 * The project's objects for a group of Federated resource types.
 *
 * One collection per type (the federation API has no per-kind union read), read in
 * parallel by `useQueries`. Each tab owns its own loading/error/empty state, so a
 * slow or unavailable type cannot blank the whole detail page.
 */
export function useFederatedResources(namespace: string, plurals: readonly string[]) {
  return useQueries({
    queries: plurals.map((plural) => ({
      queryKey: ['federated-resources', namespace, plural],
      enabled: Boolean(namespace),
      staleTime: 30_000,
      queryFn: async ({ signal }): Promise<FederatedResourceObject[]> => {
        const body = await api.request<{
          items?: Array<{ kind?: string; metadata?: { name?: string; creationTimestamp?: string } }>;
        }>(FEDERATED_API + '/namespaces/' + encodeURIComponent(namespace) + '/' + plural, { signal });
        return (body?.items ?? [])
          .map((item) => ({
            name: item.metadata?.name ?? '',
            kind: item.kind ?? '',
            createdAt: item.metadata?.creationTimestamp ?? '',
          }))
          .filter((item) => Boolean(item.name));
      },
    })),
  });
}

/**
 * The namespaced Federated* resource types from API discovery.
 *
 * Read-only by design: this view answers "what can be federated inside a project",
 * not "what has this project federated" — the latter needs one request per type and
 * belongs to the federated console itself, which is a follow-up.
 */
export function useFederatedResourceTypes() {
  return useQuery({
    queryKey: ['federated-resource-types'],
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }): Promise<FederatedResourceType[]> => {
      const body = await api.request<{
        resources?: Array<{ name?: string; kind?: string; namespaced?: boolean }>;
      }>(FEDERATED_API, { signal });
      return (body?.resources ?? [])
        .filter((resource) => resource.namespaced === true && !String(resource.name ?? '').includes('/'))
        .map((resource) => ({ kind: String(resource.kind ?? ''), plural: String(resource.name ?? '') }))
        .filter((resource) => resource.kind && resource.plural)
        .sort((a, b) => a.kind.localeCompare(b.kind));
    },
  });
}
