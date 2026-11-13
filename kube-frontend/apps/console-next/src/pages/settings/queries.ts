import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  membersApi,
  rolesApi,
  type MemberSummary,
  type RoleSummary,
  type ResourceListParams,
} from '@kube-ai-hub/api-client';
import type { LocaleKey } from '@kube-ai-hub/locales';
import { api } from '@/api';

/** Project settings pages this area exposes so far. */
export type SettingsKind = 'roles' | 'members';

export function settingsKey(kind: SettingsKind, params: Omit<ResourceListParams, 'signal'>) {
  return ['settings', kind, params.cluster, params.namespace, params.page, params.pageSize, params.sortBy, params.order, params.keyword] as const;
}

/**
 * One list query for both kinds.
 *
 * The branch lives inside the query function, not at the hook level: React requires
 * the same hooks in the same order every render, so `kind === … ? useA() : useB()`
 * would be a latent rules-of-hooks bug. The row type is the union; the page narrows.
 */
export function useSettingsList(kind: SettingsKind, params: Omit<ResourceListParams, 'signal'>) {
  return useQuery({
    queryKey: settingsKey(kind, params),
    queryFn: async ({ signal }) => {
      const client = kind === 'roles' ? rolesApi(api) : membersApi(api);
      return client.list({ ...params, signal }) as Promise<{
        items: Array<RoleSummary | MemberSummary>;
        total: number;
      }>;
    },
  });
}

/**
 * Role writes. Templated roles are rejected upstream (the platform owns them), so
 * the UI only offers edit/delete on roles that are not templates.
 */
export function useUpdateRole(params: { cluster: string; namespace: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; annotations: Record<string, string> }) =>
      rolesApi(api).patchRole({
        cluster: params.cluster,
        namespace: params.namespace,
        name: input.name,
        body: { metadata: { annotations: input.annotations } },
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['settings', 'roles'] }),
  });
}

export function useDeleteRole(params: { cluster: string; namespace: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => rolesApi(api).removeRole({ cluster: params.cluster, namespace: params.namespace, name }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['settings', 'roles'] }),
  });
}

export interface SettingsDescriptor {
  titleKey: LocaleKey;
  descriptionKey: LocaleKey;
  emptyTitleKey: LocaleKey;
  emptyDescriptionKey: LocaleKey;
}

export const SETTINGS_DESCRIPTORS: Record<SettingsKind, SettingsDescriptor> = {
  roles: {
    titleKey: 'settings.roles.title',
    descriptionKey: 'settings.roles.description',
    emptyTitleKey: 'settings.roles.emptyTitle',
    emptyDescriptionKey: 'settings.roles.emptyDescription',
  },
  members: {
    titleKey: 'settings.members.title',
    descriptionKey: 'settings.members.description',
    emptyTitleKey: 'settings.members.emptyTitle',
    emptyDescriptionKey: 'settings.members.emptyDescription',
  },
};
