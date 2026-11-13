import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  workspacesWriteApi,
  clusterRolesWriteApi,
  usersWriteApi,
  clusterRolesApi,
  usersApi,
  workspacesApi,
  type ClusterRoleSummary,
  type ResourceListParams,
  type UserSummary,
  type WorkspaceSummary,
} from '@kube-ai-hub/api-client';
import type { LocaleKey } from '@kube-ai-hub/locales';
import type { AssignablePlatformRole } from '@kube-ai-hub/api-client';
import { api } from '@/api';

/** Platform-level pages this area exposes. */
export type PlatformKind = 'users' | 'clusterroles' | 'workspaces';

export function platformKey(kind: PlatformKind, params: Omit<ResourceListParams, 'signal'>) {
  return ['platform', kind, params.page, params.pageSize, params.sortBy, params.order, params.keyword] as const;
}

/**
 * One list query for the three kinds.
 *
 * The branch lives inside the query function, not at the hook level: React requires
 * the same hooks in the same order on every render.
 */
export function usePlatformList(kind: PlatformKind, params: Omit<ResourceListParams, 'signal'>) {
  return useQuery({
    queryKey: platformKey(kind, params),
    queryFn: async ({ signal }) => {
      const client = kind === 'users' ? usersApi(api) : kind === 'clusterroles' ? clusterRolesApi(api) : workspacesApi(api);
      return client.list({ ...params, signal }) as Promise<{
        items: Array<UserSummary | ClusterRoleSummary | WorkspaceSummary>;
        total: number;
      }>;
    },
  });
}

export function useSetUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; platformRole: AssignablePlatformRole }) => usersWriteApi(api).setPlatformRole(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['platform', 'users'] }),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => usersWriteApi(api).remove({ name }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['platform', 'users'] }),
  });
}

export function useDeleteClusterRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => clusterRolesWriteApi(api).remove({ name }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['platform', 'clusterroles'] }),
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; alias?: string; description?: string }) => workspacesWriteApi(api).create(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['platform', 'workspaces'] }),
  });
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; alias?: string; description?: string }) => workspacesWriteApi(api).update(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['platform', 'workspaces'] }),
  });
}

export function useDeleteWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => workspacesWriteApi(api).remove({ name }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['platform', 'workspaces'] }),
  });
}

export interface PlatformDescriptor {
  titleKey: LocaleKey;
  descriptionKey: LocaleKey;
  emptyTitleKey: LocaleKey;
  emptyDescriptionKey: LocaleKey;
}

export const PLATFORM_DESCRIPTORS: Record<PlatformKind, PlatformDescriptor> = {
  users: {
    titleKey: 'platform.users.title',
    descriptionKey: 'platform.users.description',
    emptyTitleKey: 'platform.users.emptyTitle',
    emptyDescriptionKey: 'platform.users.emptyDescription',
  },
  clusterroles: {
    titleKey: 'platform.roles.title',
    descriptionKey: 'platform.roles.description',
    emptyTitleKey: 'platform.roles.emptyTitle',
    emptyDescriptionKey: 'platform.roles.emptyDescription',
  },
  workspaces: {
    titleKey: 'platform.workspaces.title',
    descriptionKey: 'platform.workspaces.description',
    emptyTitleKey: 'platform.workspaces.emptyTitle',
    emptyDescriptionKey: 'platform.workspaces.emptyDescription',
  },
};

/** Enable or disable a user account; the list is refetched because the status column is the
 * only feedback and it comes from the object, not from local state. */
export function useSetUserActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; active: boolean }) => usersWriteApi(api).setActive(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['platform', 'users'] }),
  });
}

/** Edit a user's email and description; the list is refetched because both are columns. */
export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; email: string; description: string }) => usersWriteApi(api).updateUser(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['platform', 'users'] }),
  });
}
