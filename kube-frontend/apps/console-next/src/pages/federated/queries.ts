import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  accessReviewApi,
  clustersApi,
  federatedApi,
  objectEventsApi,
  pluralOf,
  segmentOf,
  workspacesApi,
  type CreateFederatedProjectInput,
  type FederatedProjectDetail,
  type FederatedProjectSummary,
  type FederatedResourceObject,
  type FederatedResourceType,
} from '@kube-ai-hub/api-client';
import { api } from '@/api';

/**
 * Federated project data.
 *
 * The reads and writes live in `@kube-ai-hub/api-client`; this module is the React
 * Query layer the pages consume: cache keys, mutations that invalidate them, and the
 * permission probes that decide whether a write control may appear.
 */

/** The list key; the detail keys below are separate so an edit refreshes both. */
export function federatedProjectsKey(workspace: string) {
  return ['federated-projects', workspace] as const;
}

/** The workspace's federated projects, name-sorted. */
export function useFederatedProjects(workspace: string) {
  return useQuery({
    queryKey: federatedProjectsKey(workspace),
    queryFn: ({ signal }) => federatedApi(api).listProjects({ workspace, signal }),
  });
}

/** One federated project by name; `null` means it does not exist. */
export function useFederatedProject(workspace: string, name: string) {
  return useQuery({
    queryKey: ['federated-project', workspace, name],
    enabled: Boolean(name),
    queryFn: ({ signal }) => federatedApi(api).getProject({ name, signal }),
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

/**
 * The namespaced Federated resource types from API discovery.
 *
 * Read-only by design: this view answers "what can be federated inside a project",
 * not "what has this project federated".
 */
export function useFederatedResourceTypes() {
  return useQuery({
    queryKey: ['federated-resource-types'],
    staleTime: 5 * 60_000,
    queryFn: ({ signal }): Promise<FederatedResourceType[]> => federatedApi(api).listResourceTypes({ signal }),
  });
}

/**
 * The project's objects for a group of Federated resource types.
 *
 * One collection per type (the federation API has no per-kind union read), read in
 * parallel by `useQueries`. Each tab owns its own loading/error/empty state, so a slow
 * or unavailable type cannot blank the whole detail page.
 */
export function useFederatedResources(namespace: string, plurals: readonly string[]) {
  return useQueries({
    queries: plurals.map((plural) => ({
      queryKey: ['federated-resources', namespace, plural],
      enabled: Boolean(namespace),
      staleTime: 30_000,
      queryFn: ({ signal }): Promise<FederatedResourceObject[]> =>
        federatedApi(api).listResources({ namespace, plural, signal }),
    })),
  });
}

/** One federated object's detail; `null` is the 404 case (route outliving the object). */
export function useFederatedResource(namespace: string, plural: string | undefined, name: string) {
  return useQuery({
    queryKey: ['federated-resource', namespace, plural, name],
    enabled: Boolean(namespace && plural && name),
    staleTime: 30_000,
    queryFn: ({ signal }) => federatedApi(api).getResource({ namespace, plural: plural as string, name, signal }),
  });
}

/**
 * Events about one federated object.
 *
 * Core events, filtered by involved object: the control plane reports the propagation
 * work it does on each object here, which is where "why is this not propagated" is
 * answered when the status conditions are not enough.
 */
export function useFederatedObjectEvents(params: { namespace: string; name: string; kind: string; enabled: boolean }) {
  return useQuery({
    queryKey: ['federated-events', params.namespace, params.kind, params.name],
    enabled: params.enabled && Boolean(params.namespace && params.name && params.kind),
    staleTime: 15_000,
    queryFn: ({ signal }) =>
      objectEventsApi(api).list({ namespace: params.namespace, name: params.name, kind: params.kind, signal }),
  });
}

/* ---------------- Writes ---------------- */

/** Invalidate one project everywhere it is cached. */
function invalidateProject(queryClient: ReturnType<typeof useQueryClient>, workspace: string, name: string): void {
  void queryClient.invalidateQueries({ queryKey: federatedProjectsKey(workspace) });
  void queryClient.invalidateQueries({ queryKey: ['federated-project', workspace, name] });
}

export function useCreateFederatedProject(workspace: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateFederatedProjectInput, 'workspace'> & { creator?: string }) =>
      federatedApi(api).createProject({ ...input, workspace }),
    onSuccess: (project) => invalidateProject(queryClient, workspace, project.name),
  });
}

export function useUpdateFederatedProjectInfo(workspace: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; alias: string; description: string }): Promise<FederatedProjectDetail> =>
      federatedApi(api).updateProjectInfo(input),
    onSuccess: (project) => invalidateProject(queryClient, workspace, project.name),
  });
}

export function useUpdateFederatedProjectPlacement(workspace: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; clusters: string[] }): Promise<FederatedProjectDetail> =>
      federatedApi(api).updateProjectPlacement(input),
    onSuccess: (project) => invalidateProject(queryClient, workspace, project.name),
  });
}

export function useDeleteFederatedProjects(workspace: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (names: string[]) => federatedApi(api).deleteProjects({ names }),
    // Refresh whatever survived: a partially failed batch must not look empty.
    onSettled: () => void queryClient.invalidateQueries({ queryKey: federatedProjectsKey(workspace) }),
  });
}

/* ---------------- Permissions ---------------- */

export type FederatedVerb = 'create' | 'update' | 'delete';

/**
 * Whether the reader may write federated projects.
 *
 * The question is asked with the same verb/resource the request will use. It fails
 * **open**: only an explicit `allowed: false` disables a control, because a broken
 * authorization probe must not take a permitted write away from its reader.
 *
 * `create` asks both halves of the two-object create (namespace + FederatedNamespace);
 * any explicit denial means the create would fail, so the action is disabled with the
 * reason shown.
 */
export function useFederatedPermission(params: { verb: FederatedVerb; workspace: string; name?: string }) {
  const review = accessReviewApi(api);
  const namespace = params.verb === 'create' ? undefined : params.name;
  const query = useQuery({
    queryKey: ['federated-permission', params.verb, params.workspace, params.name ?? ''],
    staleTime: 60_000,
    retry: false,
    queryFn: async ({ signal }): Promise<boolean> => {
      if (params.verb === 'create') {
        const [mayCreateNamespaces, mayCreateFederated] = await Promise.all([
          review.allowed({ verb: 'create', resource: 'namespaces', signal }),
          review.allowed({ verb: 'create', resource: 'federatednamespaces', group: 'types.kubefed.io', signal }),
        ]);
        return mayCreateNamespaces && mayCreateFederated;
      }
      if (params.verb === 'update') {
        return review.allowed({
          verb: 'update',
          resource: 'federatednamespaces',
          group: 'types.kubefed.io',
          ...(namespace ? { namespace } : {}),
          ...(params.name ? { name: params.name } : {}),
          signal,
        });
      }
      // Which the delete actually is: the project's namespace.
      return review.allowed({ verb: 'delete', resource: 'namespaces', ...(namespace ? { namespace } : {}), signal });
    },
  });
  return { denied: query.data === false, pending: query.isPending };
}

/**
 * Clusters a project can be placed on.
 *
 * A name is the API's identity; the alias is what the reader recognises. Not-ready
 * clusters are still listed so placement that already includes one can be read back,
 * but the picker disables selecting them.
 */
export function useFederatedClusters() {
  return useQuery({
    queryKey: ['federated-clusters'],
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      const body = await clustersApi(api).list({ signal });
      return body.items.map((cluster) => ({
        name: cluster.name,
        label: cluster.alias || cluster.name,
        ready: cluster.ready,
        isHost: cluster.isHost,
      }));
    },
  });
}

export type FederatedProject = FederatedProjectSummary;
export type { FederatedResourceObject };
export { pluralOf, segmentOf };
